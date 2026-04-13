import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useState, useMemo } from "react";
import NavBar from "../components/NavBar";
import { DetailSkeleton } from "../components/Skeleton";
import api from "../services/api";

// ── Field-type helpers ─────────────────────────────────────────────────────────

type InputType =
  | "text"
  | "date"
  | "datetime-local"
  | "tel"
  | "email"
  | "number"
  | "url";

const INPUT_TYPE_CYCLE: InputType[] = [
  "text",
  "date",
  "datetime-local",
  "tel",
  "email",
  "number",
  "url",
];

const INPUT_TYPE_ICONS: Record<InputType, string> = {
  text: "Aa",
  date: "📅",
  "datetime-local": "🕒",
  tel: "☎",
  email: "@",
  number: "#",
  url: "🔗",
};

function detectFieldType(key: string): InputType {
  const lk = key.toLowerCase().replace(/[^a-z]/g, " ");
  if (
    /\bdate\b|\bday\b|\bdob\b|\bbirth\b|\bjoining\b|\badmission\b|\bregistration\b/.test(
      lk,
    )
  )
    return "date";
  if (/\btime\b|\bschedule\b|\bat\b/.test(lk)) return "datetime-local";
  if (/\bphone\b|\bmobile\b|\bcell\b/.test(lk)) return "tel";
  if (/\bemail\b/.test(lk)) return "email";
  if (
    /\bfee\b|\bprice\b|\bscore\b|\bgrade\b|\bage\b|\bcount\b|\bamount\b|\bnum\b/.test(
      lk,
    )
  )
    return "number";
  if (/\burl\b|\blink\b|\bwebsite\b/.test(lk)) return "url";
  return "text";
}

/** Convert an ISO timestamp string to the value expected by <input type="datetime-local"> */
function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  } catch {
    return "";
  }
}

/** Convert a datetime-local input value back to ISO string (UTC) */
function localToIso(val: string): string | null {
  if (!val) return null;
  try {
    return new Date(val).toISOString();
  } catch {
    return null;
  }
}

/**
 * Normalise a date string value for an <input type="date"> field (YYYY-MM-DD).
 * Handles ISO timestamps, DD-MM-YYYY, MM-DD-YYYY, DD/MM/YYYY, etc.
 */
function normaliseDateValue(raw: string): string {
  if (!raw) return "";
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // ISO timestamp (e.g. "2024-01-15T00:00:00Z")
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  // Try native Date parse as last resort
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {
    /* ignore */
  }
  return raw;
}

/**
 * Normalise extra_data value for the detected input type.
 */
function normaliseExtraValue(val: string, inputType: InputType): string {
  if (inputType === "date") return normaliseDateValue(val);
  if (inputType === "datetime-local") return isoToLocal(val) || val;
  return val;
}

const DEFAULT_STATUS_OPTIONS = [
  "follow up",
  "highly interested",
  "not interested",
  "not fit",
  "registration paid",
  "paid",
  "junk lead",
  "workshop paid",
  "demo attended",
  "future prospect",
  "online class",
];

const INTENT_OPTIONS_ALL = [
  "new",
  "interested",
  "callback_requested",
  "payment_pending",
  "not_interested",
  "no_answer",
  "future_planning",
  "converted",
  "wrong_number",
  "undecided",
];

const INTENT_COLORS: Record<string, string> = {
  interested: "bg-green-100 text-green-700",
  callback_requested: "bg-yellow-100 text-yellow-700",
  payment_pending: "bg-orange-100 text-orange-700",
  not_interested: "bg-red-100 text-red-700",
  no_answer: "bg-gray-100 text-gray-600",
  future_planning: "bg-blue-100 text-blue-700",
  converted: "bg-emerald-100 text-emerald-700",
};

// ── Edit Modal ────────────────────────────────────────────────────────────────

const INTEREST_OPTIONS = ["high", "medium", "low", "none"] as const;

interface CustomFieldDef {
  name: string;
  label: string;
  options: string[];
}

function EditLeadModal({
  lead,
  onClose,
  onSave,
  isSaving,
  customFields,
}: {
  lead: any;
  onClose: () => void;
  onSave: (data: Record<string, any>) => void;
  isSaving: boolean;
  customFields: CustomFieldDef[];
}) {
  const { data: _settingsForStatus = [] } = useQuery<
    { key: string; value: string }[]
  >({
    queryKey: ["admin", "settings"],
    queryFn: () => api.get("/admin/settings").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  const statusOptions = useMemo(() => {
    const raw = _settingsForStatus.find(
      (s) => s.key === "lead_status_options",
    )?.value;
    if (!raw) return DEFAULT_STATUS_OPTIONS;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : DEFAULT_STATUS_OPTIONS;
    } catch {
      return DEFAULT_STATUS_OPTIONS;
    }
  }, [_settingsForStatus]);

  const [form, setForm] = useState({
    name: lead.name ?? "",
    phone: lead.phone ?? "",
    email: lead.email ?? "",
    source_campaign: lead.source_campaign ?? "",
    ad_set: lead.ad_set ?? "",
    course_interested_in: lead.course_interested_in ?? "",
    payment_link_url: lead.payment_link_url ?? "",
    interest_level: lead.interest_level ?? "",
    notes: lead.notes ?? "",
    callback_scheduled_at: isoToLocal(lead.callback_scheduled_at),
    next_followup_at: isoToLocal(lead.next_followup_at),
    status: lead.status ?? "new",
    intent_category: lead.intent_category ?? "new",
  });

  const [extraPairs, setExtraPairs] = useState<[string, string][]>(() => {
    const pairs: [string, string][] = Object.entries(lead.extra_data ?? {}).map(
      ([k, v]) => {
        const ft = detectFieldType(k);
        return [k, normaliseExtraValue(String(v), ft)];
      },
    );
    // Add custom-defined fields not already present
    const existingKeys = new Set(pairs.map(([k]) => k));
    for (const cf of customFields) {
      if (!existingKeys.has(cf.name)) {
        pairs.push([cf.name, ""]);
      }
    }
    return pairs;
  });

  // Build a lookup for custom field definitions by name
  const customFieldMap = useMemo(() => {
    const m = new Map<string, CustomFieldDef>();
    for (const cf of customFields) m.set(cf.name, cf);
    return m;
  }, [customFields]);

  // Per-field input type overrides for extra fields (auto-detected, user-overridable)
  const [fieldTypes, setFieldTypes] = useState<Record<string, InputType>>(
    () => {
      const init: Record<string, InputType> = {};
      for (const [k] of Object.entries(lead.extra_data ?? {})) {
        init[k] = detectFieldType(k);
      }
      return init;
    },
  );

  const f = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const cycleType = (key: string) =>
    setFieldTypes((prev) => {
      const cur = prev[key] ?? "text";
      const idx = INPUT_TYPE_CYCLE.indexOf(cur);
      const next = INPUT_TYPE_CYCLE[(idx + 1) % INPUT_TYPE_CYCLE.length];
      return { ...prev, [key]: next };
    });

  const handleSubmit = () => {
    const extra_data: Record<string, string> = {};
    for (const [k, v] of extraPairs) {
      if (k.trim()) extra_data[k.trim()] = v;
    }
    onSave({
      ...form,
      interest_level: form.interest_level || null,
      notes: form.notes || null,
      callback_scheduled_at: localToIso(form.callback_scheduled_at),
      next_followup_at: localToIso(form.next_followup_at),
      extra_data,
    });
  };

  const STANDARD_TEXT_FIELDS: [string, string, InputType][] = [
    ["name", "Name", "text"],
    ["phone", "Phone", "tel"],
    ["email", "Email", "email"],
    ["source_campaign", "Campaign", "text"],
    ["ad_set", "Ad Set", "text"],
    ["course_interested_in", "Course Interested In", "text"],
    ["payment_link_url", "Payment Link URL", "url"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-semibold text-gray-800">Edit Lead</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Standard text/url/tel/email fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {STANDARD_TEXT_FIELDS.map(([key, label, inputType]) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">
                {label}
              </label>
              <input
                type={inputType}
                value={(form as any)[key]}
                onChange={(e) => f(key, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
              />
            </div>
          ))}

          {/* Status */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Lead Status</label>
            <select
              value={form.status}
              onChange={(e) => f("status", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
            >
              {form.status && !statusOptions.includes(form.status) && (
                <option value={form.status}>{form.status}</option>
              )}
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Intent Category */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Intent Category
            </label>
            <select
              value={form.intent_category}
              onChange={(e) => f("intent_category", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
            >
              {INTENT_OPTIONS_ALL.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Interest Level */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Interest Level
            </label>
            <select
              value={form.interest_level}
              onChange={(e) => f("interest_level", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
            >
              <option value="">— Not Set —</option>
              {INTEREST_OPTIONS.map((o) => (
                <option key={o} value={o} className="capitalize">
                  {o}
                </option>
              ))}
            </select>
          </div>

          {/* Callback Scheduled At */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Callback Scheduled At
            </label>
            <input
              type="datetime-local"
              value={form.callback_scheduled_at}
              onChange={(e) => f("callback_scheduled_at", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
            />
          </div>

          {/* Next Follow-up At */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Next Follow-up At
            </label>
            <input
              type="datetime-local"
              value={form.next_followup_at}
              onChange={(e) => f("next_followup_at", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
            />
          </div>
        </div>

        {/* Notes — full width */}
        <div className="mt-4">
          <label className="block text-xs text-gray-500 mb-1">Notes</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => f("notes", e.target.value)}
            placeholder="Add call notes or context…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600] resize-none"
          />
        </div>

        {/* Extra / Campaign-context fields */}
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Campaign Context (Extra Fields)
            </p>
            <button
              onClick={() => {
                const newKey = "";
                setExtraPairs((p) => [...p, [newKey, ""]]);
                setFieldTypes((prev) => ({ ...prev, [newKey]: "text" }));
              }}
              className="text-[#FF6600] text-sm font-medium hover:underline"
            >
              + Add field
            </button>
          </div>
          <div className="space-y-2">
            {extraPairs.map(([k, v], i) => {
              const cfDef = customFieldMap.get(k);
              const itype = fieldTypes[k] ?? detectFieldType(k);
              return (
                <div key={i} className="flex gap-2 items-center">
                  {/* Key */}
                  <input
                    type="text"
                    placeholder="Field name"
                    value={k}
                    disabled={!!cfDef}
                    onChange={(e) => {
                      const newKey = e.target.value;
                      setExtraPairs((p) =>
                        p.map((x, idx) => (idx === i ? [newKey, x[1]] : x)),
                      );
                      setFieldTypes((prev) => {
                        const next = { ...prev };
                        delete next[k];
                        next[newKey] = detectFieldType(newKey);
                        return next;
                      });
                    }}
                    className={`w-1/3 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600] ${cfDef ? "bg-gray-50 text-gray-500" : ""}`}
                    title={
                      cfDef
                        ? `${cfDef.label} (custom dropdown field)`
                        : undefined
                    }
                  />
                  {/* Value — dropdown if custom field def exists, otherwise smart input */}
                  {cfDef ? (
                    <select
                      value={v}
                      onChange={(e) =>
                        setExtraPairs((p) =>
                          p.map((x, idx) =>
                            idx === i ? [x[0], e.target.value] : x,
                          ),
                        )
                      }
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
                    >
                      <option value="">— Not Set —</option>
                      {cfDef.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={itype}
                      placeholder="Value"
                      value={v}
                      onChange={(e) =>
                        setExtraPairs((p) =>
                          p.map((x, idx) =>
                            idx === i ? [x[0], e.target.value] : x,
                          ),
                        )
                      }
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
                    />
                  )}
                  {/* Type cycle button — hidden for custom dropdown fields */}
                  {!cfDef && (
                    <button
                      type="button"
                      onClick={() => cycleType(k)}
                      title={`Input type: ${itype} — click to change`}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-[#FF6600] hover:text-[#FF6600] text-xs font-bold flex-shrink-0 transition"
                    >
                      {INPUT_TYPE_ICONS[itype]}
                    </button>
                  )}
                  {/* Remove — disabled for custom dropdown fields */}
                  <button
                    disabled={!!cfDef}
                    onClick={() =>
                      setExtraPairs((p) => p.filter((_, idx) => idx !== i))
                    }
                    className={`text-lg leading-none px-1 flex-shrink-0 ${cfDef ? "text-gray-200 cursor-not-allowed" : "text-red-400 hover:text-red-600"}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
            {extraPairs.length === 0 && (
              <p className="text-sm text-gray-400 italic">
                No extra fields. Click "+ Add field" to add one.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-5 py-2 rounded-lg bg-[#FF6600] text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition"
          >
            {isSaving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function useLeadStatusOptions(): string[] {
  const { data: settings = [] } = useQuery<{ key: string; value: string }[]>({
    queryKey: ["admin", "settings"],
    queryFn: () => api.get("/admin/settings").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  return useMemo(() => {
    const raw = settings.find((s) => s.key === "lead_status_options")?.value;
    if (!raw) return DEFAULT_STATUS_OPTIONS;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : DEFAULT_STATUS_OPTIONS;
    } catch {
      return DEFAULT_STATUS_OPTIONS;
    }
  }, [settings]);
}

export default function LeadDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const statusOptions = useLeadStatusOptions();
  const [notes, setNotes] = useState("");
  const [conversationDraft, setConversationDraft] = useState<string | null>(
    null,
  );
  const [showEditModal, setShowEditModal] = useState(false);

  const refreshLeadViews = (nextLead?: any) => {
    if (nextLead) queryClient.setQueryData(["lead", id], nextLead);
    void queryClient.invalidateQueries({ queryKey: ["lead", id] });
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
    void queryClient.invalidateQueries({ queryKey: ["analytics"] });
    void queryClient.invalidateQueries({ queryKey: ["my-leads"] });
  };

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: () => api.get(`/leads/${id}`).then((r) => r.data),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === "contacted" ? 5000 : false;
    },
  });

  const { data: calls = [] } = useQuery({
    queryKey: ["lead-calls", id],
    queryFn: () =>
      api
        .get("/calls", { params: { lead_id: id, limit: 100 } })
        .then((r) => r.data),
    enabled: !!id,
  });

  const updateLead = useMutation({
    mutationFn: (data: Record<string, any>) =>
      api.patch(`/leads/${id}`, data).then((r) => r.data),
    onSuccess: (nextLead) => refreshLeadViews(nextLead),
  });

  const classifyIntent = useMutation({
    mutationFn: () => api.post(`/leads/${id}/classify`).then((r) => r.data),
    onSuccess: (nextLead) => refreshLeadViews(nextLead),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get("/agents/").then((r) => r.data),
  });

  // Fetch custom dropdown field definitions from admin settings
  const { data: customFields = [] } = useQuery<CustomFieldDef[]>({
    queryKey: ["custom-field-definitions"],
    queryFn: async () => {
      const res = await api.get("/admin/settings");
      const row = (res.data as any[]).find(
        (s: any) => s.key === "custom_field_definitions",
      );
      if (!row?.value) return [];
      try {
        return JSON.parse(row.value);
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });

  const assignAgent = useMutation({
    mutationFn: (agentId: string) =>
      api
        .post(`/leads/${id}/assign`, null, { params: { agent_id: agentId } })
        .then((r) => r.data),
    onSuccess: (nextLead) => refreshLeadViews(nextLead),
  });

  const markNoAnswer = useMutation({
    mutationFn: () => api.post(`/leads/${id}/no-answer`).then((r) => r.data),
    onSuccess: (nextLead) => refreshLeadViews(nextLead),
  });

  if (isLoading)
    return (
      <div className="min-h-screen bg-gray-50">
        <NavBar active="leads" />
        <DetailSkeleton />
      </div>
    );
  if (!lead)
    return (
      <div className="flex justify-center py-20 text-red-400">
        Lead not found
      </div>
    );

  const conversationText =
    conversationDraft !== null
      ? conversationDraft
      : (lead.conversation_summary ?? "");

  return (
    <div className="min-h-screen bg-gray-50">
      {showEditModal && (
        <EditLeadModal
          lead={lead}
          onClose={() => setShowEditModal(false)}
          isSaving={updateLead.isPending}
          customFields={customFields}
          onSave={(data) => {
            updateLead.mutate(data, {
              onSuccess: () => setShowEditModal(false),
            });
          }}
        />
      )}

      <NavBar
        active="leads"
        breadcrumb={{ label: "Back to Leads", to: "/leads" }}
      />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Profile card */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{lead.name}</h2>
              <p className="text-gray-500 mt-1">{lead.phone}</p>
              {lead.email && (
                <p className="text-gray-400 text-sm">{lead.email}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="text-xs text-[#FF6600] border border-[#FF6600] rounded-lg px-3 py-1.5 hover:bg-orange-50 transition font-medium"
              >
                ✏ Edit Lead
              </button>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                  Lead Status
                </span>
                <select
                  value={lead.status}
                  onChange={(e) => updateLead.mutate({ status: e.target.value })}
                  className="border-2 border-[#FF6600] bg-white rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#FF6600] focus:ring-offset-1 cursor-pointer min-w-[160px]"
                >
                  {/* Keep current value selectable even if not in the list */}
                  {lead.status && !statusOptions.includes(lead.status) && (
                    <option value={lead.status}>{lead.status}</option>
                  )}
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {lead.intent_category && (
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${INTENT_COLORS[lead.intent_category] ?? "bg-gray-100"}`}
                >
                  {lead.intent_category.replace(/_/g, " ")}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 text-sm">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">
                Campaign
              </p>
              <p className="font-medium text-gray-700">
                {lead.source_campaign || "—"}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">
                Course Interest
              </p>
              <p className="font-medium text-gray-700">
                {lead.course_interested_in || "—"}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">
                Interest Level
              </p>
              <p className="font-medium text-gray-700">
                {lead.interest_level || "—"}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">
                Follow-ups
              </p>
              <p className="font-medium text-gray-700">
                {lead.followup_count ?? 0}
              </p>
            </div>
          </div>

          {lead.callback_scheduled_at && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-sm text-yellow-800">
              Callback scheduled:{" "}
              {new Date(lead.callback_scheduled_at).toLocaleString()}
            </div>
          )}

          {lead.objections && (
            <div className="mt-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                Objections
              </p>
              <p className="text-sm text-gray-600">{lead.objections}</p>
            </div>
          )}

          {lead.extra_data && Object.keys(lead.extra_data).length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
                Campaign Context
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                {Object.entries(lead.extra_data).map(([key, val]) => (
                  <div key={key}>
                    <p className="text-xs text-gray-500 font-medium">{key}</p>
                    <p className="text-sm text-gray-800 break-words">
                      {typeof val === "object"
                        ? JSON.stringify(val)
                        : String(val)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 border-t pt-4 flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">
                Assigned Agent
              </p>
              <p className="font-medium text-gray-700">
                {agents.find((a: any) => a.id === lead.assigned_agent_id)
                  ?.name || "Unassigned"}
              </p>
            </div>
            <select
              value={lead.assigned_agent_id || ""}
              onChange={(e) => assignAgent.mutate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
              disabled={assignAgent.isPending}
            >
              <option value="" disabled>
                Assign to...
              </option>
              {agents.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => markNoAnswer.mutate()}
            disabled={markNoAnswer.isPending}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            📵 No Answer
          </button>
          <button
            onClick={() =>
              updateLead.mutate({
                status: "lost",
                intent_category: "not_interested",
              })
            }
            className="bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            ✕ Not Interested
          </button>
          <button
            onClick={() => updateLead.mutate({ status: "qualified" })}
            className="bg-green-50 hover:bg-green-100 text-green-700 text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            ✓ Qualify
          </button>
          <button
            onClick={() => updateLead.mutate({ status: "payment_sent" })}
            className="bg-orange-50 hover:bg-orange-100 text-orange-700 text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            💳 Payment Sent
          </button>
          <button
            onClick={() => updateLead.mutate({ status: "converted" })}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            🎉 Converted
          </button>
        </div>

        {/* Conversation Summary */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-700">
              Conversation Summary
            </h3>
            <button
              onClick={() => {
                if (classifyIntent.isPending) return;
                const save =
                  conversationDraft !== null &&
                  conversationDraft !== lead.conversation_summary
                    ? updateLead.mutateAsync({
                        conversation_summary: conversationDraft,
                      })
                    : Promise.resolve();
                save.then(() => {
                  setConversationDraft(null);
                  classifyIntent.mutate();
                });
              }}
              disabled={
                classifyIntent.isPending ||
                updateLead.isPending ||
                !conversationText.trim()
              }
              title={
                !conversationText.trim()
                  ? "Add a conversation summary first"
                  : "Classify intent using AI"
              }
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition"
            >
              {classifyIntent.isPending ? "⟳" : "✦"}{" "}
              {classifyIntent.isPending ? "Classifying…" : "Classify Intent"}
            </button>
          </div>

          {classifyIntent.isSuccess && (
            <div className="mb-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 text-sm text-indigo-700">
              Intent classified:{" "}
              <span className="font-semibold">
                {lead.intent_category?.replace(/_/g, " ")}
              </span>
              {lead.intent_confidence != null &&
                ` (${(lead.intent_confidence * 100).toFixed(0)}% confidence)`}
            </div>
          )}

          {classifyIntent.isError && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-600">
              Classification failed. Please try again.
            </div>
          )}

          <p className="text-xs text-gray-400 mb-2">
            Summarise what was discussed with this lead. Used by AI to classify
            intent.
          </p>
          <textarea
            rows={5}
            placeholder="e.g. Parent called asking about summer camp for 8-year-old. Interested in the July batch, has budget concerns, wants to discuss with spouse first. Will call back Friday."
            value={conversationText}
            onChange={(e) => setConversationDraft(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600] resize-y"
          />
          {conversationDraft !== null &&
            conversationDraft !== lead.conversation_summary && (
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => setConversationDraft(null)}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 rounded transition"
                >
                  Discard
                </button>
                <button
                  onClick={() => {
                    updateLead.mutate(
                      { conversation_summary: conversationDraft },
                      { onSuccess: () => setConversationDraft(null) },
                    );
                  }}
                  disabled={updateLead.isPending}
                  className="bg-[#FF6600] text-white text-sm px-4 py-1.5 rounded-lg hover:bg-orange-600 disabled:opacity-50 transition"
                >
                  {updateLead.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Notes</h3>
          <p className="text-sm text-gray-500 mb-3 whitespace-pre-wrap">
            {lead.notes || "No notes yet."}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a note…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
            />
            <button
              onClick={() => {
                if (!notes.trim()) return;
                const updated = lead.notes
                  ? `${lead.notes}\n${new Date().toLocaleDateString()} - ${notes}`
                  : `${new Date().toLocaleDateString()} - ${notes}`;
                updateLead.mutate({ notes: updated });
                setNotes("");
              }}
              className="bg-[#FF6600] text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600 transition"
            >
              Save
            </button>
          </div>
        </div>

        {/* Call history */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-3">
            Call History ({calls.length})
          </h3>
          {calls.length === 0 && (
            <p className="text-gray-400 text-sm">No calls recorded yet</p>
          )}
          <div className="space-y-3">
            {calls.map((call: any) => (
              <Link
                key={call.id}
                to={`/calls/${call.id}`}
                className="block bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {formatDistanceToNow(new Date(call.recorded_at), {
                        addSuffix: true,
                      })}
                    </p>
                    {call.summary && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {call.summary}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {call.intent_category && (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${INTENT_COLORS[call.intent_category] ?? "bg-gray-100"}`}
                      >
                        {call.intent_category.replace(/_/g, " ")}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 capitalize">
                      {call.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

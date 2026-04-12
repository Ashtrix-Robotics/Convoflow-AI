import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import NavBar from "../components/NavBar";
import { SettingsSkeleton } from "../components/Skeleton";
import api from "../services/api";

const SETTING_LABELS: Record<
  string,
  { label: string; hint: string; type: "toggle" | "text" }
> = {
  auto_whatsapp_mode: {
    label: "Auto WhatsApp Mode",
    hint: "When ON, AI automatically sends a WhatsApp message to every new lead — no sales agent call needed.",
    type: "toggle",
  },
  auto_whatsapp_campaign: {
    label: "Campaign to use for Auto Mode",
    hint: "Leave blank to use the campaign marked as Default in the Campaigns page.",
    type: "text",
  },
  whatsapp_reply_ai_enabled: {
    label: "AI Auto-Reply to Inbound Messages",
    hint: "When ON, the AI will automatically reply to inbound WhatsApp messages from leads.",
    type: "toggle",
  },
};

interface Setting {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

interface CustomFieldDef {
  name: string;
  label: string;
  options: string[];
}

function CustomFieldsEditor({
  settings,
  onSave,
  isSaving,
}: {
  settings: Setting[];
  onSave: (value: string) => void;
  isSaving: boolean;
}) {
  const raw =
    settings.find((s) => s.key === "custom_field_definitions")?.value ?? "[]";
  const [fields, setFields] = useState<CustomFieldDef[]>(() => {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  });
  const [newName, setNewName] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newOptions, setNewOptions] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editOptions, setEditOptions] = useState("");

  // Sync when server data changes
  useEffect(() => {
    try {
      setFields(JSON.parse(raw));
    } catch {
      /* keep current */
    }
  }, [raw]);

  const handleAdd = () => {
    const name = newName.trim().toLowerCase().replace(/\s+/g, "_");
    const label = newLabel.trim() || name;
    const opts = newOptions
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    if (!name || opts.length === 0) return;
    const next = [...fields, { name, label, options: opts }];
    setFields(next);
    onSave(JSON.stringify(next));
    setNewName("");
    setNewLabel("");
    setNewOptions("");
  };

  const handleRemove = (idx: number) => {
    const next = fields.filter((_, i) => i !== idx);
    setFields(next);
    onSave(JSON.stringify(next));
  };

  const handleEditSave = (idx: number) => {
    const opts = editOptions
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    if (opts.length === 0) return;
    const next = fields.map((f, i) =>
      i === idx ? { ...f, options: opts } : f,
    );
    setFields(next);
    onSave(JSON.stringify(next));
    setEditIdx(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-purple-200">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">📋</span>
        <h3 className="font-bold text-gray-800 text-lg">
          Custom Dropdown Fields
        </h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Define fields with predefined dropdown options. These will appear as
        dropdowns in the Edit Lead modal for all leads.
      </p>

      {fields.length > 0 && (
        <div className="space-y-2 mb-4">
          {fields.map((f, idx) => (
            <div
              key={f.name}
              className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">
                  {f.label}{" "}
                  <span className="text-xs text-gray-400 font-normal">
                    ({f.name})
                  </span>
                </p>
                {editIdx === idx ? (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={editOptions}
                      onChange={(e) => setEditOptions(e.target.value)}
                      className="flex-1 border rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none"
                      placeholder="Option1, Option2, Option3"
                    />
                    <button
                      onClick={() => handleEditSave(idx)}
                      className="text-xs bg-purple-600 text-white px-3 py-1 rounded-lg hover:bg-purple-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditIdx(null)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {f.options.map((o) => (
                      <span
                        key={o}
                        className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full"
                      >
                        {o}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setEditIdx(idx);
                  setEditOptions(f.options.join(", "));
                }}
                className="text-xs text-gray-400 hover:text-purple-600 mt-1"
                title="Edit options"
              >
                ✏
              </button>
              <button
                onClick={() => handleRemove(idx)}
                className="text-xs text-gray-400 hover:text-red-600 mt-1"
                title="Remove field"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 space-y-2">
        <p className="text-xs text-purple-700 font-semibold uppercase tracking-wide">
          Add New Field
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Field key (e.g. course_type)"
            className="border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none"
          />
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Display label (e.g. Course Type)"
            className="border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none"
          />
        </div>
        <input
          value={newOptions}
          onChange={(e) => setNewOptions(e.target.value)}
          placeholder="Comma-separated options: Online, Offline, Hybrid"
          className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none"
        />
        <button
          onClick={handleAdd}
          disabled={isSaving || !newName.trim() || !newOptions.trim()}
          className="bg-purple-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Add Field"}
        </button>
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const qc = useQueryClient();

  const { data: settings = [], isLoading } = useQuery<Setting[]>({
    queryKey: ["admin", "settings"],
    queryFn: () => api.get("/admin/settings").then((r) => r.data),
  });

  const { data: sheetsStatus } = useQuery<{
    configured: boolean;
    spreadsheet_url: string | null;
    source_sheet_name: string;
  }>({
    queryKey: ["admin", "sheets-status"],
    queryFn: () => api.get("/admin/sheets/status").then((r) => r.data),
    retry: false,
  });

  const { data: worksheetsData } = useQuery<{ worksheets: string[] }>({
    queryKey: ["admin", "sheets-worksheets"],
    queryFn: () => api.get("/admin/sheets/worksheets").then((r) => r.data),
    enabled: !!sheetsStatus?.configured,
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api.put(`/admin/settings/${key}`, { value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "settings"] }),
  });

  const [testPhone, setTestPhone] = useState("");
  const [testName, setTestName] = useState("");
  const [testCampaign, setTestCampaign] = useState("");
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    phone_normalised: string;
    campaign_used: string | null;
    provider_response: object;
  } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    rows_written: number;
    spreadsheet_id: string;
  } | null>(null);

  const [pullLoading, setPullLoading] = useState(false);
  const [pullResult, setPullResult] = useState<{
    created?: number;
    updated?: number;
    merged?: number;
    skipped?: number;
    skip_reasons?: string[];
    total_rows?: number;
    sheet_name?: string;
    error?: string;
  } | null>(null);

  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeResult, setPurgeResult] = useState<{ deleted: number } | null>(
    null,
  );

  const [sourceSheetName, setSourceSheetName] = useState("");
  const [sourceSheetSaving, setSourceSheetSaving] = useState(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    impact: string;
    confirmLabel: string;
    variant: "danger" | "warning" | "info";
    onConfirm: () => void;
  } | null>(null);

  // Sync source sheet name from server
  const currentSourceSheet = sheetsStatus?.source_sheet_name ?? "";
  const worksheets = worksheetsData?.worksheets ?? [];

  // Set dropdown default when server data arrives
  useEffect(() => {
    if (currentSourceSheet && !sourceSheetName) {
      setSourceSheetName(currentSourceSheet);
    }
  }, [currentSourceSheet]);

  const saveSourceSheet = async () => {
    setSourceSheetSaving(true);
    try {
      await api.put("/admin/sheets/source-sheet", {
        value: sourceSheetName || currentSourceSheet,
      });
      qc.invalidateQueries({ queryKey: ["admin", "sheets-status"] });
    } catch {
      // ignore
    } finally {
      setSourceSheetSaving(false);
    }
  };

  const runSync = async () => {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const res = await api.post("/admin/sheets/sync");
      setSyncResult(res.data);
    } catch {
      // handled below
    } finally {
      setSyncLoading(false);
      setConfirmModal(null);
    }
  };

  const runPull = async () => {
    setPullLoading(true);
    setPullResult(null);
    try {
      await api.post("/admin/sheets/pull");
      // Poll for completion
      const poll = async (): Promise<void> => {
        const res = await api.get("/admin/sheets/pull-status");
        if (res.data.status === "done") {
          setPullResult(res.data);
          qc.invalidateQueries({ queryKey: ["leads"] });
          setPullLoading(false);
          setConfirmModal(null);
        } else if (res.data.status === "error") {
          setPullResult({ error: res.data.detail || "Pull failed" });
          setPullLoading(false);
          setConfirmModal(null);
        } else {
          await new Promise((r) => setTimeout(r, 3000));
          return poll();
        }
      };
      await poll();
    } catch {
      setPullLoading(false);
      setConfirmModal(null);
    }
  };

  const runPurge = async () => {
    setPurgeLoading(true);
    setPurgeResult(null);
    try {
      const res = await api.delete("/admin/leads/purge");
      setPurgeResult(res.data);
      // Invalidate all related queries so every page reflects the empty state
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["calls"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    } catch {
      // handled below
    } finally {
      setPurgeLoading(false);
      setConfirmModal(null);
    }
  };

  const getValue = (key: string) =>
    settings.find((s) => s.key === key)?.value ?? "";

  const handleToggle = (key: string) => {
    const current = getValue(key) === "true";
    updateMutation.mutate({ key, value: (!current).toString() });
  };

  const handleText = (key: string, value: string) => {
    updateMutation.mutate({ key, value });
  };

  const runTest = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await api.post("/admin/whatsapp/test", {
        name: testName,
        phone: testPhone,
        campaign_name: testCampaign || undefined,
        template_params: [],
      });
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.response?.data?.detail ?? "Request failed",
        phone_normalised: "",
        campaign_used: null,
        provider_response: err?.response?.data ?? {},
      });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar active="admin" />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Admin Settings</h2>
          <p className="text-sm text-gray-500 mt-1">
            Control automation behaviour for WhatsApp and AI responses.
          </p>
        </div>

        {/* Sub-nav */}
        <div className="flex gap-3">
          <Link
            to="/admin/settings"
            className="px-4 py-2 rounded-lg bg-[#002147] text-white text-sm font-medium"
          >
            Settings
          </Link>
          <Link
            to="/admin/campaigns"
            className="px-4 py-2 rounded-lg bg-white border text-gray-700 text-sm font-medium hover:bg-gray-50"
          >
            Campaigns
          </Link>
        </div>

        {/* Toggles / Text settings */}
        {isLoading ? (
          <SettingsSkeleton />
        ) : (
          <div className="space-y-4">
            {Object.entries(SETTING_LABELS).map(([key, meta]) => (
              <div key={key} className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{meta.label}</p>
                    <p className="text-sm text-gray-500 mt-1">{meta.hint}</p>
                  </div>
                  {meta.type === "toggle" ? (
                    <button
                      onClick={() => handleToggle(key)}
                      disabled={updateMutation.isPending}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                        getValue(key) === "true"
                          ? "bg-green-500"
                          : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${getValue(key) === "true" ? "translate-x-5" : "translate-x-0"}`}
                      />
                    </button>
                  ) : (
                    <input
                      type="text"
                      defaultValue={getValue(key)}
                      placeholder="campaign_name_here"
                      onBlur={(e) => handleText(key, e.target.value)}
                      className="border rounded-lg px-3 py-2 text-sm w-56 focus:ring-2 focus:ring-orange-400 focus:outline-none"
                    />
                  )}
                </div>
                {meta.type === "toggle" && (
                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getValue(key) === "true" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      {getValue(key) === "true" ? "ENABLED" : "DISABLED"}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Custom Dropdown Fields */}
        {!isLoading && (
          <CustomFieldsEditor
            settings={settings}
            onSave={(value) =>
              updateMutation.mutate({ key: "custom_field_definitions", value })
            }
            isSaving={updateMutation.isPending}
          />
        )}

        {/* Test WhatsApp send */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-orange-200">
          <h3 className="font-bold text-gray-800 text-lg">
            🧪 Test WhatsApp Send
          </h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Send a test message to a specific number only. Does not affect any
            other leads.
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 font-medium">Name</label>
              <input
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                placeholder="Sreenath"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">
                Phone Number
              </label>
              <input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                placeholder="9502718666"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 font-medium">
                Campaign Name{" "}
                <span className="text-gray-400">(leave blank for default)</span>
              </label>
              <input
                value={testCampaign}
                onChange={(e) => setTestCampaign(e.target.value)}
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                placeholder="my_aisensy_campaign_name"
              />
            </div>
          </div>
          <button
            onClick={runTest}
            disabled={testLoading || !testName || !testPhone}
            className="bg-[#FF6600] text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
          >
            {testLoading ? "Sending…" : "Send Test Message"}
          </button>

          {testResult && (
            <div
              className={`mt-4 p-4 rounded-lg text-sm ${testResult.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}
            >
              <p
                className={`font-semibold ${testResult.success ? "text-green-700" : "text-red-700"}`}
              >
                {testResult.success ? "✅ " : "❌ "}
                {testResult.message}
              </p>
              {testResult.phone_normalised && (
                <p className="text-gray-600 mt-1">
                  Sent to: <strong>{testResult.phone_normalised}</strong>
                </p>
              )}
              {testResult.campaign_used && (
                <p className="text-gray-600">
                  Campaign: <strong>{testResult.campaign_used}</strong>
                </p>
              )}
              {!testResult.success && (
                <pre className="mt-2 text-xs text-red-600 overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(testResult.provider_response, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
        {/* Google Sheets sync */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-green-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">📊</span>
            <h3 className="font-bold text-gray-800 text-lg">
              Google Sheets Sync
            </h3>
            <span
              className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
                sheetsStatus?.configured
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {sheetsStatus?.configured ? "CONFIGURED" : "NOT CONFIGURED"}
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Manage the link between your Google Sheet and the application
            database.
          </p>
          {sheetsStatus?.spreadsheet_url && (
            <a
              href={sheetsStatus.spreadsheet_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-4 block"
            >
              📄 Open Spreadsheet ↗
            </a>
          )}

          {/* Source sheet tab selector */}
          {sheetsStatus?.configured && (
            <div className="mb-5 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <label className="text-xs text-gray-500 font-medium block mb-1">
                Source Sheet Tab
              </label>
              <p className="text-xs text-gray-400 mb-2">
                Select the worksheet tab where inbound leads arrive (from Meta
                ads).
              </p>
              <div className="flex gap-2">
                {worksheets.length > 0 ? (
                  <select
                    value={sourceSheetName || currentSourceSheet || "Sheet1"}
                    onChange={(e) => setSourceSheetName(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm flex-1 focus:ring-2 focus:ring-green-400 focus:outline-none bg-white"
                  >
                    {worksheets.map((ws) => (
                      <option key={ws} value={ws}>
                        {ws}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={sourceSheetName || currentSourceSheet}
                    onChange={(e) => setSourceSheetName(e.target.value)}
                    placeholder="Sheet1"
                    className="border rounded-lg px-3 py-2 text-sm flex-1 focus:ring-2 focus:ring-green-400 focus:outline-none"
                  />
                )}
                <button
                  onClick={saveSourceSheet}
                  disabled={sourceSheetSaving}
                  className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
                >
                  {sourceSheetSaving ? "Saving…" : "Save"}
                </button>
              </div>
              {currentSourceSheet && (
                <p className="mt-2 text-xs text-gray-500">
                  Current: <strong>{currentSourceSheet}</strong>
                </p>
              )}
            </div>
          )}

          {/* Action buttons */}
          {sheetsStatus?.configured && (
            <div className="space-y-3">
              {/* Pull from Sheet */}
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-800">
                    ⬇️ Pull Leads from Sheet
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Import leads from the source sheet tab into the database.
                    Deduplicates by phone number — existing leads are updated,
                    new ones are created.
                  </p>
                  {pullResult &&
                    (pullResult.error ? (
                      <div className="mt-2 text-xs bg-red-100 text-red-700 rounded p-2">
                        ❌ {pullResult.error}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs bg-blue-100 rounded p-2 space-y-1">
                        <p>
                          ✅ From &quot;{pullResult.sheet_name}&quot; (
                          {pullResult.total_rows} rows)
                        </p>
                        <p>
                          📥 <strong>{pullResult.created}</strong> new leads
                          created
                        </p>
                        <p>
                          🔄 <strong>{pullResult.updated}</strong> existing
                          leads updated
                        </p>
                        {(pullResult.merged ?? 0) > 0 && (
                          <p>
                            🔗 <strong>{pullResult.merged}</strong> same-phone
                            rows merged (e.g. same parent, multiple children)
                          </p>
                        )}
                        {(pullResult.skipped ?? 0) > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-yellow-700 font-medium">
                              ⚠️ {pullResult.skipped} rows skipped (missing
                              name/phone or bad format) — click to expand
                            </summary>
                            <ul className="mt-1 ml-3 space-y-0.5 text-yellow-800">
                              {(pullResult.skip_reasons ?? []).map((r, i) => (
                                <li key={i}>• {r}</li>
                              ))}
                              {(pullResult.skipped ?? 0) >
                                (pullResult.skip_reasons?.length ?? 0) && (
                                <li className="text-gray-500">
                                  … and{" "}
                                  {(pullResult.skipped ?? 0) -
                                    (pullResult.skip_reasons?.length ?? 0)}{" "}
                                  more
                                </li>
                              )}
                            </ul>
                          </details>
                        )}
                      </div>
                    ))}
                </div>
                <button
                  onClick={() =>
                    setConfirmModal({
                      open: true,
                      title: "Pull Leads from Google Sheet",
                      description: `This will read all rows from "${sourceSheetName || currentSourceSheet || "Sheet1"}" and import them into the database.`,
                      impact:
                        "• New leads will be created for phone numbers not already in the database.\n• Existing leads (matched by phone) will have their fields updated.\n• No leads will be deleted.\n• This does NOT affect the Google Sheet itself.",
                      confirmLabel: "Pull Leads",
                      variant: "info",
                      onConfirm: runPull,
                    })
                  }
                  disabled={pullLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {pullLoading ? "Pulling…" : "Pull from Sheet"}
                </button>
              </div>

              {/* Push to Sheet */}
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-800">
                    ⬆️ Push Leads to Sheet
                  </p>
                  <p className="text-xs text-green-600 mt-0.5">
                    Overwrites the &quot;Convoflow Leads&quot; tab with all
                    current database leads. The source tab is NOT affected.
                  </p>
                  {syncResult && (
                    <div className="mt-2 text-xs bg-green-100 rounded p-2">
                      ✅ Synced <strong>{syncResult.rows_written}</strong> leads
                      to sheet
                    </div>
                  )}
                </div>
                <button
                  onClick={() =>
                    setConfirmModal({
                      open: true,
                      title: "Push All Leads to Google Sheet",
                      description:
                        'This will clear the "Convoflow Leads" tab and rewrite it with all leads currently in the database.',
                      impact:
                        '• The "Convoflow Leads" tab will be completely cleared and rewritten.\n• Your source leads tab is NOT affected.\n• Any manual edits made directly in "Convoflow Leads" will be lost.\n• This is useful to re-sync after changes.',
                      confirmLabel: "Push to Sheet",
                      variant: "warning",
                      onConfirm: runSync,
                    })
                  }
                  disabled={syncLoading}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {syncLoading ? "Syncing…" : "Push to Sheet"}
                </button>
              </div>

              {/* Purge all leads */}
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800">
                    🗑️ Purge All Leads
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Permanently delete ALL leads from the database. Use this
                    before a fresh pull from sheet.
                  </p>
                  {purgeResult && (
                    <div className="mt-2 text-xs bg-red-100 rounded p-2">
                      🗑️ Deleted <strong>{purgeResult.deleted}</strong> leads
                      from database
                    </div>
                  )}
                </div>
                <button
                  onClick={() =>
                    setConfirmModal({
                      open: true,
                      title: "⚠️ Purge All Leads — Irreversible!",
                      description:
                        "This will PERMANENTLY DELETE every lead from the database. This action cannot be undone.",
                      impact:
                        "• ALL leads will be permanently deleted from the database.\n• Call records will be unlinked (not deleted) from leads.\n• WhatsApp conversations linked to leads will be deleted.\n• The Google Sheet is NOT affected — you can re-import with Pull.\n• Agent assignments and follow-up data on leads will be lost.",
                      confirmLabel: "Delete All Leads",
                      variant: "danger",
                      onConfirm: runPurge,
                    })
                  }
                  disabled={purgeLoading}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {purgeLoading ? "Deleting…" : "Purge All"}
                </button>
              </div>
            </div>
          )}

          {!sheetsStatus?.configured && (
            <p className="mt-3 text-xs text-gray-400">
              Set <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> and{" "}
              <code>GOOGLE_SPREADSHEET_ID</code> in your Render environment
              variables to enable.
            </p>
          )}
        </div>

        {/* Confirmation Modal */}
        {confirmModal?.open && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <h3
                className={`text-lg font-bold mb-2 ${
                  confirmModal.variant === "danger"
                    ? "text-red-700"
                    : confirmModal.variant === "warning"
                      ? "text-amber-700"
                      : "text-blue-700"
                }`}
              >
                {confirmModal.title}
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                {confirmModal.description}
              </p>
              <div
                className={`text-xs p-3 rounded-lg mb-4 whitespace-pre-line ${
                  confirmModal.variant === "danger"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : confirmModal.variant === "warning"
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-blue-50 text-blue-700 border border-blue-200"
                }`}
              >
                <p className="font-semibold mb-1">Impact:</p>
                {confirmModal.impact}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  disabled={pullLoading || syncLoading || purgeLoading}
                  className={`px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 ${
                    confirmModal.variant === "danger"
                      ? "bg-red-600 hover:bg-red-700"
                      : confirmModal.variant === "warning"
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {pullLoading || syncLoading || purgeLoading
                    ? "Processing…"
                    : confirmModal.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

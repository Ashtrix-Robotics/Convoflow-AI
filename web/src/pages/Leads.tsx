import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import NavBar from "../components/NavBar";
import { PipelineSkeleton, TableSkeleton } from "../components/Skeleton";
import api from "../services/api";

const PIPELINE_COLUMNS = [
  { key: "new", label: "New", color: "bg-blue-500" },
  { key: "contacted", label: "Contacted", color: "bg-yellow-500" },
  { key: "qualified", label: "Qualified", color: "bg-purple-500" },
  { key: "payment_sent", label: "Payment Sent", color: "bg-orange-500" },
  { key: "converted", label: "Converted", color: "bg-green-500" },
  { key: "lost", label: "Lost", color: "bg-red-500" },
] as const;

const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "payment_sent",
  "converted",
  "lost",
];
const INTENT_CATEGORIES = [
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
  new: "bg-slate-100 text-slate-600",
};

export default function Leads() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterIntent, setFilterIntent] = useState("");
  const [view, setView] = useState<"pipeline" | "list">("pipeline");

  // Bulk selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkIntent, setBulkIntent] = useState("");
  const [bulkAgentId, setBulkAgentId] = useState("");
  const [bulkMsg, setBulkMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Extra-data column filter
  const [filterExtraKey, setFilterExtraKey] = useState("");
  const [filterExtraValue, setFilterExtraValue] = useState("");

  // Column visibility — tracks which extra_data keys are shown as columns
  const [visibleExtraCols, setVisibleExtraCols] = useState<Set<string>>(
    new Set(),
  );
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        colMenuRef.current &&
        !colMenuRef.current.contains(e.target as Node)
      ) {
        setShowColMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", search, filterIntent],
    queryFn: () =>
      api
        .get("/leads", {
          params: {
            search: search || undefined,
            intent_category: filterIntent || undefined,
            limit: 500,
          },
        })
        .then((r) => r.data),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: () =>
      api
        .get("/agents/")
        .then((r) => r.data)
        .catch(() => []),
  });

  const bulkMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post("/leads/bulk", payload).then((r) => r.data),
    onSuccess: (result) => {
      const acted = (result.updated || 0) + (result.deleted || 0);
      setBulkMsg({
        type: "success",
        text: `Done: ${acted} lead(s) updated${result.failed ? `, ${result.failed} failed` : ""}.`,
      });
      setSelected(new Set());
      setBulkAction("");
      setBulkStatus("");
      setBulkIntent("");
      setBulkAgentId("");
      setConfirmDelete(false);
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      setTimeout(() => setBulkMsg(null), 5000);
    },
    onError: (err: any) => {
      setBulkMsg({
        type: "error",
        text: err?.response?.data?.detail ?? "Bulk action failed.",
      });
    },
  });

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === leads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leads.map((l: any) => l.id)));
    }
  }, [leads, selected.size]);

  const runBulk = () => {
    if (!bulkAction || selected.size === 0) return;
    if (bulkAction === "delete" && !confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const payload: Record<string, unknown> = {
      lead_ids: Array.from(selected),
      action: bulkAction,
    };
    if (bulkAction === "change_status") payload.status = bulkStatus;
    if (bulkAction === "change_intent") payload.intent_category = bulkIntent;
    if (bulkAction === "assign") payload.agent_id = bulkAgentId;
    bulkMutation.mutate(payload);
  };

  const grouped = PIPELINE_COLUMNS.map((col) => ({
    ...col,
    leads: leads.filter((l: any) => l.status === col.key),
  }));

  // Collect all unique extra_data keys across loaded leads
  const extraKeys = useMemo<string[]>(() => {
    const keys = new Set<string>();
    for (const lead of leads) {
      if (lead.extra_data && typeof lead.extra_data === "object") {
        for (const k of Object.keys(lead.extra_data)) keys.add(k);
      }
    }
    return Array.from(keys).sort();
  }, [leads]);

  // Apply extra_data filter on top of server-filtered results
  const filteredLeads = useMemo(() => {
    if (!filterExtraKey || !filterExtraValue.trim()) return leads;
    const val = filterExtraValue.trim().toLowerCase();
    return leads.filter((l: any) => {
      const v = l.extra_data?.[filterExtraKey];
      return v != null && String(v).toLowerCase().includes(val);
    });
  }, [leads, filterExtraKey, filterExtraValue]);

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar active="leads" />

      <main className="px-4 py-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4 max-w-7xl mx-auto">
          <input
            type="text"
            placeholder="Search leads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
          />
          <select
            value={filterIntent}
            onChange={(e) => setFilterIntent(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
          >
            <option value="">All Intents</option>
            <option value="interested">Interested</option>
            <option value="callback_requested">Callback</option>
            <option value="payment_pending">Payment Pending</option>
            <option value="not_interested">Not Interested</option>
            <option value="no_answer">No Answer</option>
            <option value="future_planning">Future Planning</option>
          </select>

          {/* Extra-data filters */}
          {extraKeys.length > 0 && (
            <>
              <select
                value={filterExtraKey}
                onChange={(e) => {
                  setFilterExtraKey(e.target.value);
                  setFilterExtraValue("");
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
              >
                <option value="">Filter by field…</option>
                {extraKeys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              {filterExtraKey && (
                <input
                  type="text"
                  placeholder={`Value for ${filterExtraKey}…`}
                  value={filterExtraValue}
                  onChange={(e) => setFilterExtraValue(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
                />
              )}
            </>
          )}

          {/* Column visibility (list view only) */}
          {view === "list" && extraKeys.length > 0 && (
            <div className="relative" ref={colMenuRef}>
              <button
                onClick={() => setShowColMenu((v) => !v)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition flex items-center gap-1.5"
                title="Show/hide extra columns"
              >
                ⚙ Columns
              </button>
              {showColMenu && (
                <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-52 space-y-1.5">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">
                    Extra columns
                  </p>
                  {extraKeys.map((k) => (
                    <label
                      key={k}
                      className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:text-gray-900"
                    >
                      <input
                        type="checkbox"
                        checked={visibleExtraCols.has(k)}
                        onChange={() =>
                          setVisibleExtraCols((prev) => {
                            const next = new Set(prev);
                            next.has(k) ? next.delete(k) : next.add(k);
                            return next;
                          })
                        }
                        className="rounded border-gray-300 text-[#FF6600] focus:ring-[#FF6600]"
                      />
                      {k}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="ml-auto flex gap-1 bg-gray-200 rounded-lg p-0.5">
            <button
              onClick={() => {
                setView("pipeline");
                setSelected(new Set());
              }}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition ${view === "pipeline" ? "bg-white shadow text-gray-800" : "text-gray-500"}`}
            >
              Pipeline
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition ${view === "list" ? "bg-white shadow text-gray-800" : "text-gray-500"}`}
            >
              List
            </button>
          </div>
        </div>

        {/* Bulk Action Bar — appears when list view & any selected */}
        {view === "list" && selected.size > 0 && (
          <div className="max-w-7xl mx-auto mb-3">
            <div className="bg-[#002147] text-white rounded-xl px-5 py-3 flex flex-wrap items-center gap-3 shadow-md">
              <span className="text-sm font-semibold">
                {selected.size} lead{selected.size !== 1 ? "s" : ""} selected
              </span>
              <select
                value={bulkAction}
                onChange={(e) => {
                  setBulkAction(e.target.value);
                  setConfirmDelete(false);
                }}
                className="text-sm bg-[#001838] border border-white/30 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#FF6600]"
              >
                <option value="" className="bg-[#001838] text-white">
                  Choose action…
                </option>
                <option
                  value="change_status"
                  className="bg-[#001838] text-white"
                >
                  Change Status
                </option>
                <option
                  value="change_intent"
                  className="bg-[#001838] text-white"
                >
                  Change Intent
                </option>
                <option value="assign" className="bg-[#001838] text-white">
                  Assign Agent
                </option>
                <option value="delete" className="bg-[#001838] text-red-300">
                  Delete
                </option>
              </select>

              {bulkAction === "change_status" && (
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="text-sm bg-[#001838] border border-white/30 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#FF6600]"
                >
                  <option value="" className="bg-[#001838] text-white">
                    Select status…
                  </option>
                  {LEAD_STATUSES.map((s) => (
                    <option
                      key={s}
                      value={s}
                      className="bg-[#001838] text-white capitalize"
                    >
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              )}

              {bulkAction === "change_intent" && (
                <select
                  value={bulkIntent}
                  onChange={(e) => setBulkIntent(e.target.value)}
                  className="text-sm bg-[#001838] border border-white/30 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#FF6600]"
                >
                  <option value="" className="bg-[#001838] text-white">
                    Select intent…
                  </option>
                  {INTENT_CATEGORIES.map((i) => (
                    <option
                      key={i}
                      value={i}
                      className="bg-[#001838] text-white capitalize"
                    >
                      {i.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              )}

              {bulkAction === "assign" && agents.length > 0 && (
                <select
                  value={bulkAgentId}
                  onChange={(e) => setBulkAgentId(e.target.value)}
                  className="text-sm bg-[#001838] border border-white/30 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#FF6600]"
                >
                  <option value="" className="bg-[#001838] text-white">
                    Select agent…
                  </option>
                  {agents.map((a: any) => (
                    <option
                      key={a.id}
                      value={a.id}
                      className="bg-[#001838] text-white"
                    >
                      {a.name}
                    </option>
                  ))}
                </select>
              )}

              {bulkAction === "delete" && confirmDelete && (
                <span className="text-red-300 text-xs font-medium">
                  ⚠ This will permanently delete {selected.size} lead(s). Click
                  Delete to confirm.
                </span>
              )}

              <button
                onClick={runBulk}
                disabled={bulkMutation.isPending || !bulkAction}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                  bulkAction === "delete"
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-[#FF6600] hover:bg-orange-600 text-white"
                } disabled:opacity-50`}
              >
                {bulkMutation.isPending
                  ? "Processing…"
                  : bulkAction === "delete"
                    ? confirmDelete
                      ? "✓ Delete"
                      : "Delete"
                    : "Apply"}
              </button>

              <button
                onClick={() => {
                  setSelected(new Set());
                  setBulkAction("");
                  setConfirmDelete(false);
                }}
                className="ml-auto text-white/60 hover:text-white text-xs"
              >
                Clear
              </button>
            </div>

            {/* Row feedback */}
            {bulkMsg && (
              <div
                className={`mt-2 px-4 py-2 rounded-lg text-sm font-medium ${
                  bulkMsg.type === "success"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {bulkMsg.text}
              </div>
            )}
          </div>
        )}

        {isLoading && view === "pipeline" && <PipelineSkeleton />}
        {isLoading && view === "list" && <TableSkeleton />}

        {/* Pipeline view */}
        {!isLoading && view === "pipeline" && (
          <div className="flex gap-4 overflow-x-auto pb-4 max-w-7xl mx-auto">
            {grouped.map((col) => (
              <div key={col.key} className="min-w-[260px] flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                  <h3 className="font-semibold text-sm text-gray-700">
                    {col.label}
                  </h3>
                  <span className="text-xs text-gray-400 ml-auto">
                    {col.leads.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {col.leads.map((lead: any) => (
                    <Link
                      key={lead.id}
                      to={`/leads/${lead.id}`}
                      className="block bg-white rounded-lg shadow-sm p-3 hover:shadow-md transition border border-gray-100"
                    >
                      <p className="font-medium text-sm text-gray-800 truncate">
                        {lead.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {lead.phone}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {lead.intent_category && (
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${INTENT_COLORS[lead.intent_category] ?? "bg-gray-100"}`}
                          >
                            {lead.intent_category.replace(/_/g, " ")}
                          </span>
                        )}
                        {lead.source_campaign && (
                          <span className="text-[10px] text-gray-400 truncate">
                            {lead.source_campaign}
                          </span>
                        )}
                      </div>
                      {lead.callback_scheduled_at && (
                        <p className="text-[10px] text-yellow-600 mt-1">
                          Callback:{" "}
                          {new Date(
                            lead.callback_scheduled_at,
                          ).toLocaleString()}
                        </p>
                      )}
                    </Link>
                  ))}
                  {col.leads.length === 0 && (
                    <p className="text-xs text-gray-300 text-center py-6">
                      No leads
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List view */}
        {!isLoading && view === "list" && (
          <div className="max-w-7xl mx-auto overflow-x-auto">
            <table className="min-w-full bg-white rounded-xl shadow-sm overflow-hidden">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={
                        filteredLeads.length > 0 &&
                        selected.size === filteredLeads.length
                      }
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-[#FF6600] focus:ring-[#FF6600]"
                      title="Select all"
                    />
                  </th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Intent</th>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Updated</th>
                  {Array.from(visibleExtraCols).map((col) => (
                    <th key={col} className="px-4 py-3">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLeads.map((lead: any) => (
                  <tr
                    key={lead.id}
                    className={`hover:bg-gray-50 transition ${selected.has(lead.id) ? "bg-orange-50" : ""}`}
                  >
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        className="rounded border-gray-300 text-[#FF6600] focus:ring-[#FF6600]"
                      />
                    </td>
                    <td
                      className="px-4 py-3 text-sm font-medium text-gray-800 cursor-pointer"
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      {lead.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {lead.phone}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                        {lead.status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.intent_category && (
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${INTENT_COLORS[lead.intent_category] ?? "bg-gray-100"}`}
                        >
                          {lead.intent_category.replace(/_/g, " ")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {lead.source_campaign || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {lead.updated_at
                        ? formatDistanceToNow(new Date(lead.updated_at), {
                            addSuffix: true,
                          })
                        : "—"}
                    </td>
                    {Array.from(visibleExtraCols).map((col) => (
                      <td
                        key={col}
                        className="px-4 py-3 text-xs text-gray-500 max-w-[160px] truncate"
                      >
                        {lead.extra_data?.[col] != null
                          ? String(lead.extra_data[col])
                          : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredLeads.length === 0 && (
              <p className="text-gray-400 text-center py-12">No leads found</p>
            )}
            {filteredLeads.length > 0 && (
              <p className="text-xs text-gray-400 mt-2 text-right">
                {filteredLeads.length}
                {filteredLeads.length !== leads.length
                  ? ` of ${leads.length}`
                  : ""}{" "}
                leads
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

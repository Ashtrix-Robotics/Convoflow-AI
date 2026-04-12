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

const INTEREST_COLORS: Record<string, string> = {
  high: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-orange-100 text-orange-700",
  none: "bg-gray-100 text-gray-500",
};

// Maps table column label → lead field name for sorting
const SORTABLE_COLS: Record<string, string> = {
  Name: "name",
  Phone: "phone",
  Status: "status",
  Intent: "intent_category",
  Interest: "interest_level",
  Campaign: "source_campaign",
  Followup: "next_followup_at",
  Updated: "updated_at",
};

const PAGE_SIZE = 50;

// Multi-filter
type FilterClause = { id: string; field: string; value: string };
type FilterMode = "and" | "or";

const FILTER_FIELDS = [
  {
    key: "status",
    label: "Status",
    options: LEAD_STATUSES as readonly string[],
  },
  {
    key: "intent_category",
    label: "Intent",
    options: INTENT_CATEGORIES as readonly string[],
  },
  {
    key: "interest_level",
    label: "Interest",
    options: ["high", "medium", "low", "none"] as readonly string[],
  },
  { key: "source_campaign", label: "Campaign", options: null as null },
  { key: "ad_set", label: "Ad Set", options: null as null },
];

export default function Leads() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"pipeline" | "list">("pipeline");

  // Multi-filter
  const [filters, setFilters] = useState<FilterClause[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("and");
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [pendingField, setPendingField] = useState("");
  const [pendingValue, setPendingValue] = useState("");
  const addFilterRef = useRef<HTMLDivElement>(null);

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

  // (extra-data column filter replaced by multi-filter system below)

  // Sort state
  const [sortCol, setSortCol] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Pagination
  const [page, setPage] = useState(1);

  // Column visibility — tracks which extra_data keys are shown as columns
  const [visibleExtraCols, setVisibleExtraCols] = useState<Set<string>>(
    new Set(),
  );
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node))
        setShowColMenu(false);
      if (
        addFilterRef.current &&
        !addFilterRef.current.contains(e.target as Node)
      )
        setShowAddFilter(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", search],
    queryFn: () =>
      api
        .get("/leads", {
          params: { search: search || undefined, limit: 500 },
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

  // Multi-filter evaluation (client-side AND/OR)
  const filteredLeads = useMemo(() => {
    if (filters.length === 0) return leads;
    return leads.filter((l: any) => {
      const results = filters.map(({ field, value }) => {
        const raw =
          l[field] != null
            ? String(l[field])
            : String(l.extra_data?.[field] ?? "");
        return raw.toLowerCase().includes(value.toLowerCase());
      });
      return filterMode === "and"
        ? results.every(Boolean)
        : results.some(Boolean);
    });
  }, [leads, filters, filterMode]);

  // All available filter fields (standard + discovered extra keys)
  const allFilterFields = useMemo(
    () => [
      ...FILTER_FIELDS,
      ...extraKeys
        .filter((k) => !FILTER_FIELDS.some((f) => f.key === k))
        .map((k) => ({ key: k, label: k, options: null as null })),
    ],
    [extraKeys],
  );

  const selectedFilterField = allFilterFields.find(
    (f) => f.key === pendingField,
  );

  const addFilter = () => {
    if (!pendingField || !pendingValue.trim()) return;
    setFilters((prev) => [
      ...prev,
      {
        id: `${pendingField}-${Date.now()}`,
        field: pendingField,
        value: pendingValue.trim(),
      },
    ]);
    setPendingValue("");
    setShowAddFilter(false);
  };

  const removeFilter = (id: string) =>
    setFilters((prev) => prev.filter((f) => f.id !== id));

  // Sort
  const handleSort = useCallback((col: string) => {
    setSortCol((prev) => {
      if (prev === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return col;
      }
      setSortDir("asc");
      return col;
    });
    setPage(1);
  }, []);

  const sortedLeads = useMemo(() => {
    if (!sortCol) return filteredLeads;
    return [...filteredLeads].sort((a, b) => {
      const field = SORTABLE_COLS[sortCol] ?? null;
      const av = field ? (a[field] ?? "") : (a.extra_data?.[sortCol] ?? "");
      const bv = field ? (b[field] ?? "") : (b.extra_data?.[sortCol] ?? "");
      const cmp = String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredLeads, sortCol, sortDir]);

  // Reset page whenever the sorted result set changes
  useEffect(() => {
    setPage(1);
  }, [sortedLeads]);

  const totalPages = Math.ceil(sortedLeads.length / PAGE_SIZE);
  const pagedLeads = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedLeads.slice(start, start + PAGE_SIZE);
  }, [sortedLeads, page]);

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar active="leads" />

      <main className="px-4 py-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-2 max-w-7xl mx-auto">
          <input
            type="text"
            placeholder="Search leads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
          />

          {/* Add Filter */}
          <div className="relative" ref={addFilterRef}>
            <button
              onClick={() => {
                setShowAddFilter((v) => !v);
                setPendingField("");
                setPendingValue("");
              }}
              className="flex items-center gap-1 border border-dashed border-gray-400 rounded-lg px-3 py-2 text-sm text-gray-500 hover:border-[#FF6600] hover:text-[#FF6600] transition"
            >
              <span className="text-base leading-none">+</span> Add Filter
            </button>
            {showAddFilter && (
              <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-64">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">
                  Add Filter
                </p>
                <div className="space-y-2">
                  <select
                    value={pendingField}
                    onChange={(e) => {
                      setPendingField(e.target.value);
                      setPendingValue("");
                    }}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
                  >
                    <option value="">Choose field…</option>
                    {allFilterFields.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  {pendingField &&
                    (selectedFilterField?.options ? (
                      <select
                        value={pendingValue}
                        onChange={(e) => setPendingValue(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
                      >
                        <option value="">Choose value…</option>
                        {selectedFilterField.options.map((o) => (
                          <option key={o} value={o} className="capitalize">
                            {o.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="Filter value…"
                        value={pendingValue}
                        onChange={(e) => setPendingValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addFilter()}
                        autoFocus
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
                      />
                    ))}
                  <button
                    onClick={addFilter}
                    disabled={!pendingField || !pendingValue.trim()}
                    className="w-full py-1.5 bg-[#FF6600] text-white text-sm rounded-lg disabled:opacity-40 hover:bg-orange-600 transition"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* AND / OR toggle — only shown when 2+ filters */}
          {filters.length >= 2 && (
            <div className="flex gap-0.5 bg-gray-200 rounded-lg p-0.5">
              {(["and", "or"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setFilterMode(m)}
                  className={`px-3 py-1 text-xs rounded-md font-semibold uppercase transition ${filterMode === m ? "bg-white shadow text-gray-800" : "text-gray-500"}`}
                >
                  {m}
                </button>
              ))}
            </div>
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

        {/* Active filter chips */}
        {filters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-3 max-w-7xl mx-auto">
            {filters.map(({ id, field, value }) => {
              const fieldLabel =
                allFilterFields.find((f) => f.key === field)?.label ?? field;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-medium px-2.5 py-1 rounded-full"
                >
                  <span className="text-orange-400">{fieldLabel}:</span>
                  {value.replace(/_/g, " ")}
                  <button
                    onClick={() => removeFilter(id)}
                    className="text-orange-400 hover:text-orange-600 leading-none ml-0.5"
                  >
                    ×
                  </button>
                </span>
              );
            })}
            <button
              onClick={() => {
                setFilters([]);
                setFilterMode("and");
              }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Clear all
            </button>
            <span className="text-xs text-gray-400 ml-auto">
              {filteredLeads.length} of {leads.length} leads
            </span>
          </div>
        )}

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
          <div className="flex gap-4 overflow-x-auto pb-2 max-w-7xl mx-auto items-start">
            {grouped.map((col) => (
              <div
                key={col.key}
                className="min-w-[260px] flex-1 flex flex-col"
                style={{ maxHeight: "calc(100vh - 200px)" }}
              >
                <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                  <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                  <h3 className="font-semibold text-sm text-gray-700">
                    {col.label}
                  </h3>
                  <span className="text-xs text-gray-400 ml-auto">
                    {col.leads.length}
                  </span>
                </div>
                <div className="overflow-y-auto flex-1 space-y-2 pr-0.5">
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
          <div className="max-w-7xl mx-auto">
            <div
              className="overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm"
              style={{ maxHeight: "calc(100vh - 220px)" }}
            >
              <table className="min-w-full">
                <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={
                          sortedLeads.length > 0 &&
                          selected.size === sortedLeads.length
                        }
                        onChange={toggleAll}
                        className="rounded border-gray-300 text-[#FF6600] focus:ring-[#FF6600]"
                        title="Select all"
                      />
                    </th>
                    {(
                      [
                        "Name",
                        "Phone",
                        "Status",
                        "Intent",
                        "Interest",
                        "Campaign",
                        "Followup",
                        "Updated",
                      ] as const
                    ).map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 cursor-pointer select-none whitespace-nowrap hover:text-gray-700"
                        onClick={() => handleSort(col)}
                      >
                        {col}
                        <span className="ml-1 inline-block w-3 text-gray-400">
                          {sortCol === col
                            ? sortDir === "asc"
                              ? "↑"
                              : "↓"
                            : "↕"}
                        </span>
                      </th>
                    ))}
                    {Array.from(visibleExtraCols).map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 cursor-pointer select-none whitespace-nowrap hover:text-gray-700"
                        onClick={() => handleSort(col)}
                      >
                        {col}
                        <span className="ml-1 inline-block w-3 text-gray-400">
                          {sortCol === col
                            ? sortDir === "asc"
                              ? "↑"
                              : "↓"
                            : "↕"}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedLeads.map((lead: any) => (
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
                      <td className="px-4 py-3">
                        {lead.interest_level ? (
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${INTEREST_COLORS[lead.interest_level] ?? "bg-gray-100 text-gray-600"}`}
                          >
                            {lead.interest_level}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {lead.source_campaign || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {lead.next_followup_at
                          ? new Date(lead.next_followup_at).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                year: "2-digit",
                              },
                            )
                          : "—"}
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
              {sortedLeads.length === 0 && (
                <p className="text-gray-400 text-center py-12">
                  No leads found
                </p>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 px-1">
                <p className="text-xs text-gray-400">
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, sortedLeads.length)} of{" "}
                  {sortedLeads.length} leads
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 || p === totalPages || Math.abs(p - page) <= 2,
                    )
                    .reduce<(number | "…")[]>((acc, p, i, arr) => {
                      if (i > 0 && (p as number) - (arr[i - 1] as number) > 1)
                        acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "…" ? (
                        <span
                          key={`ellipsis-${i}`}
                          className="px-2 text-gray-400 text-xs"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p as number)}
                          className={`px-3 py-1 text-xs rounded-lg border transition ${
                            page === p
                              ? "bg-[#FF6600] border-[#FF6600] text-white font-semibold"
                              : "border-gray-300 text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {p}
                        </button>
                      ),
                    )}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
            {totalPages <= 1 && sortedLeads.length > 0 && (
              <p className="text-xs text-gray-400 mt-2 text-right">
                {sortedLeads.length} leads
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

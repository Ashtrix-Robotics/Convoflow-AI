import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import api from "../services/api";

const PIPELINE_COLUMNS = [
  { key: "new", label: "New", color: "bg-blue-500" },
  { key: "contacted", label: "Contacted", color: "bg-yellow-500" },
  { key: "qualified", label: "Qualified", color: "bg-purple-500" },
  { key: "payment_sent", label: "Payment Sent", color: "bg-orange-500" },
  { key: "converted", label: "Converted", color: "bg-green-500" },
  { key: "lost", label: "Lost", color: "bg-red-500" },
] as const;

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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterIntent, setFilterIntent] = useState("");
  const [view, setView] = useState<"pipeline" | "list">("pipeline");

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", search, filterIntent],
    queryFn: () =>
      api
        .get("/leads", {
          params: {
            search: search || undefined,
            intent_category: filterIntent || undefined,
            limit: 200,
          },
        })
        .then((r) => r.data),
  });

  const moveLead = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/leads/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const grouped = PIPELINE_COLUMNS.map((col) => ({
    ...col,
    leads: leads.filter((l: any) => l.status === col.key),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#002147] text-white px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold">Convoflow AI</h1>
          <nav className="flex gap-4 text-sm">
            <Link to="/" className="hover:text-orange-300 opacity-70">
              Dashboard
            </Link>
            <Link to="/leads" className="text-orange-400 font-semibold">
              Leads
            </Link>
          </nav>
        </div>
        <button
          className="text-sm bg-[#FF6600] px-4 py-2 rounded hover:bg-orange-600"
          onClick={() => {
            localStorage.clear();
            navigate("/login");
          }}
        >
          Sign Out
        </button>
      </header>

      <main className="px-4 py-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6 max-w-7xl mx-auto">
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
          <div className="ml-auto flex gap-1 bg-gray-200 rounded-lg p-0.5">
            <button
              onClick={() => setView("pipeline")}
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

        {isLoading && (
          <p className="text-gray-400 text-center py-12">Loading leads…</p>
        )}

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
          <div className="max-w-5xl mx-auto">
            <table className="w-full bg-white rounded-xl shadow-sm overflow-hidden">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Intent</th>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map((lead: any) => (
                  <tr
                    key={lead.id}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
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
                  </tr>
                ))}
              </tbody>
            </table>
            {leads.length === 0 && (
              <p className="text-gray-400 text-center py-12">No leads found</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

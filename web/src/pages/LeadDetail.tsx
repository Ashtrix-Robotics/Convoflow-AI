import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import NavBar from "../components/NavBar";
import api from "../services/api";

const STATUS_OPTIONS = [
  "new",
  "contacted",
  "in_progress",
  "qualified",
  "payment_sent",
  "converted",
  "lost",
  "deferred",
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

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");

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
    mutationFn: (data: Record<string, any>) => api.patch(`/leads/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lead", id] }),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get("/agents").then((r) => r.data),
  });

  const assignAgent = useMutation({
    mutationFn: (agentId: string) =>
      api.post(`/leads/${id}/assign`, null, { params: { agent_id: agentId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lead", id] }),
  });

  const markNoAnswer = useMutation({
    mutationFn: () => api.post(`/leads/${id}/no-answer`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lead", id] }),
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-20 text-gray-400">Loading…</div>
    );
  if (!lead)
    return (
      <div className="flex justify-center py-20 text-red-400">
        Lead not found
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50">
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
              <select
                value={lead.status}
                onChange={(e) => updateLead.mutate({ status: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              {lead.intent_category && (
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${INTENT_COLORS[lead.intent_category] ?? "bg-gray-100"}`}
                >
                  {lead.intent_category.replace(/_/g, " ")}
                </span>
              )}
            </div>
          </div>

          {/* Details grid */}
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
          
          <div className="mt-6 border-t pt-4 flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">Assigned Agent</p>
              <p className="font-medium text-gray-700">
                {agents.find((a: any) => a.id === lead.assigned_agent_id)?.name || "Unassigned"}
              </p>
            </div>
            <select
                value={lead.assigned_agent_id || ""}
                onChange={(e) => assignAgent.mutate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
                disabled={assignAgent.isPending}
              >
                <option value="" disabled>Assign to...</option>
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
                  ? `${lead.notes}\n${new Date().toLocaleDateString()} — ${notes}`
                  : `${new Date().toLocaleDateString()} — ${notes}`;
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

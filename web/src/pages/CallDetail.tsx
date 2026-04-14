import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import NavBar from "../components/NavBar";
import { DetailSkeleton } from "../components/Skeleton";
import api from "../services/api";

export default function CallDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: call, isLoading } = useQuery({
    queryKey: ["call", id],
    queryFn: () => api.get(`/calls/${id}`).then((r) => r.data),
  });
  const { data: followups = [] } = useQuery({
    queryKey: ["followups", id],
    queryFn: () => api.get(`/followups/${id}`).then((r) => r.data),
  });
  const { data: linkedLead } = useQuery({
    queryKey: ["call-lead", call?.lead_id],
    queryFn: () => api.get(`/leads/${call.lead_id}`).then((r) => r.data),
    enabled: !!call?.lead_id,
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["lead-options"],
    queryFn: () =>
      api.get("/leads", { params: { limit: 100 } }).then((r) => r.data),
  });
  const [selectedLeadId, setSelectedLeadId] = useState("");

  useEffect(() => {
    setSelectedLeadId(call?.lead_id ?? "");
  }, [call?.lead_id]);

  const linkLead = useMutation({
    mutationFn: (leadId: string | null) =>
      api.patch(`/calls/${id}/lead`, { lead_id: leadId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call", id] });
      queryClient.invalidateQueries({ queryKey: ["calls"] });
      queryClient.invalidateQueries({ queryKey: ["lead-options"] });
      queryClient.invalidateQueries({ queryKey: ["call-lead"] });
      queryClient.invalidateQueries({ queryKey: ["lead-calls"] });
    },
  });

  if (isLoading)
    return (
      <div className="min-h-screen bg-gray-50">
        <NavBar active="dashboard" />
        <DetailSkeleton />
      </div>
    );
  if (!call)
    return (
      <div className="flex justify-center py-20 text-red-400">
        Call not found
      </div>
    );

  const actionItems = (() => {
    try {
      return JSON.parse(call.action_items || "[]");
    } catch {
      return [];
    }
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        active="dashboard"
        breadcrumb={{ label: "Back", onClick: () => navigate(-1) }}
      />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Meta */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-sm text-gray-400">
            Recorded{" "}
            {formatDistanceToNow(new Date(call.recorded_at), {
              addSuffix: true,
            })}
          </p>
          <span className="inline-block mt-2 text-xs rounded-full px-2 py-1 bg-blue-100 text-blue-700 capitalize">
            {call.status}
          </span>
          {call.pabbly_sent && (
            <span className="inline-block mt-2 ml-2 text-xs rounded-full px-2 py-1 bg-green-100 text-green-700">
              ✓ Pabbly Notified
            </span>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-700 mb-1">Lead Link</h2>
            {linkedLead ? (
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-800">{linkedLead.name}</p>
                <p>{linkedLead.phone}</p>
                <Link
                  to={`/leads/${linkedLead.id}`}
                  className="inline-block mt-2 text-[#FF6600] hover:underline"
                >
                  Open lead detail
                </Link>
              </div>
            ) : (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                This call is currently unassigned. Link it to a lead so it shows
                in the lead timeline and updates the lead status.
              </p>
            )}
          </div>

          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]"
            >
              <option value="">Unassigned</option>
              {leads.map((lead: any) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name} · {lead.phone}
                </option>
              ))}
            </select>
            <button
              onClick={() => linkLead.mutate(selectedLeadId || null)}
              disabled={linkLead.isPending}
              className="bg-[#FF6600] text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600 disabled:opacity-60"
            >
              {linkLead.isPending
                ? "Saving..."
                : linkedLead
                  ? "Update link"
                  : "Link lead"}
            </button>
          </div>
        </div>

        {/* Summary */}
        {call.summary && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-2">AI Summary</h2>
            <p className="text-gray-600 leading-relaxed">{call.summary}</p>
          </div>
        )}

        {/* Audio Playback */}
        {call.audio_url && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-3">Call Recording</h2>
            <audio
              controls
              className="w-full"
              src={call.audio_url}
              preload="metadata"
            >
              Your browser does not support the audio element.
            </audio>
          </div>
        )}

        {/* Action Items */}
        {actionItems.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-2">Action Items</h2>
            <ul className="list-disc pl-5 space-y-1">
              {actionItems.map((item: string, i: number) => (
                <li key={i} className="text-gray-600">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Transcription */}
        {call.transcription && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-2">
              Full Transcription
            </h2>
            <pre className="whitespace-pre-wrap text-sm text-gray-500 font-sans leading-relaxed max-h-64 overflow-y-auto">
              {call.transcription}
            </pre>
          </div>
        )}

        {/* Follow-Ups */}
        {followups.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-2">Follow-Ups</h2>
            <ul className="space-y-2">
              {followups.map((f: any) => (
                <li
                  key={f.id}
                  className="flex items-center gap-2 text-sm text-gray-600"
                >
                  <span
                    className={
                      f.status === "completed"
                        ? "line-through text-gray-400"
                        : ""
                    }
                  >
                    {f.task}
                  </span>
                  {f.pabbly_triggered && (
                    <span className="text-xs text-green-600">
                      ✓ Sent to Pabbly
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

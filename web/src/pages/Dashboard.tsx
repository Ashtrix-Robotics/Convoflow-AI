import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import NavBar from "../components/NavBar";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import api from "../services/api";
import { KpiSkeleton, ChartsSkeleton } from "../components/Skeleton";

const PIE_COLORS = [
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#6366F1",
  "#8B5CF6",
  "#3B82F6",
  "#EC4899",
  "#6B7280",
];

const FUNNEL_COLORS: Record<string, string> = {
  new: "#3B82F6",
  contacted: "#F59E0B",
  qualified: "#8B5CF6",
  payment_sent: "#F97316",
  converted: "#10B981",
  lost: "#9CA3AF",
};

const LEAD_STATUS_COLOR: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  qualified: "bg-purple-100 text-purple-700",
  payment_sent: "bg-orange-100 text-orange-600",
  converted: "bg-green-100 text-green-700",
  lost: "bg-gray-100 text-gray-500",
};

export default function Dashboard() {
  const { data: calls = [], isLoading: callsLoading } = useQuery({
    queryKey: ["calls"],
    queryFn: () => api.get("/calls").then((r) => r.data),
  });

  const { data: recentLeads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["leads", "recent"],
    queryFn: () =>
      api.get("/leads?limit=8&sort=created_at&order=desc").then((r) => r.data),
  });

  const { data: rawAnalytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => api.get("/analytics/overview").then((r) => r.data),
  });

  /**
   * Normalize analytics data — handles both backend shapes:
   *  - New: `campaign_breakdown: [{campaign, leads, converted}]` (array)
   *  - Legacy: `leads_by_campaign: {name: count}` (dict)
   * Same pattern applied to intent_distribution and daily_stats.
   */
  const analytics = rawAnalytics
    ? {
        ...rawAnalytics,
        campaign_breakdown:
          rawAnalytics.campaign_breakdown?.length > 0
            ? rawAnalytics.campaign_breakdown
            : Object.entries(rawAnalytics.leads_by_campaign ?? {}).map(
                ([campaign, leads]) => ({ campaign, leads, converted: 0 }),
              ),
        intent_distribution:
          rawAnalytics.intent_distribution?.length > 0
            ? rawAnalytics.intent_distribution
            : Object.entries(rawAnalytics.leads_by_intent ?? {})
                .filter(([intent]) => intent && intent !== "null")
                .map(([intent, count]) => ({ intent, count })),
        daily_stats: rawAnalytics.daily_stats ?? [],
      }
    : undefined;

  const statusColor: Record<string, string> = {
    completed: "bg-green-100 text-green-700",
    transcribing: "bg-yellow-100 text-yellow-700",
    pending: "bg-gray-100 text-gray-600",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar active="dashboard" />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* KPI cards */}
        {analyticsLoading && <KpiSkeleton />}
        {!analyticsLoading && analytics && (
          <>
            {/* Row 1 — primary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-5">
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Total Leads
                </p>
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {analytics.total_leads}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Contacted
                </p>
                <p className="text-3xl font-bold text-blue-600 mt-1">
                  {analytics.leads_by_status?.contacted ?? 0}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Converted
                </p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {analytics.total_conversions}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Conversion Rate
                </p>
                <p className="text-3xl font-bold text-[#FF6600] mt-1">
                  {analytics.conversion_rate.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Row 2 — operational KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div
                className={`rounded-xl shadow-sm p-5 ${analytics.stale_leads_count > 0 ? "bg-red-50 border border-red-200" : "bg-white"}`}
              >
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Stale Leads
                </p>
                <p
                  className={`text-3xl font-bold mt-1 ${analytics.stale_leads_count > 0 ? "text-red-600" : "text-gray-800"}`}
                >
                  {analytics.stale_leads_count}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  Not acted on in 7+ days
                </p>
              </div>
              <div
                className={`rounded-xl shadow-sm p-5 ${analytics.followups_due_today > 0 ? "bg-orange-50 border border-orange-200" : "bg-white"}`}
              >
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Follow-ups Today
                </p>
                <p
                  className={`text-3xl font-bold mt-1 ${analytics.followups_due_today > 0 ? "text-orange-600" : "text-gray-800"}`}
                >
                  {analytics.followups_due_today}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">Due today</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  WhatsApp Active
                </p>
                <p className="text-3xl font-bold text-emerald-600 mt-1">
                  {analytics.whatsapp_active_count}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  Live conversations
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Avg Follow-ups
                </p>
                <p className="text-3xl font-bold text-gray-700 mt-1">
                  {analytics.avg_followup_count}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  Per lead average
                </p>
              </div>
            </div>
          </>
        )}

        {/* Charts row */}
        {analyticsLoading && <ChartsSkeleton />}
        {!analyticsLoading && analytics && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Campaign breakdown */}
            {analytics.campaign_breakdown?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="font-semibold text-gray-700 mb-4">
                  Leads by Campaign
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analytics.campaign_breakdown}>
                    <XAxis
                      dataKey="campaign"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: any, name: string) =>
                        name === "conversion_rate"
                          ? [`${value}%`, "Conv. Rate"]
                          : [value, name]
                      }
                    />
                    <Legend />
                    <Bar
                      dataKey="leads"
                      fill="#002147"
                      radius={[4, 4, 0, 0]}
                      name="Leads"
                    />
                    <Bar
                      dataKey="converted"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                      name="Converted"
                    />
                  </BarChart>
                </ResponsiveContainer>
                {/* Top campaigns conversion table */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-gray-400 uppercase">
                      <tr>
                        <th className="pb-1">Campaign</th>
                        <th className="pb-1 text-right">Leads</th>
                        <th className="pb-1 text-right">Converted</th>
                        <th className="pb-1 text-right">Conv %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[...analytics.campaign_breakdown]
                        .sort((a: any, b: any) => b.leads - a.leads)
                        .slice(0, 6)
                        .map((c: any) => (
                          <tr key={c.campaign}>
                            <td className="py-1 text-gray-700 font-medium truncate max-w-[140px]">
                              {c.campaign}
                            </td>
                            <td className="py-1 text-right text-gray-500">
                              {c.leads}
                            </td>
                            <td className="py-1 text-right text-green-600">
                              {c.converted}
                            </td>
                            <td className="py-1 text-right text-[#FF6600] font-semibold">
                              {c.conversion_rate ?? 0}%
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Intent distribution */}
            {analytics.intent_distribution?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="font-semibold text-gray-700 mb-4">
                  Intent Distribution
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={analytics.intent_distribution}
                      dataKey="count"
                      nameKey="intent"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ intent, count }) =>
                        `${(intent as string).replace(/_/g, " ")} (${count})`
                      }
                    >
                      {analytics.intent_distribution.map(
                        (_: any, i: number) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                          />
                        ),
                      )}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Daily trend */}
        {analytics?.daily_stats?.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 mb-4">
              Daily Activity (Last 30 Days)
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={analytics.daily_stats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="new_leads"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                  name="New Leads"
                />
                <Line
                  type="monotone"
                  dataKey="calls_made"
                  stroke="#FF6600"
                  strokeWidth={2}
                  dot={false}
                  name="Calls"
                />
                <Line
                  type="monotone"
                  dataKey="conversions"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                  name="Conversions"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Status Funnel */}
        {analytics?.status_funnel?.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 mb-4">
              Pipeline Funnel
            </h3>
            <div className="space-y-2">
              {analytics.status_funnel.map((stage: any) => (
                <div key={stage.stage} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-24 capitalize font-medium">
                    {stage.stage.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className="h-6 rounded-full flex items-center px-2 transition-all duration-500"
                      style={{
                        width: `${Math.max(stage.pct, stage.count > 0 ? 4 : 0)}%`,
                        backgroundColor:
                          FUNNEL_COLORS[stage.stage] ?? "#9CA3AF",
                      }}
                    >
                      {stage.count > 0 && (
                        <span className="text-white text-[10px] font-semibold whitespace-nowrap">
                          {stage.count}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 w-12 text-right">
                    {stage.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agent performance */}
        {analytics?.agent_stats?.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 mb-4">
              Agent Performance
            </h3>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-400 uppercase">
                <tr>
                  <th className="pb-2">Agent</th>
                  <th className="pb-2">Leads</th>
                  <th className="pb-2">Calls</th>
                  <th className="pb-2">Converted</th>
                  <th className="pb-2">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analytics.agent_stats.map((a: any) => (
                  <tr key={a.agent_name}>
                    <td className="py-2 font-medium text-gray-700">
                      {a.agent_name}
                    </td>
                    <td className="py-2 text-gray-500">{a.leads_assigned}</td>
                    <td className="py-2 text-gray-500">{a.calls_made}</td>
                    <td className="py-2 text-green-600">{a.conversions}</td>
                    <td className="py-2 text-[#FF6600] font-semibold">
                      {a.conversion_rate.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recent leads */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Recent Leads</h2>
            <Link
              to="/leads"
              className="text-sm text-[#FF6600] hover:underline font-medium"
            >
              View all →
            </Link>
          </div>

          {leadsLoading && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl shadow-sm p-4 animate-pulse"
                >
                  <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {!leadsLoading && recentLeads.length === 0 && (
            <div className="text-center py-10 bg-white rounded-xl shadow-sm text-gray-400">
              <p>
                No leads yet. Configure Pabbly to start receiving leads
                automatically.
              </p>
            </div>
          )}

          {!leadsLoading && recentLeads.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {recentLeads.slice(0, 8).map((lead: any) => (
                <Link
                  key={lead.id}
                  to={`/leads/${lead.id}`}
                  className="block bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition border border-transparent hover:border-orange-200"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-gray-800 text-sm truncate">
                      {lead.name}
                    </p>
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${LEAD_STATUS_COLOR[lead.status] ?? "bg-gray-100 text-gray-500"}`}
                    >
                      {lead.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{lead.phone}</p>
                  {lead.source_campaign && (
                    <p className="text-xs text-gray-400 mt-1 truncate">
                      {lead.source_campaign}
                    </p>
                  )}
                  {lead.created_at && (
                    <p className="text-[10px] text-gray-300 mt-2">
                      {formatDistanceToNow(new Date(lead.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent calls */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Calls</h2>

          {callsLoading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl shadow-sm p-5 animate-pulse"
                >
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              ))}
            </div>
          )}

          {!callsLoading && calls.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg">No calls recorded yet.</p>
              <p className="text-sm mt-2">
                Use the mobile app to record your first call.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {calls.slice(0, 10).map((call: any) => (
              <Link
                key={call.id}
                to={`/calls/${call.id}`}
                className="block bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800">
                      Call —{" "}
                      {formatDistanceToNow(new Date(call.recorded_at), {
                        addSuffix: true,
                      })}
                    </p>
                    {call.summary && (
                      <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                        {call.summary}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor[call.status] ?? "bg-gray-100"}`}
                  >
                    {call.status}
                  </span>
                </div>
                {call.duration_seconds && (
                  <p className="text-xs text-gray-400 mt-2">
                    Duration: {Math.floor(call.duration_seconds / 60)}m{" "}
                    {call.duration_seconds % 60}s
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

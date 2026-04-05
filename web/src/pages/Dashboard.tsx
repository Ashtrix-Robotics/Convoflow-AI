import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
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
} from "recharts";
import api from "../services/api";

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

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: calls = [], isLoading: callsLoading } = useQuery({
    queryKey: ["calls"],
    queryFn: () => api.get("/calls").then((r) => r.data),
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => api.get("/analytics/overview").then((r) => r.data),
  });

  const statusColor: Record<string, string> = {
    completed: "bg-green-100 text-green-700",
    transcribing: "bg-yellow-100 text-yellow-700",
    pending: "bg-gray-100 text-gray-600",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#002147] text-white px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold">Convoflow AI</h1>
          <nav className="flex gap-4 text-sm">
            <Link to="/" className="text-orange-400 font-semibold">
              Dashboard
            </Link>
            <Link to="/leads" className="hover:text-orange-300 opacity-70">
              Leads
            </Link>
            <Link
              to="/admin/settings"
              className="hover:text-orange-300 opacity-70"
            >
              Admin
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

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* KPI cards */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Total Leads
              </p>
              <p className="text-3xl font-bold text-gray-800 mt-1">
                {analytics.lead_count}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Contacted
              </p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {analytics.contacted_count}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Converted
              </p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {analytics.converted_count}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Conversion Rate
              </p>
              <p className="text-3xl font-bold text-[#FF6600] mt-1">
                {(analytics.conversion_rate * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        )}

        {/* Charts row */}
        {analytics && (
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
                    <Tooltip />
                    <Bar dataKey="leads" fill="#002147" radius={[4, 4, 0, 0]} />
                    <Bar
                      dataKey="converted"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
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

        {/* Agent performance */}
        {analytics?.agent_performance?.length > 0 && (
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
                {analytics.agent_performance.map((a: any) => (
                  <tr key={a.agent_name}>
                    <td className="py-2 font-medium text-gray-700">
                      {a.agent_name}
                    </td>
                    <td className="py-2 text-gray-500">{a.leads_assigned}</td>
                    <td className="py-2 text-gray-500">{a.calls_made}</td>
                    <td className="py-2 text-green-600">{a.leads_converted}</td>
                    <td className="py-2 text-[#FF6600] font-semibold">
                      {a.leads_assigned > 0
                        ? (
                            (a.leads_converted / a.leads_assigned) *
                            100
                          ).toFixed(0)
                        : 0}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recent calls */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Calls</h2>

          {callsLoading && <p className="text-gray-500">Loading calls…</p>}

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

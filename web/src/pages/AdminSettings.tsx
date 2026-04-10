import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import NavBar from "../components/NavBar";
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

  const [sourceSheetName, setSourceSheetName] = useState("");
  const [sourceSheetSaving, setSourceSheetSaving] = useState(false);

  // Sync source sheet name from server
  const currentSourceSheet = sheetsStatus?.source_sheet_name ?? "";

  const saveSourceSheet = async () => {
    setSourceSheetSaving(true);
    try {
      await api.put("/admin/sheets/source-sheet", { value: sourceSheetName || currentSourceSheet });
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
    }
  };

  const getValue = (key: string) =>
    settings.find((s) => s.key === key)?.value ?? "false";

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
          <div className="text-gray-400 text-sm">Loading settings…</div>
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
            Every lead create/update is synced to Google Sheets automatically.
            Use this button to do a full bulk re-sync if the sheet gets out of
            date.
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

          {/* Source sheet tab name */}
          {sheetsStatus?.configured && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <label className="text-xs text-gray-500 font-medium block mb-1">
                Source Sheet Tab Name
              </label>
              <p className="text-xs text-gray-400 mb-2">
                The worksheet tab where inbound leads arrive (from Meta ads). Leave blank to use &quot;Sheet1&quot;.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  defaultValue={currentSourceSheet}
                  onChange={(e) => setSourceSheetName(e.target.value)}
                  placeholder="Sheet1"
                  className="border rounded-lg px-3 py-2 text-sm flex-1 focus:ring-2 focus:ring-green-400 focus:outline-none"
                />
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

          <button
            onClick={runSync}
            disabled={syncLoading || !sheetsStatus?.configured}
            className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {syncLoading ? "Syncing…" : "Bulk Sync All Leads → Sheet"}
          </button>
          {syncResult && (
            <div className="mt-3 text-sm bg-green-50 border border-green-200 rounded-lg p-3">
              ✅ Synced <strong>{syncResult.rows_written}</strong> leads to
              sheet{" "}
              <code className="text-xs text-gray-600">
                {syncResult.spreadsheet_id}
              </code>
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
      </main>
    </div>
  );
}

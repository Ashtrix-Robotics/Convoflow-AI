import { useState, FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import api from "../services/api";

export default function Profile() {
  const navigate = useNavigate();
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () =>
      api.get("/auth/me").then(
        (r) =>
          r.data as {
            id: string;
            name: string;
            email: string;
            is_active: boolean;
            created_at: string;
          },
      ),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPwd.length < 8) {
      return setError("New password must be at least 8 characters.");
    }
    if (newPwd !== confirmPwd) {
      return setError("New passwords do not match.");
    }

    setLoading(true);
    try {
      await api.post("/agents/me/change-password", {
        current_password: currentPwd,
        new_password: newPwd,
      });
      setSuccess("Password changed successfully!");
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (err: unknown) {
      const msg =
        (err as any)?.response?.data?.detail ??
        (err instanceof Error ? err.message : "Failed to change password.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const joinDate = me?.created_at
    ? new Date(me.created_at).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  const initials = me?.name
    ? me.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <NavBar active="dashboard" />
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8 flex-1 w-full">
        {/* Profile card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-[#FF6600] flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#002147]">
                {me?.name ?? "Loading…"}
              </h2>
              <p className="text-sm text-gray-500">{me?.email ?? ""}</p>
              <p className="text-xs text-gray-400 mt-0.5">Joined {joinDate}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-xs text-gray-400 mb-0.5">Status</p>
              <p className="font-medium text-green-700">
                {me?.is_active !== false ? "Active" : "Suspended"}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-xs text-gray-400 mb-0.5">Role</p>
              <p className="font-medium text-gray-700">Sales Agent</p>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-[#002147] mb-1">
            Change Password
          </h3>
          <p className="text-sm text-gray-500 mb-5">
            Updates both your platform (mobile) and web dashboard login.
          </p>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                autoComplete="current-password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]/40 focus:border-[#FF6600]"
                placeholder="Your current password"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                autoComplete="new-password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]/40 focus:border-[#FF6600]"
                placeholder="Min 8 characters"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                autoComplete="new-password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]/40 focus:border-[#FF6600]"
                placeholder="Re-enter new password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-lg">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2.5 rounded-lg">
                {success}
              </div>
            )}

            <div className="pt-2 flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="bg-[#FF6600] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition"
              >
                {loading ? "Updating…" : "Update Password"}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="text-gray-500 hover:text-gray-700 px-4 py-2.5 text-sm"
              >
                Back
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

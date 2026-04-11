/**
 * ResetPassword — handles Supabase password-reset email links.
 *
 * When a user clicks the reset link in their email, Supabase redirects them
 * here with a fragment: #access_token=...&type=recovery
 * Supabase JS SDK auto-detects this and sets a recovery session.
 * We then let the user enter a new password and persist it.
 */
import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import api from "../services/api";
import { TOKEN_KEY } from "../config";

type PageState = "loading" | "form" | "success" | "invalid";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase SDK auto-processes the URL fragment and fires an AUTH_STATE_CHANGE event.
    // Wait for a PASSWORD_RECOVERY session before showing the form.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPageState("form");
      }
    });

    // Also check immediately — in case the event fired before we subscribed.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setPageState("form");
      } else {
        // Give the SDK 3 s to process the fragment before declaring invalid.
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: late }) => {
            if (!late.session) setPageState("invalid");
          });
        }, 3000);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPwd.length < 8)
      return setError("Password must be at least 8 characters.");
    if (newPwd !== confirmPwd) return setError("Passwords do not match.");

    setLoading(true);
    try {
      // 1. Update password in Supabase (uses the recovery session)
      const { data: updated, error: updateErr } =
        await supabase.auth.updateUser({
          password: newPwd,
        });
      if (updateErr || !updated.user) {
        throw new Error(updateErr?.message ?? "Supabase update failed");
      }

      // 2. Sync the new password to the platform DB so mobile login also works.
      const { data: session } = await supabase.auth.getSession();
      if (session.session?.access_token) {
        try {
          await api.post("/auth/reset-platform-password", {
            supabase_token: session.session.access_token,
            new_password: newPwd,
          });
        } catch {
          // Non-fatal — Supabase session is fixed; platform sync failure
          // just means mobile login still uses the old password.
          console.warn(
            "Platform password sync failed — web login is fixed, mobile may need manual reset.",
          );
        }
      }

      // 3. Exchange the new Supabase session for a platform JWT and log in.
      if (session.session?.access_token) {
        try {
          const res = await api.post("/auth/supabase-session", {
            supabase_token: session.session.access_token,
          });
          localStorage.setItem(TOKEN_KEY, res.data.access_token);
        } catch {
          // Could not get platform JWT; user will need to log in manually.
        }
      }

      setPageState("success");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to reset password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#002147] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-[#002147] text-center mb-1">
          Convoflow AI
        </h1>

        {pageState === "loading" && (
          <p className="text-sm text-gray-400 text-center mt-4">
            Verifying reset link…
          </p>
        )}

        {pageState === "invalid" && (
          <div className="mt-4 space-y-4">
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
              This password reset link has expired or is invalid. Please request
              a new one.
            </div>
            <button
              onClick={() => navigate("/login")}
              className="w-full bg-[#FF6600] text-white font-semibold py-2.5 rounded-lg hover:bg-orange-600 transition"
            >
              Back to Login
            </button>
          </div>
        )}

        {pageState === "form" && (
          <>
            <p className="text-sm text-gray-400 text-center mb-6">
              Set your new password
            </p>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2 mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
                  placeholder="Min 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
                  placeholder="Re-enter new password"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FF6600] text-white font-semibold py-2.5 rounded-lg hover:bg-orange-600 disabled:opacity-50 transition"
              >
                {loading ? "Saving…" : "Set New Password"}
              </button>
            </form>
          </>
        )}

        {pageState === "success" && (
          <div className="mt-4 space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 text-center">
              Password reset successfully!
            </div>
            <button
              onClick={() => navigate("/")}
              className="w-full bg-[#FF6600] text-white font-semibold py-2.5 rounded-lg hover:bg-orange-600 transition"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

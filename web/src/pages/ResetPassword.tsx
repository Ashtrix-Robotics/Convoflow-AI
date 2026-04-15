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
    // Supabase SDK auto-processes the URL fragment and fires PASSWORD_RECOVERY.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPageState("form");
      }
    });

    // Check immediately — the SDK may have already processed the hash before
    // we subscribed. We only want to show the form for recovery sessions, so
    // verify the URL had a recovery fragment OR check the session's token type.
    const hash = window.location.hash;
    const isRecoveryUrl =
      hash.includes("type=recovery") || hash.includes("access_token");

    if (isRecoveryUrl) {
      // The SDK is still processing the hash — wait for onAuthStateChange
      // PASSWORD_RECOVERY event (already subscribed above). Set a 5s fallback.
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setPageState("form");
      });
      setTimeout(() => {
        setPageState((prev) => (prev === "loading" ? "invalid" : prev));
      }, 5000);
    } else {
      // No recovery token in URL — immediately invalid
      setPageState("invalid");
    }

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

      if (updateErr) {
        // Provide human-readable messages for known Supabase error codes
        const code = (updateErr as { code?: string }).code;
        if (code === "same_password") {
          throw new Error(
            "Your new password must be different from your current password.",
          );
        }
        if (code === "weak_password") {
          throw new Error(
            "Password is too weak. Please use at least 8 characters.",
          );
        }
        throw new Error(
          updateErr.message ||
            "Failed to update password. Please try again.",
        );
      }
      if (!updated.user) {
        throw new Error("Session expired. Please request a new reset link.");
      }

      // 2. Sync the new password to the platform DB so mobile login also works.
      //    These calls are non-fatal and have a short timeout to avoid hanging
      //    if the backend is still waking up (Render free tier).
      const { data: session } = await supabase.auth.getSession();
      if (session.session?.access_token) {
        try {
          await api.post(
            "/auth/reset-platform-password",
            {
              supabase_token: session.session.access_token,
              new_password: newPwd,
            },
            { timeout: 8000 },
          );
        } catch {
          // Non-fatal — web login is fixed; mobile may need manual reset.
          console.warn("Platform password sync failed — continuing.");
        }
      }

      // 3. Exchange the new Supabase session for a platform JWT and log in.
      if (session.session?.access_token) {
        try {
          const res = await api.post(
            "/auth/supabase-session",
            { supabase_token: session.session.access_token },
            { timeout: 8000 },
          );
          localStorage.setItem(TOKEN_KEY, res.data.access_token);
        } catch {
          // Could not get platform JWT; user will need to log in manually.
        }
      }

      setPageState("success");
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : "Failed to reset password. Please try again.";
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
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4 flex items-start gap-2">
                <span className="mt-0.5 shrink-0">&#9888;</span>
                <span>{error}</span>
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

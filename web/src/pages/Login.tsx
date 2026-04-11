import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { TOKEN_KEY } from "../config";
import { supabase } from "../lib/supabase";

type View = "login" | "forgot" | "forgot-sent";

export default function Login() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("login");

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot-password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Sign in via Supabase (handles session, refresh tokens, MFA, etc.)
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (authError || !authData.session) {
        throw new Error(authError?.message ?? "Authentication failed");
      }

      // 2. Exchange Supabase JWT for a platform JWT
      const res = await api.post("/auth/supabase-session", {
        supabase_token: authData.session.access_token,
      });
      localStorage.setItem(TOKEN_KEY, res.data.access_token);
      navigate("/");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Invalid email or password";
      setError(
        msg.includes("Invalid login credentials")
          ? "Invalid email or password"
          : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError("");
    if (!forgotEmail.trim())
      return setForgotError("Please enter your email address.");
    setForgotLoading(true);
    try {
      // redirectTo must match a URL in your Supabase project's "Redirect URLs" allowlist.
      const origin = window.location.origin;
      await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${origin}/reset-password`,
      });
      setView("forgot-sent");
    } catch {
      setForgotError("Failed to send reset email. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  // -- Render ------------------------------------------------------------
  if (view === "forgot-sent") {
    return (
      <div className="min-h-screen bg-[#002147] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center space-y-5">
          <div className="text-5xl">{"\u{1F4E7}"}</div>
          <h1 className="text-xl font-bold text-[#002147]">Check your inbox</h1>
          <p className="text-sm text-gray-500">
            We've sent a password reset link to{" "}
            <strong className="text-gray-700">{forgotEmail}</strong>. The link
            expires in 1 hour.
          </p>
          <p className="text-xs text-gray-400">
            Didn't receive it? Check spam or{" "}
            <button
              onClick={() => setView("forgot")}
              className="text-[#FF6600] hover:underline"
            >
              try again
            </button>
            .
          </p>
          <button
            onClick={() => {
              setView("login");
              setForgotEmail("");
            }}
            className="w-full bg-[#FF6600] text-white font-semibold py-2.5 rounded-lg hover:bg-orange-600 transition"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (view === "forgot") {
    return (
      <div className="min-h-screen bg-[#002147] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-[#002147] text-center mb-1">
            Convoflow AI
          </h1>
          <p className="text-sm text-gray-400 text-center mb-6">
            Enter your email to receive a reset link
          </p>

          {forgotError && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2 mb-4">
              {forgotError}
            </div>
          )}

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
                placeholder="agent@company.com"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={forgotLoading}
              className="w-full bg-[#FF6600] text-white font-semibold py-2.5 rounded-lg hover:bg-orange-600 disabled:opacity-50 transition"
            >
              {forgotLoading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          <button
            onClick={() => {
              setView("login");
              setForgotError("");
            }}
            className="mt-4 text-xs text-gray-400 hover:text-gray-600 w-full text-center block"
          >
            {"\u2190"} Back to Login
          </button>
        </div>
      </div>
    );
  }

  // Default: login view
  return (
    <div className="min-h-screen bg-[#002147] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-[#002147] text-center mb-1">
          Convoflow AI
        </h1>
        <p className="text-sm text-gray-400 text-center mb-6">
          Sign in to your dashboard
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
              placeholder="agent@company.com"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium text-gray-700">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setView("forgot");
                  setForgotEmail(email);
                  setForgotError("");
                }}
                className="text-xs text-[#FF6600] hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
              placeholder="********"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF6600] text-white font-semibold py-2.5 rounded-lg hover:bg-orange-600 disabled:opacity-50 transition"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-5">
          Secured by Supabase Auth
        </p>
      </div>
    </div>
  );
}

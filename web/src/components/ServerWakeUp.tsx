/**
 * ServerWakeUp — shows a non-blocking banner whenever the Render free-tier
 * backend is cold-starting (first request after 15 min of inactivity).
 *
 * How it works:
 *  - api.ts emits a custom DOM event "server:waking" when it detects a
 *    network-level failure or 502/503/504 and starts retrying.
 *  - api.ts emits "server:awake" when a retry succeeds.
 *  - This component listens to those events and shows/hides the banner.
 */

import { useEffect, useState } from "react";

export default function ServerWakeUp() {
  const [waking, setWaking] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const onWaking = (e: Event) => {
      setWaking(true);
      setAttempt((e as CustomEvent).detail?.attempt ?? 1);
    };
    const onAwake = () => setWaking(false);

    window.addEventListener("server:waking", onWaking);
    window.addEventListener("server:awake", onAwake);
    return () => {
      window.removeEventListener("server:waking", onWaking);
      window.removeEventListener("server:awake", onAwake);
    };
  }, []);

  if (!waking) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3
                 bg-gray-900 text-white text-sm px-5 py-3 rounded-full shadow-xl
                 border border-gray-700 animate-fade-in"
    >
      {/* Spinner */}
      <svg
        className="w-4 h-4 animate-spin text-blue-400 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          className="opacity-25"
          cx="12" cy="12" r="10"
          stroke="currentColor" strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      <span>
        Server is starting up&hellip;
        {attempt > 1 && (
          <span className="text-gray-400 ml-1">(retry {attempt})</span>
        )}
      </span>
      <span className="text-xs text-gray-400">Free tier cold-start, ~30s</span>
    </div>
  );
}

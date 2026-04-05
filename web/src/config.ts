/**
 * Convoflow AI — Web Dashboard Config
 *
 * SINGLE SOURCE OF TRUTH for all web configuration values.
 *
 * API URL resolution order:
 *   1. VITE_API_URL env var (set for production Vercel deployment)
 *   2. "/api"  — uses Vite's dev proxy → http://localhost:8000 (local dev)
 *
 * To set production URL in Vercel:
 *   vercel env add VITE_API_URL production
 *   value: https://convoflow-api.onrender.com
 */

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Base URL for all API requests.
 * In dev: Vite proxies /api → localhost:8000   (vite.config.ts proxy setting)
 * In prod: set VITE_API_URL=https://convoflow-api.onrender.com in Vercel env vars
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? "/api";

// ─── Auth ─────────────────────────────────────────────────────────────────────

/** localStorage key for JWT access token */
export const TOKEN_KEY = "access_token";

// ─── Query Settings ───────────────────────────────────────────────────────────

/** Poll a call record every N ms while status is pending/transcribing */
export const CALL_POLL_INTERVAL_MS = 3_000;

/** Stale time for TanStack Query cache (ms) */
export const QUERY_STALE_TIME_MS = 30_000;

/** Number of times queries are retried on failure */
export const QUERY_RETRY_COUNT = 2;

// ─── Pagination ───────────────────────────────────────────────────────────────

export const CALLS_PAGE_SIZE = 50;
export const LEADS_PAGE_SIZE = 50;

// ─── Intent / Status Enums ────────────────────────────────────────────────────
// Mirror of backend schemas.py — keep in sync.

export const INTENT_CATEGORIES = [
  "new",
  "no_answer",
  "not_interested",
  "callback_requested",
  "interested",
  "payment_pending",
  "future_planning",
  "converted",
  "wrong_number",
  "undecided",
] as const;

export type IntentCategory = (typeof INTENT_CATEGORIES)[number];

export const INTENT_LABELS: Record<IntentCategory, string> = {
  new: "New",
  no_answer: "No Answer",
  not_interested: "Not Interested",
  callback_requested: "Callback Requested",
  interested: "Interested",
  payment_pending: "Payment Pending",
  future_planning: "Future Planning",
  converted: "Converted",
  wrong_number: "Wrong Number",
  undecided: "Undecided",
};

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "in_progress",
  "qualified",
  "payment_sent",
  "converted",
  "lost",
  "deferred",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

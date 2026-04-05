/**
 * Convoflow AI — Mobile App Constants
 *
 * SINGLE SOURCE OF TRUTH for all configuration values.
 * - API base URL      → from EXPO_PUBLIC_API_URL env variable
 * - Storage keys      → token & user stored in expo-secure-store
 * - Query settings    → polling intervals, retry counts
 * - Audio settings    → format, preset, max duration
 * - UI settings       → pagination limits, debounce timings
 *
 * To change the API target: edit mobile/.env (local dev) or mobile/eas.json (builds).
 * Never hardcode URLs or keys — use these constants everywhere.
 */

// ─── API ──────────────────────────────────────────────────────────────────────

/** Base URL for the FastAPI backend. Set via EXPO_PUBLIC_API_URL in .env / eas.json */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Secure Storage Keys ──────────────────────────────────────────────────────

/** Key used to store the JWT access token in expo-secure-store */
export const TOKEN_KEY = "access_token";

// ─── HTTP / Query Settings ────────────────────────────────────────────────────

/** How often to poll a call record while status is 'pending' or 'transcribing' (ms) */
export const CALL_POLL_INTERVAL_MS = 3_000;

/** How often to poll the leads list for real-time updates (ms) */
export const LEADS_POLL_INTERVAL_MS = 30_000;

/** TanStack Query stale time — data older than this triggers a background refetch (ms) */
export const QUERY_STALE_TIME_MS = 60_000;

/** Number of times a failed query is retried before showing an error */
export const QUERY_RETRY_COUNT = 2;

// ─── Pagination ───────────────────────────────────────────────────────────────

/** Number of calls fetched per page in the history screen */
export const CALLS_PAGE_SIZE = 50;

/** Number of leads fetched per page in the leads screen */
export const LEADS_PAGE_SIZE = 50;

// ─── Audio Recording ─────────────────────────────────────────────────────────

/** MIME type sent in the FormData upload request */
export const AUDIO_MIME_TYPE = "audio/m4a";

/** File extension for recorded audio files */
export const AUDIO_EXTENSION = ".m4a";

/** Maximum recording duration in seconds (5 minutes) */
export const MAX_RECORDING_DURATION_SECONDS = 300;

// ─── Intent Categories ───────────────────────────────────────────────────────
// Mirror of schemas.IntentCategory on the backend — keep in sync.

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

// ─── Lead Statuses ────────────────────────────────────────────────────────────
// Mirror of schemas.LeadStatus on the backend — keep in sync.

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

// ─── Call Tags ────────────────────────────────────────────────────────────────

export const CALL_TAGS = ["connected", "no_answer", "wrong_number"] as const;
export type CallTag = (typeof CALL_TAGS)[number];

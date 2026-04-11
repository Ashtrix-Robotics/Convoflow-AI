import axios from "axios";
import { API_BASE_URL, TOKEN_KEY } from "../config";

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Emit a DOM event so ServerWakeUp component can react without prop-drilling. */
function emit(name: string, detail?: object) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

/**
 * Determine whether an error looks like a cold-start / transient failure
 * rather than a genuine application error.
 * - Network error (no response at all)  → Render is still booting
 * - 502 Bad Gateway / 503 / 504        → proxy reached Render but worker not up
 */
function isColdStart(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  if (!error.response) return true; // network error
  return [502, 503, 504].includes(error.response.status);
}

const COLD_START_MAX_RETRIES = 6; // up to ~60 s of retries
const COLD_START_RETRY_DELAY_MS = 10_000;

api.interceptors.response.use(
  (response) => {
    // If the server just came back up after we showed the waking banner, hide it.
    emit("server:awake");
    return response;
  },
  async (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    const cfg = error.config as typeof error.config & { _retryCount?: number };

    // Retry on cold-start signals only — never retry mutations that already
    // succeeded partially (POST/PATCH/DELETE) to avoid double-submit.
    const method = (cfg?.method ?? "get").toLowerCase();
    const isReadonly = method === "get" || method === "head";

    if (isColdStart(error) && isReadonly && cfg) {
      cfg._retryCount = (cfg._retryCount ?? 0) + 1;
      if (cfg._retryCount <= COLD_START_MAX_RETRIES) {
        emit("server:waking", { attempt: cfg._retryCount });
        await new Promise((r) => setTimeout(r, COLD_START_RETRY_DELAY_MS));
        return api(cfg);
      }
    }

    return Promise.reject(error);
  },
);

export default api;

export default api;

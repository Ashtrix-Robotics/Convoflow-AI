import axios from "axios";
import { FileSystemUploadType, uploadAsync } from "expo-file-system/legacy";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  API_BASE_URL,
  TOKEN_KEY,
  CALLS_PAGE_SIZE,
  UPLOAD_TIMEOUT_MS,
} from "../constants";

const api = axios.create({ baseURL: API_BASE_URL });

// Attach JWT token to every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — clear stale token and redirect to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      router.replace("/(auth)/login");
      return Promise.reject(new Error("Session expired. Please log in again."));
    }
    // Surface other HTTP errors with the server's detail message
    const detail = error?.response?.data?.detail;
    if (detail) {
      return Promise.reject(new Error(detail));
    }
    return Promise.reject(error);
  },
);

// ---- Auth ----

export const login = async (email: string, password: string) => {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  const res = await api.post("/auth/login", form.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  await SecureStore.setItemAsync(TOKEN_KEY, res.data.access_token);
  return res.data;
};

export const register = async (
  name: string,
  email: string,
  password: string,
) => {
  const res = await api.post("/auth/register", { name, email, password });
  return res.data;
};

export const logout = async () => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
};

export const getMe = async () => {
  const res = await api.get("/auth/me");
  return res.data;
};

// ---- Calls ----

export const uploadCall = async (
  audioUri: string,
  clientId?: string,
  durationSeconds?: number,
  leadId?: string,
  callOutcome?: string,
) => {
  // Normalize URI: on Android expo-audio returns a file:// URI; keep as-is.
  // On iOS it may return a path without scheme — prefix it.
  const normalizedUri =
    audioUri.startsWith("file://") || audioUri.startsWith("content://")
      ? audioUri
      : `file://${audioUri}`;

  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) {
    router.replace("/(auth)/login");
    throw new Error("Session expired. Please log in again.");
  }

  const parameters: Record<string, string> = {};
  if (clientId) parameters.client_id = clientId;
  if (durationSeconds) parameters.duration_seconds = String(durationSeconds);
  if (leadId) parameters.lead_id = leadId;
  if (callOutcome) parameters.call_tag = callOutcome;

  const parsePayload = (responseText: string) => {
    if (!responseText) return null;
    try {
      return JSON.parse(responseText);
    } catch {
      return { detail: responseText };
    }
  };

  try {
    const response = await uploadAsync(
      `${API_BASE_URL}/calls/upload`,
      normalizedUri,
      {
        httpMethod: "POST",
        uploadType: FileSystemUploadType.MULTIPART,
        fieldName: "audio",
        mimeType: "audio/m4a",
        parameters,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    const payload = parsePayload(response.body);

    if (response.status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      router.replace("/(auth)/login");
      throw new Error("Session expired. Please log in again.");
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        payload?.detail || `Upload failed with status ${response.status}.`,
      );
    }

    if (payload?.id) {
      return payload;
    }

    const latestCallResponse = await api.get("/calls", {
      params: { skip: 0, limit: 1 },
    });
    if (latestCallResponse.data?.[0]?.id) {
      return latestCallResponse.data[0];
    }

    throw new Error("Upload succeeded but no call record was returned.");
  } catch (error: any) {
    const formData = new FormData();
    formData.append("audio", {
      uri: normalizedUri,
      name: "recording.m4a",
      type: "audio/m4a",
    } as any);
    if (clientId) formData.append("client_id", clientId);
    if (durationSeconds)
      formData.append("duration_seconds", String(durationSeconds));
    if (leadId) formData.append("lead_id", leadId);
    if (callOutcome) formData.append("call_tag", callOutcome);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    try {
      const fallbackResponse = await fetch(`${API_BASE_URL}/calls/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: formData,
        signal: controller.signal,
      });

      const fallbackPayload = parsePayload(await fallbackResponse.text());

      if (fallbackResponse.status === 401) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        router.replace("/(auth)/login");
        throw new Error("Session expired. Please log in again.");
      }

      if (!fallbackResponse.ok) {
        throw new Error(
          fallbackPayload?.detail ||
            `Upload failed with status ${fallbackResponse.status}.`,
        );
      }

      return fallbackPayload;
    } catch (fallbackError: any) {
      if (fallbackError?.name === "AbortError") {
        throw new Error(
          "Upload timed out. Please try again on a stable network.",
        );
      }
      throw fallbackError?.message ? fallbackError : error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
};

export const getCalls = async (
  skip = 0,
  limit = CALLS_PAGE_SIZE,
  leadId?: string,
) => {
  const res = await api.get("/calls", {
    params: { skip, limit, lead_id: leadId },
  });
  return res.data;
};

export const getCall = async (callId: string) => {
  const res = await api.get(`/calls/${callId}`);
  return res.data;
};

export const linkCallToLead = async (callId: string, leadId?: string) => {
  const res = await api.patch(`/calls/${callId}/lead`, {
    lead_id: leadId ?? null,
  });
  return res.data;
};

// ---- Clients ----

export const getClients = async () => {
  const res = await api.get("/clients/");
  return res.data;
};

export const createClient = async (data: {
  name: string;
  phone?: string;
  email?: string;
  company?: string;
}) => {
  const res = await api.post("/clients/", data);
  return res.data;
};

// ---- Follow-Ups ----

export const createFollowUp = async (
  callId: string,
  task: string,
  dueDate?: string,
) => {
  const res = await api.post(`/followups/${callId}`, {
    task,
    due_date: dueDate,
  });
  return res.data;
};

export const getFollowUps = async (callId: string) => {
  const res = await api.get(`/followups/${callId}`);
  return res.data;
};

export const completeFollowUp = async (followupId: string) => {
  const res = await api.patch(`/followups/${followupId}/complete`);
  return res.data;
};

// ---- Leads ----

export const getLeads = async (params?: {
  status?: string;
  intent_category?: string;
  search?: string;
  skip?: number;
  limit?: number;
}) => {
  const res = await api.get("/leads", { params });
  return res.data;
};

export const getMyLeads = async () => {
  const res = await api.get("/leads/my");
  return res.data;
};

export const getLead = async (leadId: string) => {
  const res = await api.get(`/leads/${leadId}`);
  return res.data;
};

export const updateLead = async (
  leadId: string,
  data: {
    status?: string;
    notes?: string;
    callback_scheduled_at?: string;
    intent_category?: string;
  },
) => {
  const res = await api.patch(`/leads/${leadId}`, data);
  return res.data;
};

export const markNoAnswer = async (leadId: string) => {
  const res = await api.post(`/leads/${leadId}/no-answer`);
  return res.data;
};

// ---- Analytics ----

export const getAnalyticsOverview = async () => {
  const res = await api.get("/analytics/overview");
  return res.data;
};

export default api;

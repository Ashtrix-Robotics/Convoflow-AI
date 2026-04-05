# Web Dashboard — API Client Reference

Complete typed API client reference for the React web dashboard.

---

## API Client Setup (`src/lib/api.ts`)

```typescript
import axios from "axios";

const api = axios.create({ baseURL: "/api" });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

export default api;
```

---

## Authentication Methods

### `login(email, password)`

```typescript
export const login = async (
  email: string,
  password: string,
): Promise<string> => {
  const form = new URLSearchParams({ username: email, password });
  const { data } = await api.post<{ access_token: string }>(
    "/auth/login",
    form,
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    },
  );
  localStorage.setItem("access_token", data.access_token);
  return data.access_token;
};

export const logout = () => {
  localStorage.removeItem("access_token");
  window.location.href = "/login";
};
```

---

## Calls API

### Types

```typescript
export type CallStatus = "pending" | "transcribing" | "completed" | "failed";

export interface CallRecord {
  id: string;
  status: CallStatus;
  summary: string | null;
  action_items: string[] | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  next_step: string | null;
  raw_transcript: string | null;
  audio_filename: string;
  duration_seconds: number | null;
  created_at: string; // ISO 8601
  agent_id: string;
  client_id: string | null;
}
```

### Methods

```typescript
export const getCalls = async (): Promise<CallRecord[]> => {
  const { data } = await api.get<CallRecord[]>("/calls");
  return data;
};

export const getCall = async (id: string): Promise<CallRecord> => {
  const { data } = await api.get<CallRecord>(`/calls/${id}`);
  return data;
};
```

---

## Clients API

### Types

```typescript
export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  agent_id: string;
  created_at: string;
}

export interface ClientCreate {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
}
```

### Methods

```typescript
export const getClients = async (): Promise<Client[]> => {
  const { data } = await api.get<Client[]>("/clients");
  return data;
};

export const createClient = async (payload: ClientCreate): Promise<Client> => {
  const { data } = await api.post<Client>("/clients", payload);
  return data;
};
```

---

## Follow-Ups API

### Types

```typescript
export interface FollowUp {
  id: string;
  call_id: string;
  agent_id: string;
  due_date: string; // ISO 8601
  notes: string | null;
  completed: boolean;
  created_at: string;
}

export interface FollowUpCreate {
  call_id: string;
  due_date: string;
  notes?: string;
}
```

### Methods

```typescript
export const getFollowUps = async (): Promise<FollowUp[]> => {
  const { data } = await api.get<FollowUp[]>("/followups");
  return data;
};

export const createFollowUp = async (
  payload: FollowUpCreate,
): Promise<FollowUp> => {
  const { data } = await api.post<FollowUp>("/followups", payload);
  return data;
};

export const completeFollowUp = async (id: string): Promise<FollowUp> => {
  const { data } = await api.patch<FollowUp>(`/followups/${id}/complete`);
  return data;
};
```

---

## TanStack Query Hooks

### useCallsQuery — Dashboard list with auto-refresh

```typescript
import { useQuery } from "@tanstack/react-query";
import { getCalls } from "@/lib/api";

export function useCallsQuery() {
  return useQuery({
    queryKey: ["calls"],
    queryFn: getCalls,
    refetchInterval: 15_000, // refresh every 15s
  });
}
```

### useCallQuery — Poll until transcription finishes

```typescript
export function useCallQuery(id: string) {
  return useQuery({
    queryKey: ["calls", id],
    queryFn: () => getCall(id),
    refetchInterval: (data) =>
      data && ["completed", "failed"].includes(data.status) ? false : 3_000,
  });
}
```

---

## Vite Proxy Config (`vite.config.ts`)

```typescript
export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
```

All `api.get('/calls')` calls go to `http://localhost:8000/calls` in development.
In production, configure Nginx/Caddy to proxy `/api` to the FastAPI server.

---

## Error Handling Pattern

```typescript
const mutation = useMutation({
  mutationFn: createFollowUp,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["followups"] }),
  onError: (error: AxiosError<{ detail: string }>) => {
    const message = error.response?.data?.detail ?? "Something went wrong";
    setError(message);
  },
});
```

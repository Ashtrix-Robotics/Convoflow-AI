---
name: react-native-expo-ui
description: "Use this skill for mobile UI development in the Convoflow AI project. Covers Expo Router v4 file-based navigation, Expo SDK 53 component patterns, TanStack Query v5 data fetching with polling, Zustand global state, TypeScript patterns, recording screen state machine, authentication flow, and common NativeWind/StyleSheet patterns. Trigger when working on any file in mobile/app/ or mobile/components/."
---

# React Native + Expo UI Skill — Convoflow AI

## Project Stack

- **Expo SDK 53** (React Native ~0.79)
- **Expo Router v4** — file-based routing
- **TanStack Query v5** — server state management
- **Zustand v5** — global client state (auth token, agent profile)
- **Axios** — HTTP client with JWT interceptor
- **expo-av** — audio recording
- **expo-secure-store** — JWT token storage

---

## Directory Structure

```
mobile/
├── app/
│   ├── _layout.tsx          # Root layout — providers (QueryClient, auth)
│   ├── (auth)/
│   │   └── login.tsx        # Login screen
│   └── (tabs)/
│       ├── _layout.tsx      # Tab bar layout
│       ├── record.tsx       # Recording screen (main feature)
│       ├── calls.tsx        # Call history list
│       └── profile.tsx      # Agent profile
├── components/              # Reusable UI components
├── services/
│   ├── api.ts               # Axios client + all API methods
│   └── audio.ts             # expo-av recording wrapper
└── stores/
    └── auth.ts              # Zustand auth store
```

---

## Expo Router v4 Navigation Patterns

### Root layout with auth guard

```tsx
// app/_layout.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "../stores/auth";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

export default function RootLayout() {
  const { token } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const inAuthGroup = segments[0] === "(auth)";
    if (!token && !inAuthGroup) router.replace("/(auth)/login");
    if (token && inAuthGroup) router.replace("/(tabs)/record");
  }, [token]);

  return (
    <QueryClientProvider client={queryClient}>
      <Slot />
    </QueryClientProvider>
  );
}
```

### Navigate programmatically

```tsx
import { useRouter } from "expo-router";
const router = useRouter();

router.push("/(tabs)/calls"); // push onto stack
router.replace("/(tabs)/record"); // replace current screen
router.push(`/calls/${callId}`); // dynamic route
```

---

## Auth Store (Zustand v5)

```tsx
// stores/auth.ts
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

interface AuthState {
  token: string | null;
  setToken: (token: string) => Promise<void>;
  clearToken: () => Promise<void>;
  loadToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,

  setToken: async (token) => {
    await SecureStore.setItemAsync("access_token", token);
    set({ token });
  },

  clearToken: async () => {
    await SecureStore.deleteItemAsync("access_token");
    set({ token: null });
  },

  loadToken: async () => {
    const token = await SecureStore.getItemAsync("access_token");
    set({ token });
  },
}));
```

**NEVER** use `AsyncStorage` for tokens — use `expo-secure-store` only (hardware-backed encryption).

---

## API Client Pattern

```tsx
// services/api.ts
import axios from "axios";
import * as SecureStore from "expo-secure-store";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

export const apiClient = axios.create({ baseURL: BASE_URL });

// Attach token to every request
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// API methods
export const api = {
  login: (email: string, password: string) =>
    apiClient.post(
      "/auth/login",
      new URLSearchParams({ username: email, password }),
    ),

  uploadCall: (audioUri: string, clientId?: string) => {
    const form = new FormData();
    form.append("audio", {
      uri: audioUri,
      name: "call.m4a",
      type: "audio/m4a",
    } as any);
    if (clientId) form.append("client_id", clientId);
    return apiClient.post<CallRecord>("/calls/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  getCall: (id: string) => apiClient.get<CallRecord>(`/calls/${id}`),
  getCalls: () => apiClient.get<CallRecord[]>("/calls"),
  getClients: () => apiClient.get<Client[]>("/clients"),
};
```

---

## TanStack Query v5 Patterns

### Polling until transcription completes

```tsx
import { useQuery } from "@tanstack/react-query";

function useCallStatus(callId: string | null) {
  return useQuery({
    queryKey: ["call", callId],
    queryFn: () => api.getCall(callId!).then((r) => r.data),
    enabled: !!callId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Stop polling once terminal state is reached
      return status === "completed" || status === "failed" ? false : 3000;
    },
  });
}
```

### Prefetch call list on mount

```tsx
const queryClient = useQueryClient();

useEffect(() => {
  queryClient.prefetchQuery({
    queryKey: ["calls"],
    queryFn: () => api.getCalls().then((r) => r.data),
  });
}, []);
```

---

## Recording Screen State Machine

```
idle ──► recording ──► uploading ──► transcribing ──► done
                                                      │
                                                      └──► failed
```

```tsx
type RecordingState =
  | "idle"
  | "recording"
  | "uploading"
  | "transcribing"
  | "done"
  | "failed";

const [state, setState] = useState<RecordingState>("idle");
const [seconds, setSeconds] = useState(0);
const [callId, setCallId] = useState<string | null>(null);

// Timer
useEffect(() => {
  if (state !== "recording") return;
  const id = setInterval(() => setSeconds((s) => s + 1), 1000);
  return () => clearInterval(id);
}, [state]);

const formatTime = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
```

---

## Permissions (expo-av)

Always request permissions before starting — check BEFORE rendering the record button:

```tsx
import { Audio } from "expo-av";

async function checkPermissions(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === "granted";
}

// Set audio mode for recording
await Audio.setAudioModeAsync({
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
  staysActiveInBackground: true,
  shouldDuckAndroid: true,
});
```

---

## Status Badge Component

```tsx
const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#fef3c7", text: "#92400e" },
  transcribing: { bg: "#dbeafe", text: "#1d4ed8" },
  completed: { bg: "#d1fae5", text: "#065f46" },
  failed: { bg: "#fee2e2", text: "#991b1b" },
};

function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] ?? { bg: "#f3f4f6", text: "#374151" };
  return (
    <View
      style={{
        backgroundColor: colors.bg,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
        {status.toUpperCase()}
      </Text>
    </View>
  );
}
```

---

## app.json — Required Permissions

```json
{
  "expo": {
    "plugins": [
      [
        "expo-av",
        {
          "microphonePermission": "Convoflow AI needs microphone access to record sales conversations."
        }
      ]
    ],
    "android": {
      "permissions": ["RECORD_AUDIO", "INTERNET"]
    }
  }
}
```

---

## Environment Variables

Expo reads `EXPO_PUBLIC_*` variables from `.env`:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:8000
```

Access in code: `process.env.EXPO_PUBLIC_API_URL`

For local testing on a physical device, use your machine's LAN IP — not `localhost`.

---

## Common Pitfalls

| Issue                             | Fix                                                     |
| --------------------------------- | ------------------------------------------------------- |
| Audio recording silenced on iOS   | Set `playsInSilentModeIOS: true` in `setAudioModeAsync` |
| Token lost after app restart      | Load token in `loadToken()` in root layout `useEffect`  |
| `localhost` unreachable on device | Use LAN IP (192.168.x.x) in `EXPO_PUBLIC_API_URL`       |
| Multipart upload fails            | Pass `type: "audio/m4a"` in FormData blob object        |
| QueryClient missing context       | Wrap root layout in `<QueryClientProvider>`             |

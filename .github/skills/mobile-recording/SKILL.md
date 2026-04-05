---
name: mobile-recording
description: "Use this skill for everything related to the Convoflow AI mobile app built with React Native and Expo. Covers audio recording (expo-av and expo-audio migration), file upload to the FastAPI backend, agent authentication (JWT + SecureStore), microphone permissions, metering/audio levels, background recording, Zustand state management, and Expo Router navigation patterns. Trigger when working on: mobile recording UI, audio capture, microphone permissions, call upload, mobile auth flow, background audio, Bluetooth input, or any file in the mobile/ directory."
---

# Mobile Recording Skill — Convoflow AI

## Project Context

This is a **React Native + Expo SDK 53** mobile app where sales agents:

1. Record client conversations from their phone
2. Upload audio to the FastAPI backend (`/calls/upload`)
3. View transcription results and follow-ups
4. Authenticate with JWT stored in `expo-secure-store`

**Current stack:** `expo-av ~15.0.0` (the active package in `mobile/package.json`).  
**Migration path:** Expo is actively replacing `expo-av` with the new `expo-audio` package — see the [Migration to expo-audio](#migration-to-expo-audio) section below.

---

## Audio Recording — expo-av (Current)

### Permission flow — check `canAskAgain` for better UX

```typescript
import { Audio } from "expo-av";
import { Alert, Linking } from "react-native";

async function ensureMicPermission(): Promise<boolean> {
  const { status, canAskAgain } = await Audio.requestPermissionsAsync();

  if (status === "granted") return true;

  if (!canAskAgain) {
    // User permanently denied — send them to Settings
    Alert.alert(
      "Microphone Blocked",
      "Please enable microphone access in your device Settings.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ],
    );
  } else {
    Alert.alert(
      "Permission Required",
      "Microphone access is needed to record calls.",
    );
  }
  return false;
}
```

### Set audio mode before recording (required on iOS + Android)

```typescript
await Audio.setAudioModeAsync({
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true, // record even when ringer switch is off
  staysActiveInBackground: true, // don't stop when app backgrounds mid-call
  interruptionModeIOS: Audio.InterruptionModeIOS.DoNotMix,
  interruptionModeAndroid: Audio.InterruptionModeAndroid.DoNotMix,
  shouldDuckAndroid: false,
});
```

> **Reset after recording:** `setAudioModeAsync({ allowsRecordingIOS: false })` when done.

### Recommended recording options for speech transcription

```typescript
// Use HIGH_QUALITY preset — outputs M4A, 44100 Hz, 128 kbps, stereo
const { recording } = await Audio.Recording.createAsync(
  Audio.RecordingOptionsPresets.HIGH_QUALITY,
);
```

Supported upload formats by OpenAI Whisper: `mp3`, `mp4`, `mpeg`, `mpga`, `m4a`, `wav`, `webm`.  
Always use `.m4a` — never send `audio/mpeg` as MIME type, the backend's MIME validator will return 422.

### Enable audio level metering (for waveform/VU meter UI)

Pass a custom options object to enable the `metering` field in the recording status:

```typescript
const { recording } = await Audio.Recording.createAsync({
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  isMeteringEnabled: true, // adds metering dB level to status
  android: {
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
    audioSource: Audio.AndroidAudioSource.VOICE_COMMUNICATION, // echo cancellation
  },
});

// Poll metering in real-time (every 100ms):
recording.setOnRecordingStatusUpdate((status) => {
  if (status.isRecording && status.metering !== undefined) {
    setDbLevel(status.metering); // dB value, typically -160 to 0
  }
});
recording.setProgressUpdateInterval(100);
```

> **Android `VOICE_COMMUNICATION` source:** Uses hardware echo cancellation and automatic gain control — ideal for sales call recordings. Produces cleaner transcripts than the default `MIC` source.

### Stop and get URI

```typescript
await recording.stopAndUnloadAsync();
// Reset audio session for playback
await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

const status = await recording.getStatusAsync();
const uri = recording.getURI(); // local file:// path
const durationMs = status.durationMillis;
```

### Clean up after upload

Always delete the local temp file after a successful upload:

```typescript
import * as FileSystem from "expo-file-system";
await FileSystem.deleteAsync(uri, { idempotent: true }); // idempotent: no error if already gone
```

---

## Migration to expo-audio

> **When to migrate:** Expo SDK 54+ ships `expo-audio` as the stable replacement.  
> **Install:** `npx expo install expo-audio` (then remove `expo-av` if no longer needed for playback).

The new `expo-audio` package has a **hooks-based API** that is cleaner and lifecycle-safe:

```typescript
import {
  useAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from "expo-audio";

// 1. Request permissions (new API)
const { granted } = await AudioModule.requestRecordingPermissionsAsync();

// 2. Set audio mode (new option names — cross-platform)
await setAudioModeAsync({
  playsInSilentMode: true, // replaces playsInSilentModeIOS
  allowsRecording: true, // replaces allowsRecordingIOS
  allowsBackgroundRecording: true, // new: enables background recording
  interruptionMode: "doNotMix", // replaces interruptionModeIOS/Android
});

// 3. Create recorder hook (manages lifecycle automatically)
const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
const recorderState = useAudioRecorderState(audioRecorder); // { isRecording, durationMillis, metering }

// 4. Start / stop
await audioRecorder.prepareToRecordAsync();
audioRecorder.record(); // sync — non-blocking

await audioRecorder.stop(); // async — flushes to disk
const uri = audioRecorder.uri; // available immediately after stop()
```

### Background recording in expo-audio (config plugin)

```json
// app.json
{
  "expo": {
    "plugins": [
      [
        "expo-audio",
        {
          "microphonePermission": "Allow $(PRODUCT_NAME) to record audio.",
          "enableBackgroundRecording": true
        }
      ]
    ]
  }
}
```

> Android shows a persistent foreground service notification during background recording (OS requirement). iOS runs silently.

---

## Uploading Audio to the Backend

Use `multipart/form-data` via native `fetch` (preferred over axios for binary uploads):

```typescript
async function uploadRecording(
  uri: string,
  clientId?: string,
  durationSeconds?: number,
) {
  const filename = uri.split("/").pop() ?? "recording.m4a";
  const formData = new FormData();

  formData.append("audio", {
    uri,
    name: filename,
    type: "audio/m4a", // MUST be audio/m4a — backend rejects audio/mpeg
  } as any);

  if (clientId) formData.append("client_id", clientId);
  if (durationSeconds)
    formData.append("duration_seconds", String(durationSeconds));

  const token = await SecureStore.getItemAsync("access_token");
  const response = await fetch(
    `${process.env.EXPO_PUBLIC_API_URL}/calls/upload`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed ${response.status}: ${text}`);
  }

  return response.json() as Promise<{ id: string }>;
}
```

The backend returns `202 Accepted` immediately — transcription runs as a background task.  
Poll `GET /calls/{id}` every 3 seconds (via TanStack Query `refetchInterval`) until `status === "completed"` or `"failed"`.

### Axios alternative (also works)

```typescript
await api.post("/calls/upload", formData, {
  headers: { "Content-Type": "multipart/form-data" },
});
```

---

## Authentication

### Storing JWT securely

```typescript
import * as SecureStore from "expo-secure-store";

// After login — NEVER use AsyncStorage for tokens
await SecureStore.setItemAsync("access_token", token);

// On logout:
await SecureStore.deleteItemAsync("access_token");

// Axios interceptor pattern (in services/api.ts):
axiosInstance.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### Login flow (OAuth2 form body)

```typescript
// POST /auth/login expects application/x-www-form-urlencoded
const form = new URLSearchParams();
form.append("username", email);
form.append("password", password);
await api.post("/auth/login", form.toString(), {
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
});
```

### Zustand auth store

```typescript
// store/authStore.ts
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

interface AuthState {
  token: string | null;
  setToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  setToken: async (token) => {
    await SecureStore.setItemAsync("access_token", token);
    set({ token });
  },
  logout: async () => {
    await SecureStore.deleteItemAsync("access_token");
    set({ token: null });
  },
  hydrate: async () => {
    const token = await SecureStore.getItemAsync("access_token");
    set({ token });
  },
}));
```

Call `useAuthStore.getState().hydrate()` in the root `_layout.tsx` on mount.

---

## Recording State Machine (Zustand)

```typescript
// store/recordingStore.ts
import { create } from "zustand";
import { Audio } from "expo-av";

type RecordingPhase =
  | "idle"
  | "recording"
  | "stopped"
  | "uploading"
  | "done"
  | "failed";

interface RecordingState {
  phase: RecordingPhase;
  recording: Audio.Recording | null;
  lastUri: string | null;
  durationMs: number;
  dbLevel: number; // metering level for waveform display
  setPhase: (p: RecordingPhase) => void;
  setRecording: (r: Audio.Recording | null) => void;
  setLastUri: (uri: string) => void;
  setDurationMs: (ms: number) => void;
  setDbLevel: (db: number) => void;
  reset: () => void;
}

export const useRecordingStore = create<RecordingState>((set) => ({
  phase: "idle",
  recording: null,
  lastUri: null,
  durationMs: 0,
  dbLevel: -160,
  setPhase: (phase) => set({ phase }),
  setRecording: (recording) => set({ recording }),
  setLastUri: (lastUri) => set({ lastUri }),
  setDurationMs: (durationMs) => set({ durationMs }),
  setDbLevel: (dbLevel) => set({ dbLevel }),
  reset: () =>
    set({
      phase: "idle",
      recording: null,
      lastUri: null,
      durationMs: 0,
      dbLevel: -160,
    }),
}));
```

---

## Navigation (Expo Router v4)

```
mobile/app/
├── _layout.tsx          Root layout (QueryClient, AuthStore hydration)
├── (auth)/
│   ├── login.tsx
│   └── register.tsx
└── (tabs)/
    ├── _layout.tsx      Tab bar — hide during recording
    ├── record.tsx       Primary recording screen
    ├── calls.tsx        Call history list
    └── profile.tsx      Agent profile / settings
```

Navigate programmatically:

```typescript
import { router } from "expo-router";
router.replace("/(tabs)/record"); // after login
router.push(`/calls/${callId}`); // to call detail
router.back(); // go back
```

Protect routes by checking `useAuthStore` in `_layout.tsx` and redirecting unauthenticated users to `/(auth)/login`.

---

## app.json Required Permissions

iOS (`infoPlist` in `app.json`):

```json
"infoPlist": {
  "NSMicrophoneUsageDescription": "Convoflow AI needs microphone access to record client conversations.",
  "NSSpeechRecognitionUsageDescription": "Convoflow AI uses speech recognition to transcribe conversations."
}
```

Android:

```json
"permissions": ["RECORD_AUDIO", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE"]
```

For background recording with `expo-audio` (SDK 54+), use the config plugin instead of manual permissions — see [Migration to expo-audio](#migration-to-expo-audio).

---

## Common Patterns

### Recording timer

```typescript
const [duration, setDuration] = useState(0);
const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

const startTimer = () => {
  setDuration(0);
  timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
};
const stopTimer = () => {
  if (timerRef.current) {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }
};

const format = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
```

### Audio level for animated waveform

```typescript
// Normalized 0–1 from dB (typically -60dB = silence, 0dB = max)
const normalizedLevel = Math.max(0, (dbLevel + 60) / 60); // 0 to 1

// In JSX — simple animated bar
<Animated.View style={{ height: normalizedLevel * 80, backgroundColor: '#FF3B30' }} />
```

### Polling for transcription (TanStack Query)

```typescript
// In app/calls/[id].tsx
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";

const { id } = useLocalSearchParams<{ id: string }>();

const { data: call } = useQuery({
  queryKey: ["calls", id],
  queryFn: () => apiClient.getCall(id),
  refetchInterval: (query) => {
    const status = query.state.data?.status;
    return status === "completed" || status === "failed" ? false : 3_000;
  },
});
```

### Input device selection (for Bluetooth headsets)

```typescript
// List available inputs after prepareToRecordAsync():
const inputs = (await recording.getAvailableInputs?.()) ?? [];
// [{ uid: "...", name: "AirPods Pro", type: "Bluetooth" }, ...]

// Select a specific input:
await recording.setInput?.(inputs[0].uid);
```

> `getAvailableInputs` / `setInput` are only available after the recording is prepared (not before `createAsync`).

---

## Troubleshooting

| Problem                                  | Likely Cause                     | Fix                                                                         |
| ---------------------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| Recording stops when screen locks        | `staysActiveInBackground: false` | Set it `true` in `setAudioModeAsync`                                        |
| 422 from `/calls/upload`                 | Wrong MIME type in FormData      | Use `type: "audio/m4a"` — not `"audio/mpeg"`                                |
| Blank waveform / no metering             | `isMeteringEnabled` not set      | Pass custom options object with `isMeteringEnabled: true`                   |
| `COULDNT_START_RECORDING`                | Permission not granted           | Always call `requestPermissionsAsync()` first                               |
| `Recording session was abandoned`        | App went to background           | Set `staysActiveInBackground: true`                                         |
| Recording works on iOS, fails on Android | Missing permission               | Ensure `RECORD_AUDIO` is in `app.json` permissions                          |
| Noisy / echoing recording on Android     | Default `MIC` source             | Use `audioSource: Audio.AndroidAudioSource.VOICE_COMMUNICATION`             |
| Upload hangs / times out                 | Large file over slow connection  | Show progress with `onUploadProgress` in axios or rely on background upload |

### State machine for record screen

```
idle → recording → uploading → done → idle
```

### Polling for transcription completion

```typescript
const { data: call } = useQuery({
  queryKey: ["call", callId],
  queryFn: () => api.get(`/calls/${callId}`).then((r) => r.data),
  refetchInterval: (data) => (data?.status === "completed" ? false : 3000),
});
```

---

## Key API Endpoints (mobile-relevant)

| Method | Path                   | Purpose                         |
| ------ | ---------------------- | ------------------------------- |
| POST   | `/auth/login`          | Login (OAuth2 form)             |
| POST   | `/auth/register`       | Register new agent              |
| GET    | `/auth/me`             | Get current agent               |
| POST   | `/calls/upload`        | Upload audio (multipart)        |
| GET    | `/calls/`              | List agent's calls              |
| GET    | `/calls/{id}`          | Get single call + transcription |
| GET    | `/clients/`            | List clients                    |
| POST   | `/clients/`            | Create client                   |
| POST   | `/followups/{call_id}` | Create follow-up task           |

---

## Dependencies (mobile/package.json)

- `expo-av` — Audio recording and playback
- `expo-file-system` — File cleanup after upload
- `expo-secure-store` — JWT storage
- `expo-router` — Navigation
- `@tanstack/react-query` — Data fetching and caching
- `zustand` — Global state (auth store)
- `axios` — HTTP client

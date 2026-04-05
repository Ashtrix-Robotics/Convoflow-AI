# Recording Upload Flow

Complete annotated sequence of the record → upload → poll flow in the mobile app.

---

## State Machine

```
idle → recording → paused → recording  (pause/resume cycle)
     ↘           ↗
      stopped → uploading → done
              ↘           ↘
             failed       failed (retry → uploading)
```

```typescript
type RecordingPhase =
  | "idle"
  | "recording"
  | "paused" // new: explicit pause state
  | "stopped" // recorded file ready, not yet uploaded
  | "uploading"
  | "done"
  | "failed";
```

---

## Complete Flow with Code

### Step 1: Start Recording

```typescript
async function startRecording() {
  // 1. Check permission (with canAskAgain fallback)
  const { status, canAskAgain } = await Audio.requestPermissionsAsync();
  if (status !== "granted") {
    if (!canAskAgain) {
      Alert.alert("Microphone Blocked", "Enable in Settings.", [
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ]);
    } else {
      Alert.alert("Permission Required", "Enable microphone access.");
    }
    return;
  }

  // 2. Configure audio session
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: Audio.InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: Audio.InterruptionModeAndroid.DoNotMix,
  });

  // 3. Create recording with metering + Android echo cancellation
  const { recording } = await Audio.Recording.createAsync({
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
    android: {
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
      audioSource: Audio.AndroidAudioSource.VOICE_COMMUNICATION,
    },
  });

  // 4. Hook up real-time metering callback
  recording.setOnRecordingStatusUpdate((s) => {
    if (s.metering !== undefined) setDbLevel(s.metering);
  });
  recording.setProgressUpdateInterval(100);

  setRecording(recording);
  setPhase("recording");
  startTimer();
}
```

---

### Step 2: Pause / Resume

```typescript
async function pauseRecording() {
  if (!recording) return;
  await recording.pauseAsync();
  stopTimer();
  setPhase("paused");
}

async function resumeRecording() {
  if (!recording) return;
  await recording.startAsync();
  startTimer();
  setPhase("recording");
}
```

---

### Step 3: Stop Recording

```typescript
async function stopRecording() {
  if (!recording) return;

  stopTimer();
  await recording.stopAndUnloadAsync(); // flushes file to disk

  // Reset audio session so playback works normally afterwards
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

  const uri = recording.getURI();
  const status = await recording.getStatusAsync();
  const durationMs = status.durationMillis ?? 0;

  setRecording(null);
  setPhase("stopped");

  if (uri) {
    setLastUri(uri);
    await handleUpload(uri, durationMs);
  } else {
    setPhase("failed");
  }
}
```

---

### Step 4: Upload to Backend

```typescript
async function handleUpload(uri: string, durationMs: number) {
  setPhase("uploading");

  const filename = uri.split("/").pop() ?? "recording.m4a";
  const formData = new FormData();

  // MIME type MUST be audio/m4a — backend validator rejects audio/mpeg
  formData.append("audio", { uri, name: filename, type: "audio/m4a" } as any);

  const durationSeconds = Math.round(durationMs / 1000);
  if (durationSeconds > 0)
    formData.append("duration_seconds", String(durationSeconds));
  if (selectedClientId) formData.append("client_id", selectedClientId);

  try {
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

    const call: { id: string } = await response.json();

    // Clean up the local temp file
    await FileSystem.deleteAsync(uri, { idempotent: true });

    setPhase("done");
    router.push(`/calls/${call.id}`);
  } catch (error) {
    console.error("Upload error:", error);
    setPhase("failed");
    // lastUri is still set — user can retry
  }
}
```

---

### Step 5: Poll for Transcription (on CallDetail screen)

```typescript
// In app/calls/[id].tsx
const { id } = useLocalSearchParams<{ id: string }>();

const { data: call } = useQuery({
  queryKey: ["calls", id],
  queryFn: () => apiClient.getCall(id),
  refetchInterval: (query) => {
    const status = query.state.data?.status;
    // Stop polling once terminal state reached
    return status === "completed" || status === "failed" ? false : 3_000;
  },
});
```

**Lifecycle:** `pending` → `transcribing` → `completed` — polling stops automatically.

---

## Error Recovery (Retry Button)

```typescript
{phase === "failed" && lastUri && (
  <TouchableOpacity
    style={styles.retryButton}
    onPress={() => handleUpload(lastUri, lastDurationMs)}
  >
    <Text>Retry Upload</Text>
  </TouchableOpacity>
)}

{phase === "failed" && !lastUri && (
  // File lost — only option is to re-record
  <TouchableOpacity onPress={() => setPhase("idle")}>
    <Text>Record Again</Text>
  </TouchableOpacity>
)}
```

---

## Zustand Store Integration

```typescript
// Record screen uses the Zustand recording store:
import { useRecordingStore } from "@/store/recordingStore";

const { phase, setPhase, setRecording, setLastUri, setDbLevel, reset } =
  useRecordingStore();

// On mount — always reset to idle
useEffect(() => {
  reset();
}, []);

// Unmount — clean up any in-progress recording
useEffect(() => {
  return () => {
    const { recording } = useRecordingStore.getState();
    if (recording) {
      recording.stopAndUnloadAsync().catch(() => {});
    }
  };
}, []);
```

---

## FormData Field Reference

| Field              | Value                                               | Required |
| ------------------ | --------------------------------------------------- | -------- |
| `audio`            | `{ uri, name: "recording.m4a", type: "audio/m4a" }` | ✅       |
| `client_id`        | UUID string                                         | Optional |
| `duration_seconds` | Integer (rounded from ms)                           | Optional |

> `type` in FormData MUST be `audio/m4a`. Using `audio/mpeg` causes a **422 Unprocessable Entity** from the backend MIME validator.

---

## File Cleanup

Always delete the temp file after a successful upload:

```typescript
import * as FileSystem from "expo-file-system";

await FileSystem.deleteAsync(uri, { idempotent: true });
// idempotent: true — no error if file is already gone
```

Expo's temp cache is not guaranteed to persist between app launches. Accumulated temp files waste device storage — clean up every time.

---

## expo-audio Migration (SDK 54+)

The full flow using `expo-audio`'s hooks-based API:

```typescript
import {
  useAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from "expo-audio";
import * as FileSystem from "expo-file-system";
import * as SecureStore from "expo-secure-store";

export function useRecordAndUpload() {
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  // recorderState: { isRecording, durationMillis, metering, canRecord }

  async function start() {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) return;

    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
      allowsBackgroundRecording: true,
      interruptionMode: "doNotMix",
    });

    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
  }

  async function stopAndUpload(clientId?: string) {
    await audioRecorder.stop();
    const uri = audioRecorder.uri;
    if (!uri) return;

    const formData = new FormData();
    formData.append("audio", {
      uri,
      name: "recording.m4a",
      type: "audio/m4a",
    } as any);
    if (clientId) formData.append("client_id", clientId);

    const token = await SecureStore.getItemAsync("access_token");
    const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/calls/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (res.ok) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      const { id } = await res.json();
      return id as string;
    }
    throw new Error(`Upload failed: ${res.status}`);
  }

  return { start, stopAndUpload, recorderState };
}
```

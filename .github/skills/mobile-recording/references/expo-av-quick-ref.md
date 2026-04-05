# expo-av Recording API — Quick Reference

All essential options for `Audio.Recording` and `Audio.Sound` needed in the Convoflow AI mobile app.  
**Package in use:** `expo-av ~15.0.0` (Expo SDK 53). See below for the `expo-audio` migration path.

---

## Audio Mode Setup (call before recording)

```typescript
import { Audio } from "expo-av";

await Audio.setAudioModeAsync({
  allowsRecordingIOS: true, // REQUIRED on iOS
  playsInSilentModeIOS: true, // record even in silent mode
  staysActiveInBackground: true, // keep recording if app backgrounds
  shouldDuckAndroid: false, // don't lower other audio
  interruptionModeIOS: Audio.InterruptionModeIOS.DoNotMix,
  interruptionModeAndroid: Audio.InterruptionModeAndroid.DoNotMix,
});
```

> **Reset after recording:** Call `setAudioModeAsync({ allowsRecordingIOS: false })` when done to restore normal playback mode.

---

## Preset Comparison

| Preset         | Format | Sample Rate | Bitrate  | Use Case                  |
| -------------- | ------ | ----------- | -------- | ------------------------- |
| `HIGH_QUALITY` | .m4a   | 44.1 kHz    | 128 kbps | ✅ Sales calls            |
| `LOW_QUALITY`  | .m4a   | 44.1 kHz    | 64 kbps  | Voice memos               |
| Custom options | Custom | Custom      | Custom   | Metering / Android source |

**Always use `HIGH_QUALITY`** — Whisper accuracy degrades with lower bitrates.

```typescript
const { recording } = await Audio.Recording.createAsync(
  Audio.RecordingOptionsPresets.HIGH_QUALITY,
);
```

---

## Custom Options — Enable Metering + Android Echo Cancellation

For a visual waveform/VU meter and cleaner Android recordings, pass a custom options object:

```typescript
const { recording } = await Audio.Recording.createAsync({
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
  android: {
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
    audioSource: Audio.AndroidAudioSource.VOICE_COMMUNICATION, // hardware echo cancellation
  },
});

recording.setOnRecordingStatusUpdate((status) => {
  if (status.isRecording && status.metering !== undefined) {
    // status.metering is in dB: typically -160 (silence) to 0 (max)
    setDbLevel(status.metering);
  }
});
recording.setProgressUpdateInterval(100); // ms
```

---

## Recording Object Methods

```typescript
recording.pauseAsync(); // Pause — file is preserved on disk
recording.startAsync(); // Resume after pause
recording.stopAndUnloadAsync(); // Stop + flush + release — ALWAYS call this
recording.getStatusAsync(); // → RecordingStatus
recording.getURI(); // string | null — local file:// path
recording.getAvailableInputs?.(); // List Bluetooth/wired mic inputs (iOS only)
recording.setInput?.(uid); // Select a specific input device
recording.setOnRecordingStatusUpdate(cb); // real-time status callback
recording.setProgressUpdateInterval(ms); // how often status fires (default: 500ms)
```

---

## Recording Status Object

```typescript
type RecordingStatus = {
  canRecord: boolean;
  isRecording: boolean;
  isDoneRecording: boolean;
  durationMillis: number; // elapsed ms
  metering?: number; // current dB level (-160 to 0), requires isMeteringEnabled: true
};
```

---

## Android AudioSource Values

| Value                                          | Use Case                                    |
| ---------------------------------------------- | ------------------------------------------- |
| `Audio.AndroidAudioSource.DEFAULT`             | System default                              |
| `Audio.AndroidAudioSource.MIC`                 | Raw microphone                              |
| `Audio.AndroidAudioSource.VOICE_COMMUNICATION` | ✅ VoIP / calls — applies echo cancellation |
| `Audio.AndroidAudioSource.VOICE_RECOGNITION`   | Optimized for voice recognition (ASR)       |
| `Audio.AndroidAudioSource.CAMCORDER`           | Tuned for video recording                   |

For sales call recordings, use **`VOICE_COMMUNICATION`** — it activates hardware echo cancellation and automatic gain control.

---

## File Format Reference

| Property           | Value                                        |
| ------------------ | -------------------------------------------- |
| File extension     | `.m4a`                                       |
| MIME type          | `audio/m4a`                                  |
| Container          | MPEG-4 Audio                                 |
| Backend MIME check | Must be `audio/*` — `audio/mpeg` → 422 error |
| Max file size      | ~100 MB default                              |
| Max duration       | No hard limit                                |

> Files stored in Expo's temp cache. Always clean up with `FileSystem.deleteAsync(uri, { idempotent: true })` after upload.

---

## Permissions

```typescript
import { Audio } from "expo-av";
import { Alert, Linking } from "react-native";

const { status, canAskAgain } = await Audio.requestPermissionsAsync();

if (status !== "granted") {
  if (!canAskAgain) {
    // Permanently denied — send to Settings
    Alert.alert("Microphone Blocked", "Enable access in Settings.", [
      { text: "Open Settings", onPress: () => Linking.openSettings() },
    ]);
  } else {
    Alert.alert(
      "Permission Required",
      "Microphone access is needed to record calls.",
    );
  }
}
```

Check permission before **every** recording session. If `status !== 'granted'` → disable the record button.

---

## Timer Pattern (elapsed display)

```typescript
const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
const [elapsed, setElapsed] = useState(0);

// On start:
timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);

// On stop:
if (timerRef.current) {
  clearInterval(timerRef.current);
  timerRef.current = null;
}
setElapsed(0);

// Display → "03:47"
const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
const ss = String(elapsed % 60).padStart(2, "0");
```

---

## Common Errors

| Error                             | Cause                               | Fix                                                |
| --------------------------------- | ----------------------------------- | -------------------------------------------------- |
| `RECORDING_NOT_STARTED`           | Called stop before start            | Check `isRecording` before stopping                |
| `COULDNT_START_RECORDING`         | Permission not granted              | Call `requestPermissionsAsync()` first             |
| `Audio mode must be set`          | Skipped `setAudioModeAsync`         | Set audio mode before `createAsync`                |
| `Recording session was abandoned` | App went to background without flag | Set `staysActiveInBackground: true`                |
| Upload 422 error                  | Wrong MIME type in FormData         | Use `audio/m4a` not `audio/mpeg`                   |
| Noisy / echo on Android           | Using default MIC source            | Use `VOICE_COMMUNICATION` audio source             |
| Metering always undefined         | `isMeteringEnabled` not set         | Pass custom options with `isMeteringEnabled: true` |

---

## expo-audio New API (SDK 54+ Migration Reference)

```typescript
import {
  useAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from "expo-audio";

// Permissions
const { granted } = await AudioModule.requestRecordingPermissionsAsync();

// Audio mode (cross-platform option names — no iOS/Android suffix)
await setAudioModeAsync({
  playsInSilentMode: true,
  allowsRecording: true,
  allowsBackgroundRecording: true,
  interruptionMode: "doNotMix", // "doNotMix" | "duckOthers" | "mixWithOthers"
});

// Hooks-based recorder — lifecycle-safe, auto-disposes on unmount
const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
const state = useAudioRecorderState(recorder); // { isRecording, durationMillis, metering, canRecord }

await recorder.prepareToRecordAsync();
recorder.record(); // sync
await recorder.stop(); // async — flushes file
const uri = recorder.uri; // string | null
```

Key differences from `expo-av`:

- No `createAsync` — use `prepareToRecordAsync()` + `record()` split
- `recorder.uri` property (not `getURI()` method)
- `RecordingPresets` (not `RecordingOptionsPresets`)
- `AudioModule.requestRecordingPermissionsAsync()` (not `Audio.requestPermissionsAsync()`)
- `setAudioModeAsync` option keys are cross-platform (no `iOS`/`Android` suffixes)

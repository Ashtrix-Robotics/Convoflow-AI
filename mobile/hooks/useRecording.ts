/**
 * useRecording — central hook for all recording operations.
 *
 * Wires together:
 *  - expo-audio (MicRecordingStrategy)
 *  - Call phone state detection (react-native-call-detection)
 *  - Upload logic
 *  - Timer
 *
 * Future-proof: swap `activeStrategy` to "voip_twilio" when VOIP is ready.
 * The rest of the codebase (record.tsx, etc.) stays unchanged.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioRecorder, RecordingPresets } from "expo-audio";
import { MicRecordingStrategy } from "../services/recording/MicRecordingStrategy";
import SafeCallDetector from "../services/recording/SafeCallDetector";
import { uploadCall } from "../services/api";
import { deleteLocalRecording } from "../services/audio";

// ─── Types ───────────────────────────────────────────────────────────────────

export type RecordPhase =
  | "idle" // nothing happening
  | "listening" // waiting for phone call to start (auto mode)
  | "recording" // actively recording
  | "uploading" // upload in progress
  | "done" // upload succeeded, showing result
  | "error"; // unrecoverable error

export type RecordingMode = "manual" | "auto";

export interface CallResult {
  id: string;
  summary: string;
  intent_category?: string;
}

export interface UseRecordingOptions {
  leadId?: string;
  mode?: RecordingMode;
  onCallEnd?: (result: CallResult) => void;
  onError?: (msg: string) => void;
}

export interface UseRecordingReturn {
  phase: RecordPhase;
  mode: RecordingMode;
  duration: number;
  result: CallResult | null;
  errorMessage: string | null;
  isAutoMode: boolean;

  /** Start a manual recording session */
  startManual: () => Promise<void>;
  /** Stop a manual recording and upload */
  stopManual: () => Promise<void>;
  /** Enable auto-detection mode (starts listening for phone call state) */
  enableAutoMode: () => void;
  /** Disable auto-detection mode */
  disableAutoMode: () => void;
  /** Reset to idle after done/error */
  reset: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRecording(
  options: UseRecordingOptions = {},
): UseRecordingReturn {
  const { leadId, mode: initialMode = "manual", onCallEnd, onError } = options;

  const [phase, setPhase] = useState<RecordPhase>("idle");
  const [mode, setMode] = useState<RecordingMode>(initialMode);
  const [duration, setDuration] = useState(0);
  const [result, setResult] = useState<CallResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0); // kept in sync with `duration` for async closures
  const uriRef = useRef<string | null>(null);

  // Inject the expo-audio recorder + statusListener into the strategy
  const audioRecorder = useAudioRecorder(
    RecordingPresets.HIGH_QUALITY,
    (status) => {
      if (status.isFinished && status.url) {
        uriRef.current = status.url;
      }
    },
  );

  const strategyRef = useRef<MicRecordingStrategy>(
    MicRecordingStrategy.createWithRecorder(audioRecorder, uriRef),
  );

  // Keep strategy in sync if audioRecorder instance changes
  useEffect(() => {
    strategyRef.current = MicRecordingStrategy.createWithRecorder(
      audioRecorder,
      uriRef,
    );
  }, [audioRecorder]);

  // Call detection — only loaded when in auto mode
  const callDetectorRef = useRef<any>(null);

  // ─── Timer helpers ─────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    durationRef.current = 0;
    setDuration(0);
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ─── Upload ────────────────────────────────────────────────────────────────

  const handleUpload = useCallback(
    async (uri: string, durationSecs: number) => {
      setPhase("uploading");
      try {
        const data = await uploadCall(
          uri,
          undefined,
          durationSecs,
          leadId,
          "connected",
        );
        try {
          await deleteLocalRecording(uri);
        } catch {
          // Cleanup is best-effort. A successful upload should still complete.
        }
        const callResult: CallResult = {
          id: data.id,
          summary: data.summary || "Transcribing… AI is analyzing the call.",
          intent_category: data.intent_category,
        };
        setResult(callResult);
        setPhase("done");
        onCallEnd?.(callResult);
      } catch (err: any) {
        // Build a clear, specific error message for the user
        const serverDetail = err?.response?.data?.detail;
        const httpStatus = err?.response?.status;
        const msg = serverDetail
          ? `Server error ${httpStatus}: ${serverDetail}`
          : err?.message && err.message !== "Network Error"
            ? err.message
            : `Upload failed (${httpStatus ?? "no response"}). Check your internet connection and try again.`;
        setErrorMessage(msg);
        setPhase("error");
        onError?.(msg);
      }
    },
    [leadId, onCallEnd, onError],
  );

  // ─── Core record/stop ──────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      await strategyRef.current.initialize();
      await strategyRef.current.startRecording({
        onRecordingStarted: () => {
          setPhase("recording");
          startTimer();
        },
        onError: (err) => {
          setErrorMessage(err.message);
          setPhase("error");
        },
      });
    } catch (err: any) {
      const msg = err?.message || "Could not start recording.";
      setErrorMessage(msg);
      setPhase("error");
      onError?.(msg);
    }
  }, [startTimer, onError]);

  const stopRecording = useCallback(async () => {
    stopTimer();
    try {
      const { uri, durationSeconds } =
        await strategyRef.current.stopRecording();
      await handleUpload(uri, durationSeconds);
    } catch (err: any) {
      const msg = err?.message || "Could not stop the recording.";
      setErrorMessage(msg);
      setPhase("error");
      onError?.(msg);
    }
  }, [stopTimer, handleUpload, onError]);

  // ─── Manual mode API ──────────────────────────────────────────────────────

  const startManual = useCallback(async () => {
    if (phase !== "idle" && phase !== "error") return;
    setErrorMessage(null);
    await startRecording();
  }, [phase, startRecording]);

  const stopManual = useCallback(async () => {
    if (phase !== "recording") return;
    await stopRecording();
  }, [phase, stopRecording]);

  // ─── Auto mode (call detection) ───────────────────────────────────────────

  const enableAutoMode = useCallback(() => {
    setMode("auto");
    setPhase("listening");

    callDetectorRef.current = new SafeCallDetector(
      async (event: string) => {
        // Android: Offhook = call active, Disconnected = call ended
        // iOS:     Connected = call active, Disconnected = call ended
        if (event === "Offhook" || event === "Connected") {
          if (phase !== "recording") {
            await startRecording();
          }
        } else if (event === "Disconnected") {
          if (phase === "recording") {
            await stopRecording();
          }
        }
        // "Incoming" / "Missed" — no action needed
      },
      false, // don't read incoming phone number
      () => {
        setErrorMessage(
          "Auto-detection is not available in Expo Go. Use Manual mode to record, or build a native APK with: npx expo run:android",
        );
        setPhase("error");
      },
      {
        title: "Phone State Permission",
        message:
          "Convoflow AI needs access to your phone state to automatically start recording when a sales call begins.",
      },
    );
  }, [phase, startRecording, stopRecording]);

  const disableAutoMode = useCallback(() => {
    callDetectorRef.current?.dispose();
    callDetectorRef.current = null;
    setMode("manual");
    if (phase === "listening") setPhase("idle");
  }, [phase]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopTimer();
      callDetectorRef.current?.dispose();
      strategyRef.current.dispose();
    };
  }, [stopTimer]);

  // ─── Reset ────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setPhase(mode === "auto" ? "listening" : "idle");
    setResult(null);
    setErrorMessage(null);
    setDuration(0);
    durationRef.current = 0;
  }, [mode]);

  return {
    phase,
    mode,
    duration,
    result,
    errorMessage,
    isAutoMode: mode === "auto",
    startManual,
    stopManual,
    enableAutoMode,
    disableAutoMode,
    reset,
  };
}

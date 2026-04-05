/**
 * MicRecordingStrategy — captures audio via the device microphone.
 *
 * How it works with phone calls:
 *   - Agent puts the call on SPEAKERPHONE
 *   - The phone's speaker projects the other party's voice into the room
 *   - The microphone picks up both voices as ambient audio
 *   - Quality is sufficient for Whisper transcription
 *
 * Future: Replace or extend with VoipRecordingStrategy for
 * direct call-stream access via Twilio/Agora/SIP.
 */

import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from "expo-audio";
import type { RecordingStrategy, RecordingStrategyEvents } from "./types";

export class MicRecordingStrategy implements RecordingStrategy {
  readonly id = "mic" as const;
  readonly label = "Microphone (Speakerphone)";
  readonly requiresDevBuild = false;

  private startedAt: number | null = null;
  private recorder: ReturnType<typeof useAudioRecorder> | null = null;
  private events: RecordingStrategyEvents = {};
  private uriRef: { current: string | null } = { current: null };
  private pendingResolve:
    | ((result: { uri: string; durationSeconds: number }) => void)
    | null = null;
  private pendingReject: ((err: Error) => void) | null = null;

  /**
   * Factory method — must be called inside a React component via the hook wrapper.
   * The recorder instance (from useAudioRecorder) is injected so React hooks rules are respected.
   */
  static createWithRecorder(
    recorder: ReturnType<typeof useAudioRecorder>,
    uriRef: { current: string | null },
  ): MicRecordingStrategy {
    const instance = new MicRecordingStrategy();
    instance.recorder = recorder;
    instance.uriRef = uriRef;
    return instance;
  }

  async initialize(): Promise<void> {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) {
      throw new Error(
        "Microphone permission is required to record calls. Please grant access in Settings.",
      );
    }
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
  }

  async startRecording(events: RecordingStrategyEvents): Promise<void> {
    if (!this.recorder) throw new Error("Recorder not initialized.");
    this.events = events;
    this.uriRef.current = null;
    this.startedAt = Date.now();
    await this.recorder.prepareToRecordAsync();
    this.recorder.record();
    events.onRecordingStarted?.();
  }

  async stopRecording(): Promise<{ uri: string; durationSeconds: number }> {
    if (!this.recorder) throw new Error("Recorder not initialized.");

    const durationSeconds = this.startedAt
      ? Math.round((Date.now() - this.startedAt) / 1000)
      : 0;

    await this.recorder.stop();

    // URI is populated either synchronously or via statusListener
    const uri = this.uriRef.current ?? this.recorder.uri;

    if (!uri) {
      // Wait briefly for statusListener to fire (race condition safety net)
      const finalUri = await this._waitForUri(2000);
      if (!finalUri) {
        throw new Error("Recording URI not available after stopping.");
      }
      this.uriRef.current = null;
      return { uri: finalUri, durationSeconds };
    }

    this.uriRef.current = null;
    return { uri, durationSeconds };
  }

  private _waitForUri(timeoutMs: number): Promise<string | null> {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const poll = setInterval(() => {
        const uri = this.uriRef.current ?? this.recorder?.uri ?? null;
        if (uri || Date.now() >= deadline) {
          clearInterval(poll);
          resolve(uri);
        }
      }, 100);
    });
  }

  dispose(): void {
    this.recorder = null;
    this.events = {};
    this.startedAt = null;
  }
}

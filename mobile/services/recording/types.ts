/**
 * Recording strategy abstraction layer.
 *
 * This interface allows the recording backend to be swapped without touching UI code.
 * Current implementation: MicRecordingStrategy (speakerphone + mic).
 * Future: VoipRecordingStrategy (Twilio, Agora, SIP, etc.) — just implement this interface.
 */

export type CallPhoneState =
  | "idle" // No call in progress
  | "dialing" // Outgoing call initiated
  | "offhook" // Call is active (Android)
  | "connected" // Call connected (iOS)
  | "disconnected" // Call ended
  | "incoming" // Incoming call ringing
  | "missed"; // Missed call

export interface RecordingStrategyEvents {
  onRecordingStarted?: () => void;
  onRecordingStopped?: (uri: string, durationSeconds: number) => void;
  onError?: (error: Error) => void;
}

/**
 * A recording strategy encapsulates HOW audio is captured.
 * Swap this to change from mic-based to VOIP-based recording.
 */
export interface RecordingStrategy {
  /** Unique identifier for this strategy */
  readonly id: "mic" | "voip_twilio" | "voip_agora" | "voip_sip";
  /** Human-readable label shown in settings */
  readonly label: string;
  /** Whether this strategy requires a dev build (not Expo Go) */
  readonly requiresDevBuild: boolean;

  /** Prepare audio session. Call once at app startup or when switching strategies. */
  initialize(): Promise<void>;

  /** Start capturing audio. */
  startRecording(events: RecordingStrategyEvents): Promise<void>;

  /** Stop capturing and return the recorded file URI. */
  stopRecording(): Promise<{ uri: string; durationSeconds: number }>;

  /** Clean up resources. */
  dispose(): void;
}

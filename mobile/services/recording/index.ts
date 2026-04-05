/**
 * Barrel export for recording strategy modules.
 */
export type {
  RecordingStrategy,
  RecordingStrategyEvents,
  CallPhoneState,
} from "./types";
export { MicRecordingStrategy } from "./MicRecordingStrategy";
export { VoipRecordingStrategy } from "./VoipRecordingStrategy";

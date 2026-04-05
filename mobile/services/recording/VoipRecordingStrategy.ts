/**
 * VOIP Recording Strategy — Placeholder for future Twilio / Agora / SIP integration.
 *
 * To implement:
 *  1. Install the relevant SDK: `npm install @twilio/voice-react-native-sdk` or `react-native-agora`
 *  2. Replace the TODOs below with real SDK calls
 *  3. In useRecording.ts, set activeStrategy to 'voip_twilio'
 *
 * Advantages over mic strategy:
 *  - Direct access to both audio streams (no need for speakerphone)
 *  - No ambient noise capture
 *  - Can record even with earpiece (no speaker required)
 *  - Higher transcription accuracy
 */

import type { RecordingStrategy, RecordingStrategyEvents } from "./types";

export class VoipRecordingStrategy implements RecordingStrategy {
  readonly id = "voip_twilio" as const;
  readonly label = "VOIP (Twilio Voice)";
  readonly requiresDevBuild = true;

  async initialize(): Promise<void> {
    // TODO: Initialize Twilio Voice SDK
    // import Voice from '@twilio/voice-react-native-sdk';
    // await Voice.connect(token, params);
    throw new Error(
      "VoipRecordingStrategy is not yet implemented. " +
        "Install @twilio/voice-react-native-sdk and implement this class.",
    );
  }

  async startRecording(_events: RecordingStrategyEvents): Promise<void> {
    // TODO: Start VOIP call and begin recording both audio streams
    throw new Error("Not implemented");
  }

  async stopRecording(): Promise<{ uri: string; durationSeconds: number }> {
    // TODO: Stop recording, merge audio streams, return URI
    throw new Error("Not implemented");
  }

  dispose(): void {
    // TODO: Disconnect VOIP session
  }
}

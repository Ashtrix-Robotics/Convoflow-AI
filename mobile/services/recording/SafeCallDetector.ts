/**
 * SafeCallDetector — safe drop-in replacement for react-native-call-detection.
 *
 * The original library uses the deprecated BatchedBridge API which was removed
 * in the new React Native architecture (Expo SDK 53+).  This stub has the same
 * public interface so the rest of the codebase is unchanged, but instead of
 * crashing it surfaces a graceful "not available" error via the permission-
 * denied callback so the user gets a clear message in the UI.
 *
 * If you need real call-state detection in a production native build, replace
 * this file with a bridge to @voximplant/react-native-foreground-service or a
 * custom Kotlin BroadcastReceiver, keeping the same interface.
 */

type CallEventCallback = (event: string) => void;
type PermissionDeniedCallback = () => void;
type Rationale = { title: string; message: string };

export default class SafeCallDetector {
  private _disposed = false;

  constructor(
    _callback: CallEventCallback,
    _readPhoneNumber: boolean,
    permissionDeniedCallback: PermissionDeniedCallback,
    _rationale: Rationale,
  ) {
    // react-native-call-detection (v1.9) uses BatchedBridge which no longer
    // exists in the new RN architecture bundled with Expo SDK 53+.
    // Notify the caller immediately so the UI can show an appropriate message.
    if (!this._disposed) {
      Promise.resolve().then(permissionDeniedCallback);
    }
  }

  dispose() {
    this._disposed = true;
  }
}

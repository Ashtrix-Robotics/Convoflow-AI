import * as FileSystem from "expo-file-system";

/**
 * Delete a local recording file after successful upload.
 */
export const deleteLocalRecording = async (uri: string): Promise<void> => {
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
};

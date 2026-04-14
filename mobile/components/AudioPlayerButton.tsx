/**
 * AudioPlayerButton
 *
 * A compact play/pause control for a remote or local audio URL.
 * Uses expo-audio's useAudioPlayer + useAudioPlayerStatus hooks.
 */
import React from "react";
import { TouchableOpacity, Text, View, StyleSheet, ActivityIndicator } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

interface Props {
  audioUrl: string;
}

export function AudioPlayerButton({ audioUrl }: Props) {
  const player = useAudioPlayer({ uri: audioUrl });
  const status = useAudioPlayerStatus(player);

  const isPlaying = status.playing;
  const isLoading = !status.isLoaded && !status.error;

  const handlePress = () => {
    if (isPlaying) {
      player.pause();
    } else {
      // Seek to start if finished playing
      if (status.currentTime >= (status.duration ?? 0) && (status.duration ?? 0) > 0) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={handlePress}
        disabled={isLoading}
        activeOpacity={0.75}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FF6600" />
        ) : (
          <Text style={styles.icon}>{isPlaying ? "⏸" : "▶"}</Text>
        )}
      </TouchableOpacity>
      {status.isLoaded ? (
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width:
                  status.duration && status.duration > 0
                    ? `${(status.currentTime / status.duration) * 100}%`
                    : "0%",
              },
            ]}
          />
        </View>
      ) : null}
      {status.duration && status.duration > 0 ? (
        <Text style={styles.time}>
          {formatTime(status.currentTime)} / {formatTime(status.duration)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF7ED",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FF6600",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 14, color: "#fff" },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: "#FED7AA",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FF6600",
    borderRadius: 2,
  },
  time: { fontSize: 11, color: "#9CA3AF", minWidth: 70, textAlign: "right" },
});

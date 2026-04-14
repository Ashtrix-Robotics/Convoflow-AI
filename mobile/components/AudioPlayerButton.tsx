import React, { useEffect, useState } from "react";
import { TouchableOpacity, Text, View, StyleSheet, ActivityIndicator } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL, TOKEN_KEY } from "../constants";

interface Props {
  /** The call record ID — used to build the backend audio proxy URL */
  callId: string;
  /** Whether the call has an audio_url (skip rendering if false) */
  hasAudio?: boolean;
}

export function AudioPlayerButton({ callId, hasAudio = true }: Props) {
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);

  // Build authenticated proxy URL on mount
  useEffect(() => {
    let cancelled = false;
    SecureStore.getItemAsync(TOKEN_KEY).then((token) => {
      if (!cancelled && token) {
        setProxyUrl(`${API_BASE_URL}/calls/${callId}/audio?token=${encodeURIComponent(token)}`);
      }
    });
    return () => { cancelled = true; };
  }, [callId]);

  if (!hasAudio || !proxyUrl) {
    return null;
  }

  return <AudioPlayerInner uri={proxyUrl} />;
}

/** Inner component that actually manages the audio player (only mounts once URI is ready) */
function AudioPlayerInner({ uri }: { uri: string }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const [timedOut, setTimedOut] = useState(false);

  const isPlaying = status.playing;
  const isLoading = !status.isLoaded && !timedOut;

  // If audio hasn't loaded after 12s, show error state
  useEffect(() => {
    if (status.isLoaded) return;
    const t = setTimeout(() => setTimedOut(true), 12000);
    return () => clearTimeout(t);
  }, [status.isLoaded]);

  const handlePress = () => {
    if (isPlaying) {
      player.pause();
    } else {
      if (status.currentTime >= status.duration && status.duration > 0) {
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

  if (timedOut && !status.isLoaded) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>⚠️ Audio unavailable</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={handlePress}
        disabled={isLoading}
        activeOpacity={0.75}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.icon}>{isPlaying ? "⏸" : "▶"}</Text>
        )}
      </TouchableOpacity>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            {
              width:
                status.duration > 0
                  ? `${(status.currentTime / status.duration) * 100}%`
                  : "0%",
            },
          ]}
        />
      </View>
      <Text style={styles.time}>
        {status.duration > 0
          ? `${formatTime(status.currentTime)} / ${formatTime(status.duration)}`
          : isLoading
            ? "Loading…"
            : "0:00"}
      </Text>
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
  errorText: { fontSize: 12, color: "#EF4444" },
});

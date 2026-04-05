import React from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getCalls } from "../../services/api";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  completed: { bg: "#D1FAE5", text: "#065F46" },
  transcribing: { bg: "#FEF3C7", text: "#92400E" },
  pending: { bg: "#F3F4F6", text: "#6B7280" },
  failed: { bg: "#FEE2E2", text: "#991B1B" },
};

export default function HistoryScreen() {
  const {
    data: calls = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["calls"],
    queryFn: () => getCalls(),
    refetchInterval: 15000,
  });

  const renderCall = ({ item }: { item: any }) => {
    const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.pending;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.time}>
            {formatDistanceToNow(new Date(item.recorded_at), {
              addSuffix: true,
            })}
          </Text>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.badgeText, { color: statusStyle.text }]}>
              {item.status}
            </Text>
          </View>
        </View>
        {item.call_tag && (
          <Text style={styles.tag}>
            {item.call_tag === "no_answer"
              ? "📵 No Answer"
              : item.call_tag === "wrong_number"
                ? "❌ Wrong Number"
                : "✅ Connected"}
          </Text>
        )}
        {item.summary && (
          <Text style={styles.summary} numberOfLines={2}>
            {item.summary}
          </Text>
        )}
        {item.intent_category && item.intent_category !== "new" && (
          <Text style={styles.intent}>
            Intent: {item.intent_category.replace(/_/g, " ")}
          </Text>
        )}
        {item.duration_seconds != null && (
          <Text style={styles.duration}>
            Duration: {Math.floor(item.duration_seconds / 60)}m{" "}
            {item.duration_seconds % 60}s
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={calls}
        renderItem={renderCall}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No call history yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  time: { fontSize: 14, fontWeight: "600", color: "#002147" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  tag: { fontSize: 13, color: "#6B7280", marginTop: 6 },
  summary: { fontSize: 13, color: "#666", marginTop: 6, lineHeight: 18 },
  intent: {
    fontSize: 12,
    color: "#4338CA",
    fontWeight: "600",
    marginTop: 6,
    textTransform: "capitalize",
  },
  duration: { fontSize: 11, color: "#9CA3AF", marginTop: 4 },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyText: { fontSize: 16, color: "#6B7280" },
});

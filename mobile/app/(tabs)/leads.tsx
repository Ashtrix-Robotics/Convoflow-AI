import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { getMyLeads } from "../../services/api";

const INTENT_COLORS: Record<string, { bg: string; text: string }> = {
  new: { bg: "#E0E7FF", text: "#3730A3" },
  interested: { bg: "#D1FAE5", text: "#065F46" },
  callback_requested: { bg: "#FEF3C7", text: "#92400E" },
  no_answer: { bg: "#FEE2E2", text: "#991B1B" },
  not_interested: { bg: "#F3F4F6", text: "#6B7280" },
  future_planning: { bg: "#E0E7FF", text: "#4338CA" },
  payment_pending: { bg: "#FDE68A", text: "#78350F" },
  converted: { bg: "#A7F3D0", text: "#047857" },
  wrong_number: { bg: "#F3F4F6", text: "#9CA3AF" },
  undecided: { bg: "#FEF3C7", text: "#B45309" },
};

const STATUS_COLORS: Record<string, string> = {
  new: "#6366F1",
  contacted: "#F59E0B",
  in_progress: "#3B82F6",
  qualified: "#10B981",
  payment_sent: "#8B5CF6",
  converted: "#059669",
  lost: "#EF4444",
  deferred: "#6B7280",
};

export default function LeadsScreen() {
  const router = useRouter();
  const {
    data: leads = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["my-leads"],
    queryFn: () => getMyLeads(),
    refetchInterval: 10000,
  });

  const renderLead = ({ item }: { item: any }) => {
    const intent = INTENT_COLORS[item.intent_category] || INTENT_COLORS.new;
    const statusColor = STATUS_COLORS[item.status] || "#6B7280";

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/leads/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        </View>

        <Text style={styles.phone}>{item.phone}</Text>

        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: intent.bg }]}>
            <Text style={[styles.badgeText, { color: intent.text }]}>
              {item.intent_category.replace(/_/g, " ")}
            </Text>
          </View>
          {item.source_campaign && (
            <View style={[styles.badge, { backgroundColor: "#F3F4F6" }]}>
              <Text style={[styles.badgeText, { color: "#374151" }]}>
                {item.source_campaign}
              </Text>
            </View>
          )}
        </View>

        {item.callback_scheduled_at && (
          <Text style={styles.callback}>
            📞 Callback: {new Date(item.callback_scheduled_at).toLocaleString()}
          </Text>
        )}

        {item.last_contacted_at && (
          <Text style={styles.meta}>
            Last contacted:{" "}
            {new Date(item.last_contacted_at).toLocaleDateString()}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={leads}
        renderItem={renderLead}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No leads assigned yet.</Text>
            <Text style={styles.emptySubtext}>
              Leads from Meta ads will appear here automatically.
            </Text>
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
  name: { fontSize: 17, fontWeight: "700", color: "#002147", flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
  phone: { fontSize: 14, color: "#666", marginTop: 4 },
  badges: { flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  callback: {
    fontSize: 12,
    color: "#B45309",
    marginTop: 8,
    fontWeight: "600",
  },
  meta: { fontSize: 11, color: "#9CA3AF", marginTop: 4 },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyText: { fontSize: 16, color: "#6B7280", fontWeight: "600" },
  emptySubtext: { fontSize: 13, color: "#9CA3AF", marginTop: 4 },
});

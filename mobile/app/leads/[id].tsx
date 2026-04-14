import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Contacts from "expo-contacts";
import { getLead, getCalls, markNoAnswer } from "../../services/api";
import { AudioPlayerButton } from "../../components/AudioPlayerButton";

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: () => getLead(id!),
    enabled: !!id,
  });

  const { data: calls = [] } = useQuery({
    queryKey: ["lead-calls", id],
    queryFn: () => getCalls(0, 50, id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6600" />
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Lead not found</Text>
      </View>
    );
  }

  const handleCall = () => {
    Linking.openURL(`tel:${lead.phone}`);
  };

  const handleWhatsApp = () => {
    // Strip all non-digit chars, ensure it starts with country code
    const digits = lead.phone.replace(/\D/g, "");
    Linking.openURL(`https://wa.me/${digits}`);
  };

  const handleSaveContact = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Convoflow AI needs access to your contacts to save this lead.",
      );
      return;
    }
    try {
      const nameParts = lead.name.trim().split(" ");
      const contact: Contacts.Contact = {
        contactType: Contacts.ContactTypes.Person,
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(" ") || undefined,
        phoneNumbers: [{ label: "mobile", number: lead.phone }],
        emails: lead.email
          ? [{ label: "work", email: lead.email }]
          : undefined,
        note: lead.course_interested_in
          ? `Course: ${lead.course_interested_in}`
          : undefined,
      };
      await Contacts.addContactAsync(contact);
      Alert.alert("Saved!", `${lead.name} has been saved to your contacts.`);
    } catch {
      Alert.alert("Error", "Could not save contact. Please try again.");
    }
  };

  const handleRecord = () => {
    router.push({ pathname: "/(tabs)/record", params: { leadId: lead.id } });
  };

  const handleNoAnswer = async () => {
    Alert.alert(
      "No Answer",
      `Mark ${lead.name} as no answer? This will send an automated WhatsApp follow-up.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "destructive",
          onPress: async () => {
            try {
              await markNoAnswer(lead.id);
              queryClient.invalidateQueries({ queryKey: ["lead", id] });
              queryClient.invalidateQueries({ queryKey: ["my-leads"] });
              Alert.alert("Done", "No-answer follow-up triggered.");
            } catch {
              Alert.alert("Error", "Failed to mark as no answer.");
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.name}>{lead.name}</Text>
        <Text style={styles.phone}>{lead.phone}</Text>
        {lead.email && <Text style={styles.email}>{lead.email}</Text>}
      </View>

      {/* Badges */}
      <View style={styles.badges}>
        <View style={[styles.badge, styles.statusBadge]}>
          <Text style={styles.statusText}>{lead.status}</Text>
        </View>
        <View style={[styles.badge, styles.intentBadge]}>
          <Text style={styles.intentText}>
            {lead.intent_category.replace(/_/g, " ")}
          </Text>
        </View>
        {lead.source_campaign && (
          <View style={[styles.badge, { backgroundColor: "#F3F4F6" }]}>
            <Text style={{ fontSize: 11, color: "#374151" }}>
              📣 {lead.source_campaign}
            </Text>
          </View>
        )}
      </View>

      {/* Quick Actions Row 1 */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
          <Text style={styles.actionText}>📞 Call Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.recordBtn} onPress={handleRecord}>
          <Text style={styles.actionText}>🎙️ Record Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.noAnswerBtn} onPress={handleNoAnswer}>
          <Text style={styles.actionText}>📵 No Answer</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions Row 2 */}
      <View style={styles.actionsRow2}>
        <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp}>
          <Text style={styles.actionText}>💬 WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveContactBtn} onPress={handleSaveContact}>
          <Text style={styles.actionText}>💾 Save Contact</Text>
        </TouchableOpacity>
      </View>

      {/* Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        {lead.course_interested_in && (
          <Text style={styles.detail}>Course: {lead.course_interested_in}</Text>
        )}
        {lead.callback_scheduled_at && (
          <Text style={styles.detail}>
            Callback: {new Date(lead.callback_scheduled_at).toLocaleString()}
          </Text>
        )}
        <Text style={styles.detail}>Follow-ups: {lead.followup_count}</Text>
        {lead.notes ? <Text style={styles.detail}>Notes: {lead.notes}</Text> : null}
      </View>

      {lead.extra_data && Object.keys(lead.extra_data).length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Campaign Context</Text>
          {Object.entries(lead.extra_data).map(([key, val]) => (
            <Text key={key} style={styles.detail}>
              <Text style={{ fontWeight: "600" }}>{key}:</Text>{" "}
              {typeof val === "object" ? JSON.stringify(val) : String(val)}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Call History</Text>
        {calls.length === 0 ? (
          <Text style={styles.detail}>No calls recorded yet.</Text>
        ) : null}
        {calls.map((call: any) => (
          <View key={call.id} style={styles.callCard}>
            <View style={styles.callHeader}>
              <Text style={styles.callDate}>
                {new Date(call.created_at).toLocaleDateString()}
              </Text>
              <Text style={styles.callTag}>
                {call.call_tag === "no_answer"
                  ? "📵 No Answer"
                  : call.call_tag === "wrong_number"
                    ? "❌ Wrong Number"
                    : "✅ Connected"}
              </Text>
            </View>
            {call.audio_url ? (
              <View style={styles.audioRow}>
                <AudioPlayerButton audioUrl={call.audio_url} />
              </View>
            ) : null}
            {call.summary ? (
              <Text style={styles.callSummary} numberOfLines={3}>
                {call.summary}
              </Text>
            ) : null}
            {call.intent_category ? (
              <Text style={styles.callIntent}>
                Intent: {call.intent_category.replace(/_/g, " ")}
                {call.intent_confidence
                  ? ` (${Math.round(call.intent_confidence * 100)}%)`
                  : ""}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { color: "#EF4444", fontSize: 16 },
  header: {
    backgroundColor: "#002147",
    padding: 24,
    paddingTop: 56,
  },
  name: { fontSize: 24, fontWeight: "bold", color: "#fff" },
  phone: { fontSize: 16, color: "#CBD5E1", marginTop: 4 },
  email: { fontSize: 14, color: "#94A3B8", marginTop: 2 },
  badges: {
    flexDirection: "row",
    gap: 8,
    padding: 16,
    flexWrap: "wrap",
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadge: { backgroundColor: "#E0E7FF" },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3730A3",
    textTransform: "capitalize",
  },
  intentBadge: { backgroundColor: "#D1FAE5" },
  intentText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#065F46",
    textTransform: "capitalize",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  actionsRow2: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  callBtn: {
    flex: 1,
    backgroundColor: "#10B981",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  recordBtn: {
    flex: 1,
    backgroundColor: "#FF6600",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  noAnswerBtn: {
    flex: 1,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  whatsappBtn: {
    flex: 1,
    backgroundColor: "#25D366",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  saveContactBtn: {
    flex: 1,
    backgroundColor: "#6366F1",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  audioRow: {
    marginTop: 8,
  },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#002147",
    marginBottom: 10,
  },
  detail: { fontSize: 14, color: "#4B5563", marginBottom: 6 },
  callCard: {
    borderLeftWidth: 3,
    borderLeftColor: "#E5E7EB",
    paddingLeft: 12,
    marginBottom: 14,
  },
  callHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  callDate: { fontSize: 12, color: "#9CA3AF", fontWeight: "600" },
  callTag: { fontSize: 12, color: "#6B7280" },
  callSummary: { fontSize: 13, color: "#4B5563", marginTop: 4, lineHeight: 18 },
  callIntent: {
    fontSize: 12,
    color: "#4338CA",
    fontWeight: "600",
    marginTop: 4,
    textTransform: "capitalize",
  },
});

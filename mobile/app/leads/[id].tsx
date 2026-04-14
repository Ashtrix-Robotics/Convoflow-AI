import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Contacts from "expo-contacts";
import * as SecureStore from "expo-secure-store";
import { getLead, getCalls, markNoAnswer } from "../../services/api";
import { AudioPlayerButton } from "../../components/AudioPlayerButton";

// ── Contact Name Templates ──────────────────────────────────────────────────
const TEMPLATE_STORAGE_KEY = "contact_name_template";
const DEFAULT_TEMPLATE = "{name}";

const PRESET_TEMPLATES = [
  { label: "Name only", value: "{name}" },
  { label: "Name - Center", value: "{name} - {center}" },
  { label: "Name_Center_Batch", value: "{name}_{center}_{batch}" },
  { label: "Name_Center_Course", value: "{name}_{center}_{course}" },
  { label: "Name_Campaign", value: "{name}_{campaign}" },
];

function applyTemplate(template: string, lead: any): string {
  return template
    .replace(/\{name\}/gi, lead.name || "")
    .replace(/\{center\}/gi, lead.class_center_name || "")
    .replace(/\{batch\}/gi, lead.class_batch_label || "")
    .replace(/\{course\}/gi, lead.course_interested_in || "")
    .replace(/\{campaign\}/gi, lead.source_campaign || "")
    .replace(/\{phone\}/gi, lead.phone || "")
    .trim();
}

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [customTemplate, setCustomTemplate] = useState("");
  const [savedTemplate, setSavedTemplate] = useState(DEFAULT_TEMPLATE);

  // Load saved template on mount
  useEffect(() => {
    SecureStore.getItemAsync(TEMPLATE_STORAGE_KEY).then((t) => {
      if (t) {
        setSavedTemplate(t);
        setCustomTemplate(t);
      }
    });
  }, []);

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

  const handleSaveContact = () => {
    setCustomTemplate(savedTemplate);
    setShowTemplatePicker(true);
  };

  const doSaveContact = async (template: string) => {
    setShowTemplatePicker(false);

    // Persist template choice for next time
    await SecureStore.setItemAsync(TEMPLATE_STORAGE_KEY, template);
    setSavedTemplate(template);

    const { status: permStatus } = await Contacts.requestPermissionsAsync();
    if (permStatus !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Convoflow AI needs access to your contacts to save this lead.",
      );
      return;
    }
    try {
      const displayName = applyTemplate(template, lead);
      const nameParts = displayName.trim().split(" ");
      const firstName = nameParts[0] || lead.name;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

      const contact: Record<string, any> = {
        contactType: Contacts.ContactTypes.Person,
        name: displayName,
        firstName,
        phoneNumbers: [{ label: "mobile", number: lead.phone, isPrimary: true }],
      };
      if (lastName) contact.lastName = lastName;
      if (lead.email) contact.emails = [{ label: "work", email: lead.email }];

      await Contacts.addContactAsync(contact as Contacts.Contact);
      Alert.alert("Saved!", `"${displayName}" has been saved to your contacts.`);
    } catch (err: any) {
      console.error("Save contact error:", err);
      Alert.alert(
        "Error",
        `Could not save contact: ${err?.message || "Unknown error"}. Please try again.`,
      );
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
                <AudioPlayerButton callId={call.id} />
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

      {/* Contact Name Template Picker */}
      <Modal
        visible={showTemplatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTemplatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Contact Name Format</Text>
            <Text style={styles.modalSubtitle}>
              Preview: <Text style={{ fontWeight: "700" }}>{applyTemplate(customTemplate || DEFAULT_TEMPLATE, lead)}</Text>
            </Text>
            <Text style={styles.modalHint}>
              Variables: {"{name}"} {"{center}"} {"{batch}"} {"{course}"} {"{campaign}"} {"{phone}"}
            </Text>

            {PRESET_TEMPLATES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[
                  styles.templateOption,
                  customTemplate === t.value && styles.templateOptionActive,
                ]}
                onPress={() => setCustomTemplate(t.value)}
              >
                <Text style={[
                  styles.templateLabel,
                  customTemplate === t.value && styles.templateLabelActive,
                ]}>
                  {t.label}
                </Text>
                <Text style={styles.templatePreview}>
                  {applyTemplate(t.value, lead)}
                </Text>
              </TouchableOpacity>
            ))}

            <TextInput
              style={styles.templateInput}
              value={customTemplate}
              onChangeText={setCustomTemplate}
              placeholder="Custom: e.g. {name}_{center}_{batch}_Ashtrix"
              placeholderTextColor="#9CA3AF"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowTemplatePicker(false)}
              >
                <Text style={{ color: "#6B7280", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSave}
                onPress={() => doSaveContact(customTemplate || DEFAULT_TEMPLATE)}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Save Contact</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  // ── Template Picker Modal ──────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#002147",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#4B5563",
    marginBottom: 4,
  },
  modalHint: {
    fontSize: 11,
    color: "#9CA3AF",
    marginBottom: 14,
  },
  templateOption: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
  },
  templateOptionActive: {
    borderColor: "#6366F1",
    backgroundColor: "#EEF2FF",
  },
  templateLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  templateLabelActive: {
    color: "#4338CA",
  },
  templatePreview: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  templateInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    marginTop: 8,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  modalSave: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#6366F1",
    alignItems: "center",
  },
});

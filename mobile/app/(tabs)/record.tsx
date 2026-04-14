/**
 * Record Screen
 *
 * Supports two recording modes:
 *  - Manual: agent taps Start/Stop manually
 *  - Auto:   app detects phone call state and records automatically
 *            (requires dev build — not Expo Go)
 *
 * The selected lead is applied to both modes. If no lead is selected, the
 * recording is stored as an unassigned call and can be linked afterward.
 */

import React, { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Switch,
} from "react-native";
import Constants from "expo-constants";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRecording } from "../../hooks/useRecording";
import { getMyLeads, linkCallToLead } from "../../services/api";

// Auto-detect requires a native build — not available in Expo Go
const IS_EXPO_GO = Constants.executionEnvironment === "storeClient";

export default function RecordScreen() {
  const { leadId } = useLocalSearchParams<{ leadId?: string }>();
  const queryClient = useQueryClient();
  const [selectedLeadId, setSelectedLeadId] = useState<string | undefined>(
    leadId,
  );
  const [showLeadPicker, setShowLeadPicker] = useState(!leadId);
  const [isLinkingLead, setIsLinkingLead] = useState(false);

  const { data: leads = [] } = useQuery({
    queryKey: ["my-leads"],
    queryFn: () => getMyLeads(),
    staleTime: 30000,
  });

  const selectedLead = useMemo(
    () => leads.find((item: any) => item.id === selectedLeadId),
    [leads, selectedLeadId],
  );

  const {
    phase,
    duration,
    result,
    errorMessage,
    isAutoMode,
    startManual,
    stopManual,
    enableAutoMode,
    disableAutoMode,
    reset,
  } = useRecording({ leadId: selectedLeadId });

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const canChangeLead =
    phase === "idle" || phase === "error" || phase === "done";

  const handleLinkUploadedCall = async (nextLeadId: string) => {
    if (!result?.id) return;
    setIsLinkingLead(true);
    try {
      await linkCallToLead(result.id, nextLeadId);
      setSelectedLeadId(nextLeadId);
      setShowLeadPicker(false);
      queryClient.invalidateQueries({ queryKey: ["my-leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead", nextLeadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-calls", nextLeadId] });
      queryClient.invalidateQueries({ queryKey: ["calls"] });
      Alert.alert(
        "Lead linked",
        "This call is now attached to the selected lead.",
      );
    } catch (error: any) {
      Alert.alert("Could not link lead", error?.message || "Please try again.");
    } finally {
      setIsLinkingLead(false);
    }
  };

  const handleSelectLead = (nextLeadId?: string) => {
    if (!canChangeLead) return;
    if (phase === "done" && result && !selectedLeadId && nextLeadId) {
      void handleLinkUploadedCall(nextLeadId);
      return;
    }
    setSelectedLeadId(nextLeadId);
    setShowLeadPicker(false);
  };

  const toggleAutoMode = (value: boolean) => {
    if (IS_EXPO_GO) return; // not available — switch is disabled
    if (value) {
      enableAutoMode();
    } else {
      disableAutoMode();
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Record Client Call</Text>

      <View style={styles.contextCard}>
        <View style={styles.contextHeader}>
          <View style={styles.contextTextWrap}>
            <Text style={styles.contextTitle}>Lead Context</Text>
            {selectedLead ? (
              <>
                <Text style={styles.contextName}>{selectedLead.name}</Text>
                <Text style={styles.contextMeta}>{selectedLead.phone}</Text>
              </>
            ) : (
              <>
                <Text style={styles.contextName}>No lead selected</Text>
                <Text style={styles.contextMeta}>
                  Start from the lead list or choose one here. If you skip this,
                  the call is saved as unassigned until you link it later.
                </Text>
              </>
            )}
          </View>

          {canChangeLead ? (
            <TouchableOpacity
              style={styles.contextButton}
              onPress={() => setShowLeadPicker((value) => !value)}
            >
              <Text style={styles.contextButtonText}>
                {showLeadPicker ? "Hide" : selectedLead ? "Change" : "Choose"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {selectedLead && canChangeLead ? (
          <View style={styles.contextActionRow}>
            <TouchableOpacity
              style={styles.dialLeadButton}
              onPress={() => Linking.openURL(`tel:${selectedLead.phone}`)}
            >
              <Text style={styles.dialLeadText}>Call selected lead</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.clearLeadButton}
              onPress={() => handleSelectLead(undefined)}
            >
              <Text style={styles.clearLeadText}>
                Save next call as unassigned
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {showLeadPicker && canChangeLead ? (
          <View style={styles.pickerList}>
            {leads.length === 0 ? (
              <Text style={styles.pickerEmptyText}>
                No assigned leads available.
              </Text>
            ) : (
              leads.map((lead: any) => (
                <TouchableOpacity
                  key={lead.id}
                  style={[
                    styles.pickerItem,
                    selectedLeadId === lead.id && styles.pickerItemActive,
                  ]}
                  onPress={() => handleSelectLead(lead.id)}
                >
                  <View style={styles.pickerItemTextWrap}>
                    <Text style={styles.pickerItemName}>{lead.name}</Text>
                    <Text style={styles.pickerItemMeta}>{lead.phone}</Text>
                  </View>
                  <Text style={styles.pickerItemIntent}>
                    {(lead.intent_category || "new").replace(/_/g, " ")}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : null}
      </View>

      <View style={styles.modeRow}>
        <View style={styles.modeTextGroup}>
          <Text style={styles.modeLabel}>Auto-Detect Mode</Text>
          {IS_EXPO_GO ? (
            <Text style={[styles.modeSubLabel, { color: "#EF4444" }]}>
              Not available in Expo Go — requires a native APK build
            </Text>
          ) : (
            <Text style={styles.modeSubLabel}>
              {isAutoMode
                ? "Recording starts automatically when you make a call"
                : "Tap Start to begin recording manually"}
            </Text>
          )}
        </View>
        <Switch
          value={isAutoMode && !IS_EXPO_GO}
          onValueChange={toggleAutoMode}
          trackColor={{ false: "#D1D5DB", true: "#FF6600" }}
          thumbColor={isAutoMode && !IS_EXPO_GO ? "#fff" : "#9CA3AF"}
          disabled={IS_EXPO_GO || phase === "recording" || phase === "uploading"}
        />
      </View>

      {isAutoMode && (phase === "listening" || phase === "recording") ? (
        <View style={styles.tipCard}>
          <Text style={styles.tipIcon}>📢</Text>
          <Text style={styles.tipText}>
            Put your call on <Text style={styles.tipBold}>speakerphone</Text> so
            both voices are captured by the microphone.
          </Text>
        </View>
      ) : null}

      {phase === "listening" ? (
        <View style={styles.listeningContainer}>
          <View style={styles.pulseRing}>
            <View style={styles.pulseInner} />
          </View>
          <Text style={styles.listeningTitle}>Listening for call…</Text>
          <Text style={styles.listeningSubtitle}>
            Recording will start automatically when your call connects
          </Text>
        </View>
      ) : null}

      {phase === "idle" && !isAutoMode ? (
        <View style={styles.manualContainer}>
          <TouchableOpacity
            style={styles.recordButton}
            onPress={startManual}
            activeOpacity={0.85}
          >
            <Text style={styles.recordButtonIcon}>⏺</Text>
            <Text style={styles.recordButtonText}>Start{"\n"}Recording</Text>
          </TouchableOpacity>
          <View style={styles.tipCard}>
            <Text style={styles.tipIcon}>📢</Text>
            <Text style={styles.tipText}>
              Put your call on <Text style={styles.tipBold}>speakerphone</Text>{" "}
              before tapping Start so the other party's voice is captured.
            </Text>
          </View>
        </View>
      ) : null}

      {phase === "recording" ? (
        <View style={styles.recordingContainer}>
          <View style={styles.recordingIndicator}>
            <View style={styles.dot} />
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
            <Text style={styles.liveBadge}>LIVE</Text>
          </View>

          {!isAutoMode ? (
            <TouchableOpacity
              style={styles.stopButton}
              onPress={stopManual}
              activeOpacity={0.85}
            >
              <Text style={styles.recordButtonIcon}>⏹</Text>
              <Text style={styles.recordButtonText}>Stop &{"\n"}Upload</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.autoRecordingNote}>
              Recording will stop automatically when the call ends
            </Text>
          )}
        </View>
      ) : null}

      {phase === "uploading" ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF6600" />
          <Text style={styles.statusText}>Uploading & Transcribing…</Text>
          <Text style={styles.subStatusText}>
            AI is analyzing the conversation
          </Text>
        </View>
      ) : null}

      {phase === "error" ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={reset}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {phase === "done" && result ? (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.checkmark}>✅</Text>
            <Text style={styles.resultTitle}>Call Uploaded!</Text>
          </View>

          <Text style={styles.resultLeadText}>
            {selectedLead
              ? `Linked to ${selectedLead.name}`
              : "Currently unassigned. Link it to a lead below or from the web portal."}
          </Text>

          {result.intent_category ? (
            <View style={styles.intentRow}>
              <Text style={styles.intentLabel}>Intent:</Text>
              <View style={styles.intentBadge}>
                <Text style={styles.intentText}>
                  {result.intent_category.replace(/_/g, " ")}
                </Text>
              </View>
            </View>
          ) : null}

          <Text style={styles.summaryLabel}>AI Summary</Text>
          <Text style={styles.summaryText}>{result.summary}</Text>

          {!selectedLead ? (
            <View style={styles.postLinkCard}>
              <Text style={styles.postLinkTitle}>Link This Recording</Text>
              <Text style={styles.postLinkText}>
                Choose the lead this call belongs to so the lead timeline,
                follow-up count, and admin dashboard stay in sync.
              </Text>
              {isLinkingLead ? (
                <ActivityIndicator size="small" color="#FF6600" />
              ) : null}
            </View>
          ) : null}

          <TouchableOpacity style={styles.newButton} onPress={reset}>
            <Text style={styles.newButtonText}>
              {isAutoMode ? "Back to Listening" : "Record Another"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f5f5" },
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#002147",
    marginTop: 16,
    marginBottom: 8,
  },
  contextCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  contextHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  contextTextWrap: { flex: 1 },
  contextTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  contextName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  contextMeta: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 3,
    lineHeight: 18,
  },
  contextButton: {
    backgroundColor: "#E0E7FF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  contextButtonText: {
    color: "#3730A3",
    fontSize: 12,
    fontWeight: "700",
  },
  clearLeadButton: {
    alignSelf: "flex-start",
  },
  contextActionRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  dialLeadButton: {
    backgroundColor: "#DBEAFE",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dialLeadText: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "700",
  },
  clearLeadText: {
    color: "#B45309",
    fontSize: 12,
    fontWeight: "600",
  },
  pickerList: {
    marginTop: 12,
    gap: 8,
  },
  pickerEmptyText: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  pickerItem: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  pickerItemActive: {
    borderColor: "#FF6600",
    backgroundColor: "#FFF7ED",
  },
  pickerItemTextWrap: { flex: 1 },
  pickerItemName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  pickerItemMeta: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  pickerItemIntent: {
    fontSize: 11,
    color: "#92400E",
    textTransform: "capitalize",
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    marginBottom: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  modeTextGroup: { flex: 1, paddingRight: 12 },
  modeLabel: { fontSize: 15, fontWeight: "700", color: "#111827" },
  modeSubLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 3,
    lineHeight: 17,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF7ED",
    borderRadius: 10,
    padding: 14,
    width: "100%",
    borderLeftWidth: 3,
    borderLeftColor: "#FF6600",
    marginBottom: 20,
    gap: 10,
  },
  tipIcon: { fontSize: 18, lineHeight: 22 },
  tipText: { flex: 1, fontSize: 13, color: "#92400E", lineHeight: 19 },
  tipBold: { fontWeight: "700" },
  listeningContainer: { alignItems: "center", marginTop: 24, gap: 16 },
  pulseRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,102,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  pulseInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,102,0,0.25)",
  },
  listeningTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#002147",
  },
  listeningSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  manualContainer: {
    alignItems: "center",
    gap: 24,
    width: "100%",
    marginTop: 8,
  },
  recordButton: {
    backgroundColor: "#FF6600",
    borderRadius: 100,
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#FF6600",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  recordButtonIcon: { fontSize: 28, marginBottom: 4 },
  recordButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  recordingContainer: { alignItems: "center", gap: 20, marginTop: 24 },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#DC2626" },
  durationText: {
    fontSize: 20,
    color: "#DC2626",
    fontWeight: "700",
  },
  liveBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#DC2626",
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: "#DC2626",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  stopButton: {
    backgroundColor: "#DC2626",
    borderRadius: 100,
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#DC2626",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  autoRecordingNote: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 16,
  },
  centered: { alignItems: "center", gap: 12, marginTop: 40 },
  statusText: { fontSize: 16, color: "#374151", fontWeight: "600" },
  subStatusText: { fontSize: 13, color: "#9CA3AF" },
  errorCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    marginTop: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#DC2626",
    gap: 12,
  },
  errorTitle: { fontSize: 16, fontWeight: "700", color: "#991B1B" },
  errorMessage: { fontSize: 14, color: "#7F1D1D", lineHeight: 20 },
  retryButton: {
    backgroundColor: "#DC2626",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  retryButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  resultCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    marginTop: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    gap: 8,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  checkmark: { fontSize: 20 },
  resultTitle: { fontSize: 20, fontWeight: "bold", color: "#002147" },
  resultLeadText: {
    fontSize: 13,
    color: "#4B5563",
    marginBottom: 6,
  },
  intentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  intentLabel: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  intentBadge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  intentText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#065F46",
    textTransform: "capitalize",
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginTop: 4,
  },
  summaryText: { fontSize: 14, color: "#4B5563", lineHeight: 22 },
  postLinkCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 14,
    marginTop: 4,
    gap: 8,
  },
  postLinkTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  postLinkText: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
  },
  newButton: {
    backgroundColor: "#FF6600",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  newButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

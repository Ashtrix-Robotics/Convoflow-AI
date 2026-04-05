# Shared Component Library

Reference for all reusable UI components in the Convoflow AI mobile app.

---

## StatusBadge

Displays the call processing status with appropriate color coding.

```tsx
// components/StatusBadge.tsx
import { View, Text, StyleSheet } from "react-native";

type Status = "pending" | "transcribing" | "completed" | "failed";

const statusConfig: Record<
  Status,
  { bg: string; text: string; label: string }
> = {
  pending: { bg: "#e5e7eb", text: "#374151", label: "Pending" },
  transcribing: { bg: "#fef3c7", text: "#92400e", label: "Transcribing" },
  completed: { bg: "#dcfce7", text: "#166534", label: "Completed" },
  failed: { bg: "#fee2e2", text: "#991b1b", label: "Failed" },
};

export function StatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  text: { fontSize: 12, fontWeight: "600" },
});
```

**Props:**
| Prop | Type | Required | Notes |
|----------|----------|----------|------------------------------------------|
| `status` | `Status` | ✅ | One of the 4 call status enum values |

---

## CallCard

Displays a single call in the calls list.

```tsx
// components/CallCard.tsx
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { StatusBadge } from "./StatusBadge";

type Call = {
  id: string;
  status: string;
  summary: string | null;
  created_at: string;
  client_id: string | null;
};

export function CallCard({ call }: { call: Call }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/calls/${call.id}`)}
    >
      <View style={styles.row}>
        <Text style={styles.date}>
          {new Date(call.created_at).toLocaleDateString()}
        </Text>
        <StatusBadge status={call.status as any} />
      </View>
      {call.summary && (
        <Text style={styles.summary} numberOfLines={2}>
          {call.summary}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  date: { fontSize: 13, color: "#6b7280" },
  summary: { fontSize: 14, color: "#374151", lineHeight: 20 },
});
```

---

## RecordButton

Animated record/stop button with pulsing indicator when active.

```tsx
// components/RecordButton.tsx
import { TouchableOpacity, View, StyleSheet, Animated } from "react-native";
import { useEffect, useRef } from "react";

type Props = {
  isRecording: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export function RecordButton({ isRecording, onPress, disabled }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.15,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1.0,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulse.setValue(1);
    }
  }, [isRecording]);

  return (
    <Animated.View style={[styles.outer, { transform: [{ scale: pulse }] }]}>
      <TouchableOpacity
        style={[styles.button, isRecording && styles.active]}
        onPress={onPress}
        disabled={disabled}
      >
        <View style={isRecording ? styles.stopIcon : styles.micIcon} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: { alignItems: "center", justifyContent: "center" },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#d97757",
    alignItems: "center",
    justifyContent: "center",
  },
  active: { backgroundColor: "#ef4444" },
  micIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff" },
  stopIcon: { width: 22, height: 22, borderRadius: 4, backgroundColor: "#fff" },
});
```

---

## LoadingSpinner

Centered activity indicator with optional label.

```tsx
// components/LoadingSpinner.tsx
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";

export function LoadingSpinner({ label }: { label?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#d97757" />
      {label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  label: { color: "#6b7280", fontSize: 14 },
});
```

---

## ActionItemsList

Renders the array of action items from a completed call.

```tsx
// components/ActionItemsList.tsx
import { View, Text, StyleSheet } from "react-native";

export function ActionItemsList({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Action Items</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.item}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 12 },
  heading: {
    fontSize: 16,
    fontWeight: "600",
    color: "#141413",
    marginBottom: 8,
  },
  row: { flexDirection: "row", gap: 8, marginBottom: 6 },
  bullet: { color: "#d97757", fontSize: 16, lineHeight: 22 },
  item: { flex: 1, fontSize: 14, color: "#374151", lineHeight: 22 },
});
```

---

## Design Tokens

```typescript
// constants/theme.ts
export const colors = {
  dark: "#141413",
  light: "#faf9f5",
  orange: "#d97757", // primary brand, record button
  blue: "#6a9bcc", // info, links
  green: "#788c5d", // success, completed status
  danger: "#ef4444", // failed status, stop button
  muted: "#6b7280", // secondary text
  surface: "#ffffff", // card backgrounds
  border: "#e5e7eb", // dividers, borders
};
```

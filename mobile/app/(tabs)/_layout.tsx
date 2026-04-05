import { Tabs, Redirect } from "expo-router";
import { Text } from "react-native";
import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { TOKEN_KEY } from "../../constants";

export default function TabsLayout() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY).then((token) => {
      setAuthed(!!token);
    });
  }, []);

  if (authed === null) return null; // brief loading
  if (!authed) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#002147" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "bold" },
        tabBarActiveTintColor: "#FF6600",
        tabBarInactiveTintColor: "#888",
        tabBarStyle: { paddingBottom: 4, height: 56 },
      }}
    >
      <Tabs.Screen
        name="leads"
        options={{
          title: "Leads",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>👥</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: "Record",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>🎙️</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📋</Text>
          ),
        }}
      />
    </Tabs>
  );
}

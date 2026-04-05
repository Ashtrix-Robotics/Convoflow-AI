import { Redirect } from "expo-router";

// Default entry point: always send to login first.
// Login screen handles "already logged in" and redirects to /(tabs)/leads.
export default function Index() {
  return <Redirect href="/(auth)/login" />;
}

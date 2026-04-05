# Expo Router v4 — Navigation Patterns

Reference for file-based routing in the Convoflow AI mobile app using Expo Router v4.

---

## File Conventions

| File path                 | Route           | Notes                                  |
| ------------------------- | --------------- | -------------------------------------- |
| `app/_layout.tsx`         | Root layout     | Sets up fonts, auth guard, QueryClient |
| `app/(auth)/login.tsx`    | `/login`        | Unauthenticated group                  |
| `app/(auth)/register.tsx` | `/register`     | Unauthenticated group                  |
| `app/(tabs)/_layout.tsx`  | Tab bar         | Authenticated tab navigation           |
| `app/(tabs)/index.tsx`    | `/` (Calls tab) | Default tab                            |
| `app/(tabs)/record.tsx`   | `/record`       | Recording tab                          |
| `app/(tabs)/clients.tsx`  | `/clients`      | Clients tab                            |
| `app/calls/[id].tsx`      | `/calls/:id`    | Call detail (dynamic route)            |
| `app/+not-found.tsx`      | 404             | Catch-all fallback                     |

---

## Root Layout (Auth Guard)

```tsx
// app/_layout.tsx
export default function RootLayout() {
  const { token } = useAuthStore();
  const segments = useSegments();

  useEffect(() => {
    const inAuth = segments[0] === "(auth)";
    if (!token && !inAuth) {
      router.replace("/(auth)/login");
    } else if (token && inAuth) {
      router.replace("/(tabs)");
    }
  }, [token, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

---

## Tab Layout

```tsx
// app/(tabs)/_layout.tsx
export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#d97757' }}>
      <Tabs.Screen name="index"   options={{ title: 'Calls',   tabBarIcon: ... }} />
      <Tabs.Screen name="record"  options={{ title: 'Record',  tabBarIcon: ... }} />
      <Tabs.Screen name="clients" options={{ title: 'Clients', tabBarIcon: ... }} />
    </Tabs>
  );
}
```

---

## Typed Route Parameters

```typescript
// app/calls/[id].tsx
import { useLocalSearchParams } from "expo-router";

export default function CallDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // id is always a string — never undefined inside [id].tsx
}
```

---

## Programmatic Navigation

```typescript
import { router } from "expo-router";

// Navigate (adds to stack)
router.push(`/calls/${callId}`);

// Replace (no back button)
router.replace("/(tabs)");

// Go back
router.back();

// Typed with href
router.push({ pathname: "/calls/[id]", params: { id: callId } });
```

---

## Common Route Groups

| Group    | Purpose                  | Auth State           |
| -------- | ------------------------ | -------------------- |
| `(auth)` | Login + Register screens | Unauthenticated only |
| `(tabs)` | Main app tab navigation  | Authenticated only   |

Route group folders `(name)` do NOT appear in the URL path.

---

## Stack Configuration (Hiding Headers)

```tsx
// Hide header for specific screens
<Stack.Screen name="calls/[id]" options={{ headerShown: false }} />

// Custom back button title
<Stack.Screen options={{ title: 'Call Details', headerBackTitle: 'Back' }} />
```

---

## Deep Links

Expo Router v4 auto-generates deep link schemes from `app.json`:

```json
{
  "scheme": "convoflow",
  "expo": { "scheme": "convoflow" }
}
```

Deep link: `convoflow://calls/550e8400-...` opens `app/calls/[id].tsx`.

---

## Pitfalls

| Problem                             | Cause                                        | Fix                                                                |
| ----------------------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| Blank screen on auth redirect       | `router.replace` called before layout mounts | Wrap in `useEffect` with token dependency                          |
| `useLocalSearchParams` returns `{}` | Called outside a route file                  | Only use inside `app/` route files                                 |
| Tab bar shows on modal              | Modal screen inside `(tabs)` group           | Move modal to root stack or use `presentation: 'modal'`            |
| Back button on root tab             | Navigator stacks accumulating                | Use `router.replace` instead of `router.push` for auth transitions |

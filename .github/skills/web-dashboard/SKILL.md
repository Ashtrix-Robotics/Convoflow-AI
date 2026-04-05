---
name: web-dashboard
description: "Use this skill for web dashboard development in the Convoflow AI project. Covers React 18 + Vite 6 patterns, TanStack Query v5 data fetching, React Router v6 protected routes, Recharts visualizations for call analytics, Tailwind CSS utility patterns, and call detail/dashboard page structure. Trigger when working on any file in web/src/."
---

# Web Dashboard Skill — Convoflow AI

## Project Stack

- **React 18** + **Vite 6**
- **React Router v6** — client-side routing with protected routes
- **TanStack Query v5** — server state / cache management
- **Recharts** — analytics charts
- **Lucide React** — icon set
- **Tailwind CSS v3** — utility-first styling
- **Axios** — HTTP client with JWT interceptor

---

## Directory Structure

```
web/src/
├── main.tsx               # React root, QueryClient, BrowserRouter
├── App.tsx                # Route config + auth guard
├── index.css              # Tailwind directives
├── services/
│   └── api.ts             # Axios client + all API calls
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx      # Calls list with filters
│   ├── CallDetail.tsx     # Full call: transcript + summary + followups
│   └── Clients.tsx
└── components/
    ├── Layout.tsx          # Sidebar + header shell
    ├── StatusBadge.tsx
    └── CallCard.tsx
```

---

## Protected Route Pattern

```tsx
// App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("access_token");
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calls/:id"
          element={
            <ProtectedRoute>
              <CallDetail />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## API Client

```ts
// services/api.ts
import axios from "axios";

const apiClient = axios.create({ baseURL: "/api" }); // Vite proxies /api → localhost:8000

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const api = {
  login: (email: string, password: string) =>
    apiClient.post(
      "/auth/login",
      new URLSearchParams({ username: email, password }),
    ),

  getCalls: () => apiClient.get<CallRecord[]>("/calls"),
  getCall: (id: string) => apiClient.get<CallRecord>(`/calls/${id}`),
  getClients: () => apiClient.get<Client[]>("/clients"),
  createFollowup: (callId: string, data: { due_date: string; notes: string }) =>
    apiClient.post("/followups", { call_id: callId, ...data }),
};
```

---

## Vite Proxy Config

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        rewrite: (path) => path.replace(/^\/api/, ""),
        changeOrigin: true,
      },
    },
  },
});
```

This allows the frontend to call `/api/calls` instead of `http://localhost:8000/calls`, avoiding CORS issues in development.

---

## Dashboard Page (Calls List)

```tsx
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const { data: calls, isLoading } = useQuery({
    queryKey: ["calls"],
    queryFn: () => api.getCalls().then((r) => r.data),
    refetchInterval: 15_000, // Refresh every 15s for in-progress transcriptions
  });

  if (isLoading)
    return <div className="flex justify-center p-8">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Call History</h1>
      <div className="space-y-3">
        {calls?.map((call) => (
          <CallCard key={call.id} call={call} />
        ))}
      </div>
    </div>
  );
}
```

---

## Call Detail Page

```tsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

export default function CallDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: call } = useQuery({
    queryKey: ["call", id],
    queryFn: () => api.getCall(id!).then((r) => r.data),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "completed" || s === "failed" ? false : 3000;
    },
  });

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Call Details</h1>
        <StatusBadge status={call?.status ?? "pending"} />
      </header>

      {call?.status === "completed" && (
        <>
          {/* Summary section */}
          <section className="bg-white rounded-xl p-5 shadow-sm border">
            <h2 className="font-semibold text-gray-700 mb-2">Summary</h2>
            <p className="text-gray-600">{call.summary}</p>
          </section>

          {/* Action Items */}
          <section className="bg-white rounded-xl p-5 shadow-sm border">
            <h2 className="font-semibold text-gray-700 mb-3">Action Items</h2>
            <ul className="list-disc list-inside space-y-1">
              {call.action_items?.map((item, i) => (
                <li key={i} className="text-gray-600">
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* Raw Transcript */}
          <section className="bg-white rounded-xl p-5 shadow-sm border">
            <h2 className="font-semibold text-gray-700 mb-2">Transcript</h2>
            <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans">
              {call.raw_transcript}
            </pre>
          </section>
        </>
      )}

      {call?.status === "transcribing" && (
        <div className="text-center py-12 text-blue-600">
          Transcribing your call... this may take a minute.
        </div>
      )}
    </div>
  );
}
```

---

## Analytics Charts (Recharts)

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// Calls per day chart
function CallsBarChart({ calls }: { calls: CallRecord[] }) {
    const data = buildDailyData(calls);  // group by date
    return (
        <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#6a9bcc" radius={4} />
            </Bar>
        </ResponsiveContainer>
    );
}
```

Use brand colors (from `brand-guidelines` skill) when customizing chart colors:

- Primary blue: `#6a9bcc`
- Accent orange: `#d97757`
- Success green: `#788c5d`

---

## Status Badge Component

```tsx
// components/StatusBadge.tsx
const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  transcribing: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status.toUpperCase()}
    </span>
  );
}
```

---

## Login Page Pattern

```tsx
function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data } = await api.login(email, password);
      localStorage.setItem("access_token", data.access_token);
      navigate("/");
    } catch {
      setError("Invalid email or password");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto mt-24 space-y-4">
      <h1 className="text-2xl font-bold text-center">Convoflow AI</h1>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full border rounded-lg p-3"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full border rounded-lg p-3"
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        className="w-full bg-blue-600 text-white rounded-lg p-3 font-semibold"
      >
        Sign In
      </button>
    </form>
  );
}
```

---

## Common Tailwind Patterns Used in this Project

| Purpose         | Classes                                                                      |
| --------------- | ---------------------------------------------------------------------------- |
| Card container  | `bg-white rounded-xl p-5 shadow-sm border`                                   |
| Page container  | `max-w-4xl mx-auto p-6`                                                      |
| Section heading | `font-semibold text-gray-700 mb-2`                                           |
| Body text       | `text-gray-600`                                                              |
| Primary button  | `bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg`              |
| Danger button   | `bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg`                |
| Input field     | `w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none` |

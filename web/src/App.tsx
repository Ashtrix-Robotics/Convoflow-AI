import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { TOKEN_KEY } from "./config";

// ── Lazy-load every page so each route gets its own JS chunk ─────────────────
// Users only download the code for pages they actually visit.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CallDetail = lazy(() => import("./pages/CallDetail"));
const Login = lazy(() => import("./pages/Login"));
const Leads = lazy(() => import("./pages/Leads"));
const LeadDetail = lazy(() => import("./pages/LeadDetail"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const TeamManagement = lazy(() => import("./pages/TeamManagement"));
const CampaignKnowledge = lazy(() => import("./pages/CampaignKnowledge"));
const ClassManagement = lazy(() => import("./pages/ClassManagement"));
const Profile = lazy(() => import("./pages/Profile"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ServerWakeUp = lazy(() => import("./components/ServerWakeUp"));

// ── Minimal loading indicator shown during chunk download ────────────────────
function PageLoader() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[#FF6600] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const isAuthenticated = () => !!localStorage.getItem(TOKEN_KEY);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      {/* Global cold-start banner — visible on any page */}
      <ServerWakeUp />
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
          path="/leads"
          element={
            <ProtectedRoute>
              <Leads />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leads/:id"
          element={
            <ProtectedRoute>
              <LeadDetail />
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
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute>
              <AdminSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/team"
          element={
            <ProtectedRoute>
              <TeamManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/campaigns"
          element={
            <ProtectedRoute>
              <CampaignKnowledge />
            </ProtectedRoute>
          }
        />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/admin/classes"
          element={
            <ProtectedRoute>
              <ClassManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

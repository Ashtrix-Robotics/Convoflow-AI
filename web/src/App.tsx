import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import CallDetail from "./pages/CallDetail";
import Login from "./pages/Login";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import AdminSettings from "./pages/AdminSettings";
import TeamManagement from "./pages/TeamManagement";
import CampaignKnowledge from "./pages/CampaignKnowledge";
import ServerWakeUp from "./components/ServerWakeUp";
import { TOKEN_KEY } from "./config";

const isAuthenticated = () => !!localStorage.getItem(TOKEN_KEY);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

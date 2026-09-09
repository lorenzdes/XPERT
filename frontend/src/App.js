import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CompanyProvider } from "@/context/CompanyContext";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import AuthCallback from "@/pages/AuthCallback";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Fatture from "@/pages/Fatture";
import DriveSync from "@/pages/DriveSync";
import Pec from "@/pages/Pec";
import Copilot from "@/pages/Copilot";
import Bilanci from "@/pages/Bilanci";
import Settings from "@/pages/Settings";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <CompanyProvider>
              <Layout />
            </CompanyProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="fatture" element={<Fatture />} />
        <Route path="drive" element={<DriveSync />} />
        <Route path="pec" element={<Pec />} />
        <Route path="copilot" element={<Copilot />} />
        <Route path="bilanci" element={<Bilanci />} />
        <Route path="impostazioni" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;

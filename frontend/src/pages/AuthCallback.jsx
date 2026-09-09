import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { TrendingUp } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    const sessionId = match ? match[1] : null;
    (async () => {
      if (!sessionId) {
        navigate("/login");
        return;
      }
      try {
        const { data } = await api.post("/auth/google/session", { session_id: sessionId });
        setUser(data);
        window.history.replaceState({}, document.title, "/");
        navigate("/");
      } catch {
        navigate("/login");
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B132B] text-white gap-4">
      <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center">
        <TrendingUp className="h-6 w-6" />
      </div>
      <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
      <p className="text-slate-300 text-sm">Accesso in corso...</p>
    </div>
  );
}

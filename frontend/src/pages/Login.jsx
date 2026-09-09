import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Loader2 } from "lucide-react";

const AuthShell = ({ children }) => (
  <div className="min-h-screen grid lg:grid-cols-2 bg-background">
    <div className="hidden lg:flex flex-col justify-between p-12 bg-[#0B132B] text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-20"
        style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #2563EB 0%, transparent 40%), radial-gradient(circle at 80% 80%, #059669 0%, transparent 40%)" }} />
      <div className="relative z-10 flex items-center gap-2">
        <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
          <TrendingUp className="h-5 w-5" />
        </div>
        <span className="font-heading text-xl font-bold">XPERT</span>
      </div>
      <div className="relative z-10 space-y-4">
        <h1 className="font-heading text-4xl font-bold leading-tight">
          Fatture, incassi e bilanci<br />in un unico posto.
        </h1>
        <p className="text-slate-300 text-base max-w-md">
          Dashboard integrata con TeamSystem, PEC Aruba e Google Drive. Interroga il tuo CRM con il Copilot AI.
        </p>
      </div>
      <div className="relative z-10 text-slate-400 text-sm">© {new Date().getFullYear()} XPERT — Demo</div>
    </div>
    <div className="flex items-center justify-center p-6 sm:p-12">{children}</div>
  </div>
);

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("lorello97@gmail.com");
  const [password, setPassword] = useState("Admin123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setUser(data);
      navigate("/");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <AuthShell>
      <div className="w-full max-w-sm fade-up">
        <h2 className="font-heading text-3xl font-bold tracking-tight">Bentornato</h2>
        <p className="text-muted-foreground mt-2 text-sm">Accedi al tuo pannello finanziario</p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              data-testid="login-email-input" required />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs text-accent hover:underline" data-testid="forgot-password-link">
                Password dimenticata?
              </Link>
            </div>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              data-testid="login-password-input" required />
          </div>
          {error && <p className="text-sm text-destructive" data-testid="login-error">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit-button">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Accedi
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> oppure <div className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={googleLogin} data-testid="google-login-button">
          <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continua con Google
        </Button>

        <p className="text-sm text-muted-foreground text-center mt-6">
          Non hai un account?{" "}
          <Link to="/register" className="text-accent font-medium hover:underline" data-testid="go-register-link">Registrati</Link>
        </p>
      </div>
    </AuthShell>
  );
}

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Loader2 } from "lucide-react";

export default function Register() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", form);
      setUser(data);
      navigate("/");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm fade-up">
        <div className="flex items-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-xl bg-[#0B132B] flex items-center justify-center text-white">
            <TrendingUp className="h-5 w-5" />
          </div>
          <span className="font-heading text-xl font-bold">FinDash CRM</span>
        </div>
        <h2 className="font-heading text-3xl font-bold tracking-tight">Crea un account</h2>
        <p className="text-muted-foreground mt-2 text-sm">Inizia a gestire fatture e incassi</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              data-testid="register-name-input" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              data-testid="register-email-input" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              data-testid="register-password-input" required />
          </div>
          {error && <p className="text-sm text-destructive" data-testid="register-error">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading} data-testid="register-submit-button">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Registrati
          </Button>
        </form>
        <p className="text-sm text-muted-foreground text-center mt-6">
          Hai già un account?{" "}
          <Link to="/login" className="text-accent font-medium hover:underline" data-testid="go-login-link">Accedi</Link>
        </p>
      </div>
    </div>
  );
}

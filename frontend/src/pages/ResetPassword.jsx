import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft } from "lucide-react";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("Password reimpostata. Effettua l'accesso.");
      navigate("/login");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm fade-up">
        <h2 className="font-heading text-3xl font-bold tracking-tight">Nuova password</h2>
        <p className="text-muted-foreground mt-2 text-sm">Scegli una nuova password sicura</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">Nuova password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              data-testid="reset-password-input" required minLength={6} />
          </div>
          {error && <p className="text-sm text-destructive" data-testid="reset-error">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || !token} data-testid="reset-submit-button">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Reimposta password
          </Button>
        </form>
        <Link to="/login" className="inline-flex items-center gap-1 text-accent text-sm hover:underline mt-6">
          <ArrowLeft className="h-4 w-4" /> Torna al login
        </Link>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MailCheck, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm fade-up">
        {sent ? (
          <div className="text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <MailCheck className="h-6 w-6 text-emerald-600" />
            </div>
            <h2 className="font-heading text-2xl font-bold">Controlla la tua email</h2>
            <p className="text-sm text-muted-foreground" data-testid="forgot-confirmation">
              Se l'email è registrata, riceverai un link per reimpostare la password.
            </p>
            <Link to="/login" className="inline-flex items-center gap-1 text-accent text-sm hover:underline">
              <ArrowLeft className="h-4 w-4" /> Torna al login
            </Link>
          </div>
        ) : (
          <>
            <h2 className="font-heading text-3xl font-bold tracking-tight">Password dimenticata</h2>
            <p className="text-muted-foreground mt-2 text-sm">Ti invieremo un link per reimpostarla</p>
            <form onSubmit={submit} className="mt-8 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  data-testid="forgot-email-input" required />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading} data-testid="forgot-submit-button">
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Invia link
              </Button>
            </form>
            <Link to="/login" className="inline-flex items-center gap-1 text-accent text-sm hover:underline mt-6">
              <ArrowLeft className="h-4 w-4" /> Torna al login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useCompany } from "@/context/CompanyContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Database, Mail, HardDrive, Building2, CheckCircle2 } from "lucide-react";

const IntegrationCard = ({ icon: Icon, name, desc, connected, testid }) => (
  <Card className="p-5 flex items-start gap-4" data-testid={testid}>
    <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
      <Icon className="h-5 w-5 text-accent" />
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <p className="font-semibold">{name}</p>
        {connected && (
          <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Connesso
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground mt-1">{desc}</p>
    </div>
  </Card>
);

export default function Settings() {
  const { user } = useAuth();
  const { companies } = useCompany();
  const [autoSync, setAutoSync] = useState(true);

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-view">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Impostazioni CRM</h1>
        <p className="text-muted-foreground text-sm mt-1">Integrazioni, sincronizzazione e aziende collegate</p>
      </div>

      <div className="grid gap-4">
        <IntegrationCard icon={Database} name="TeamSystem CRM" testid="integration-teamsystem"
          desc="Sincronizzazione automatica di fatture, incassi e bilanci." connected />
        <IntegrationCard icon={Mail} name="Aruba PEC" testid="integration-pec"
          desc="Ricezione e invio di posta elettronica certificata." connected />
        <IntegrationCard icon={HardDrive} name="Google Drive" testid="integration-drive"
          desc="Lettura automatica delle fatture da cartella condivisa." connected />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-semibold">Sincronizzazione automatica periodica</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Aggiorna i dati dal CRM ogni ora, anche a connessione chiusa (i dati restano salvati nel database).
            </p>
          </div>
          <Switch checked={autoSync} onCheckedChange={(v) => { setAutoSync(v); toast.success(v ? "Sync automatico attivato" : "Sync automatico disattivato"); }}
            data-testid="autosync-switch" />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-heading text-lg font-semibold mb-3 flex items-center gap-2">
          <Building2 className="h-5 w-5" /> Aziende collegate
        </h3>
        <div className="space-y-2">
          {companies.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2 border-b border-border/60">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground font-mono-num">P.IVA {c.piva} · SDI {c.sdi}</p>
              </div>
              <span className="text-xs text-muted-foreground">{c.city}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-heading text-lg font-semibold mb-3">Account</h3>
        <div className="text-sm space-y-1">
          <p><span className="text-muted-foreground">Nome:</span> {user?.name}</p>
          <p><span className="text-muted-foreground">Email:</span> {user?.email}</p>
          <p><span className="text-muted-foreground">Ruolo:</span> {user?.role}</p>
          <p><span className="text-muted-foreground">Accesso:</span> {user?.auth_provider === "google" ? "Google" : "Email / Password"}</p>
        </div>
      </Card>
    </div>
  );
}

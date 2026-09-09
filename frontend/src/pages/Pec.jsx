import { useEffect, useState } from "react";
import { api, dateIt } from "@/lib/api";
import { useCompany } from "@/context/CompanyContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Mail, MailOpen, Send, Paperclip, ShieldCheck } from "lucide-react";

const typeLabel = {
  ricevuta_consegna: { t: "Consegna", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ricevuta_accettazione: { t: "Accettazione", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  messaggio: { t: "Messaggio", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  notifica_scarto: { t: "Scarto SDI", cls: "bg-rose-100 text-rose-700 border-rose-200" },
  inviato: { t: "Inviato", cls: "bg-violet-100 text-violet-700 border-violet-200" },
};

export default function Pec() {
  const { companyId, companies, canWriteAny } = useCompany();
  const [msgs, setMsgs] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ destinatario: "", oggetto: "", corpo: "" });
  const [sending, setSending] = useState(false);

  const load = () => {
    api.get(`/pec/messages?company_id=${companyId}`).then((r) => setMsgs(r.data)).catch(() => {});
  };
  useEffect(load, [companyId]);

  const openMsg = async (m) => {
    if (!m.letto) {
      await api.post(`/pec/messages/${m.id}/read`).catch(() => {});
      load();
    }
  };

  const send = async () => {
    setSending(true);
    try {
      const cid = companyId === "all" ? companies[0]?.id : companyId;
      await api.post("/pec/send", { company_id: cid, ...form });
      toast.success("PEC inviata (ricevuta di accettazione generata)");
      setOpen(false);
      setForm({ destinatario: "", oggetto: "", corpo: "" });
      load();
    } catch {
      toast.error("Errore invio PEC");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="pec-view">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">PEC Aruba</h1>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Posta certificata · gestore Aruba PEC S.p.A.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="pec-compose-btn" disabled={!canWriteAny}><Send className="h-4 w-4 mr-2" /> Componi PEC</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuova PEC certificata</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Destinatario PEC</Label>
                <Input placeholder="cliente@pec.it" value={form.destinatario}
                  onChange={(e) => setForm({ ...form, destinatario: e.target.value })} data-testid="pec-to-input" />
              </div>
              <div className="space-y-1.5">
                <Label>Oggetto</Label>
                <Input value={form.oggetto} onChange={(e) => setForm({ ...form, oggetto: e.target.value })} data-testid="pec-subject-input" />
              </div>
              <div className="space-y-1.5">
                <Label>Messaggio</Label>
                <Textarea rows={5} value={form.corpo} onChange={(e) => setForm({ ...form, corpo: e.target.value })} data-testid="pec-body-input" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={send} disabled={sending || !form.destinatario} data-testid="pec-send-btn">
                <Send className="h-4 w-4 mr-2" /> Invia PEC
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card data-testid="pec-inbox">
        <div className="divide-y divide-border">
          {msgs.map((m) => {
            const tl = typeLabel[m.tipo] || typeLabel.messaggio;
            return (
              <button key={m.id} onClick={() => openMsg(m)}
                className={`w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-muted/40 transition-colors ${!m.letto ? "bg-blue-50/50" : ""}`}
                data-testid={`pec-msg-${m.id}`}>
                <div className="mt-0.5">
                  {m.letto ? <MailOpen className="h-5 w-5 text-muted-foreground" /> : <Mail className="h-5 w-5 text-accent" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium truncate ${!m.letto ? "font-semibold" : ""}`}>{m.mittente}</span>
                    <Badge variant="outline" className={`text-[10px] ${tl.cls}`}>{tl.t}</Badge>
                    {m.allegati > 0 && (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-0.5">
                        <Paperclip className="h-3 w-3" />{m.allegati}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm truncate ${!m.letto ? "font-medium" : "text-muted-foreground"}`}>{m.oggetto}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{m.anteprima}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{dateIt(m.data_ricezione)}</span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

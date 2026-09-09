import { useEffect, useState } from "react";
import { api, euro, dateIt } from "@/lib/api";
import { useCompany } from "@/context/CompanyContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Search, Send } from "lucide-react";

const StatusBadge = ({ stato }) => {
  const map = {
    pagata: { label: "Pagata", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    da_pagare: { label: "In scadenza", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    scaduta: { label: "Scaduta", cls: "bg-rose-100 text-rose-700 border-rose-200" },
  };
  const s = map[stato] || map.da_pagare;
  return <Badge variant="outline" className={s.cls}>{s.label}</Badge>;
};

export default function Fatture() {
  const { companyId, canWrite } = useCompany();
  const [invoices, setInvoices] = useState([]);
  const [stato, setStato] = useState("all");
  const [q, setQ] = useState("");

  const load = () => {
    api.get(`/invoices?company_id=${companyId}&stato=${stato}`).then((r) => setInvoices(r.data)).catch(() => {});
  };

  useEffect(load, [companyId, stato]);

  const markPaid = async (id) => {
    try {
      await api.post(`/invoices/${id}/mark-paid`);
      toast.success("Fattura segnata come pagata");
      load();
    } catch {
      toast.error("Errore");
    }
  };

  const sendReminder = async (id) => {
    try {
      const { data } = await api.post(`/invoices/${id}/send-reminder`);
      toast.success(data.message || "Sollecito inviato");
    } catch (e) {
      toast.error("Invio sollecito non riuscito");
    }
  };

  const filtered = invoices.filter(
    (i) => i.cliente.toLowerCase().includes(q.toLowerCase()) || i.numero.includes(q)
  );

  return (
    <div className="space-y-6" data-testid="fatture-view">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Gestione Fatture</h1>
          <p className="text-muted-foreground text-sm mt-1">Fatture elettroniche sincronizzate dal CRM</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cerca cliente o numero" value={q} onChange={(e) => setQ(e.target.value)}
              className="pl-9 w-56" data-testid="invoice-search-input" />
          </div>
          <Select value={stato} onValueChange={setStato}>
            <SelectTrigger className="w-40" data-testid="invoice-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              <SelectItem value="pagata">Pagate</SelectItem>
              <SelectItem value="da_pagare">In scadenza</SelectItem>
              <SelectItem value="scaduta">Scadute</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card data-testid="invoices-table">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 font-semibold">Numero</th>
                <th className="px-5 py-3 font-semibold">Cliente</th>
                <th className="px-5 py-3 font-semibold">Emissione</th>
                <th className="px-5 py-3 font-semibold">Scadenza</th>
                <th className="px-5 py-3 font-semibold text-right">Imponibile</th>
                <th className="px-5 py-3 font-semibold text-right">Totale</th>
                <th className="px-5 py-3 font-semibold">Stato</th>
                <th className="px-5 py-3 font-semibold text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="border-b border-border/60 hover:bg-muted/40 transition-colors">
                  <td className="px-5 py-3 font-mono-num text-xs">{i.numero}</td>
                  <td className="px-5 py-3 font-medium">{i.cliente}</td>
                  <td className="px-5 py-3 text-muted-foreground">{dateIt(i.data_emissione)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{dateIt(i.data_scadenza)}</td>
                  <td className="px-5 py-3 text-right font-mono-num">{euro(i.imponibile)}</td>
                  <td className="px-5 py-3 text-right font-mono-num font-semibold">{euro(i.totale)}</td>
                  <td className="px-5 py-3"><StatusBadge stato={i.stato} /></td>
                  <td className="px-5 py-3 text-right">
                    {i.stato !== "pagata" && canWrite(i.company_id) && (
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => sendReminder(i.id)}
                          data-testid={`send-reminder-${i.id}`} className="text-accent hover:text-accent">
                          <Send className="h-4 w-4 mr-1" /> Sollecita
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => markPaid(i.id)}
                          data-testid={`mark-paid-${i.id}`} className="text-emerald-600 hover:text-emerald-700">
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Incassa
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-muted-foreground">Nessuna fattura trovata</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

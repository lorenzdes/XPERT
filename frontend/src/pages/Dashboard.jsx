import { useEffect, useState } from "react";
import { api, euro, dateIt } from "@/lib/api";
import { useCompany } from "@/context/CompanyContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Euro, TrendingUp, Clock, AlertTriangle } from "lucide-react";

const StatusBadge = ({ stato }) => {
  const map = {
    pagata: { label: "Pagata", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    da_pagare: { label: "In scadenza", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    scaduta: { label: "Scaduta", cls: "bg-rose-100 text-rose-700 border-rose-200" },
  };
  const s = map[stato] || map.da_pagare;
  return <Badge variant="outline" className={s.cls}>{s.label}</Badge>;
};

const KpiCard = ({ label, value, icon: Icon, tone, testid, delay }) => (
  <Card className="p-5 fade-up" style={{ animationDelay: `${delay}ms` }} data-testid={testid}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-heading text-2xl font-bold mt-2 font-mono-num">{euro(value)}</p>
      </div>
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </Card>
);

export default function Dashboard() {
  const { companyId } = useCompany();
  const [data, setData] = useState(null);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    api.get(`/dashboard/summary?company_id=${companyId}`).then((r) => setData(r.data)).catch(() => {});
    api.get(`/invoices?company_id=${companyId}`).then((r) => setInvoices(r.data.slice(0, 8))).catch(() => {});
  }, [companyId]);

  if (!data) return <div className="animate-pulse text-muted-foreground">Caricamento...</div>;

  return (
    <div className="space-y-6" data-testid="dashboard-view">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Panoramica Fatturato e Incassi</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data.num_fatture} fatture sincronizzate da TeamSystem
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Totale Fatturato" value={data.totale_fatturato} icon={Euro}
          tone="bg-blue-100 text-blue-600" testid="kpi-card-fatturato" delay={0} />
        <KpiCard label="Incassato" value={data.incassato} icon={TrendingUp}
          tone="bg-emerald-100 text-emerald-600" testid="kpi-card-incassato" delay={60} />
        <KpiCard label="In Scadenza" value={data.in_scadenza} icon={Clock}
          tone="bg-amber-100 text-amber-600" testid="kpi-card-scadenza" delay={120} />
        <KpiCard label="Scaduto" value={data.scaduto} icon={AlertTriangle}
          tone="bg-rose-100 text-rose-600" testid="kpi-card-scaduto" delay={180} />
      </div>

      <Card className="p-5 fade-up" style={{ animationDelay: "220ms" }}>
        <h3 className="font-heading text-lg font-semibold mb-4">Andamento Fatturato vs Incassi</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.trend}>
              <defs>
                <linearGradient id="gFat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="mese" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => euro(v)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Area type="monotone" dataKey="fatturato" name="Fatturato" stroke="#2563EB" fill="url(#gFat)" strokeWidth={2} />
              <Area type="monotone" dataKey="incassato" name="Incassato" stroke="#059669" fill="url(#gInc)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="fade-up" style={{ animationDelay: "260ms" }} data-testid="recent-invoices-table">
        <div className="p-5 border-b border-border">
          <h3 className="font-heading text-lg font-semibold">Ultime Fatture</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 font-semibold">Numero</th>
                <th className="px-5 py-3 font-semibold">Cliente</th>
                <th className="px-5 py-3 font-semibold">Scadenza</th>
                <th className="px-5 py-3 font-semibold text-right">Totale</th>
                <th className="px-5 py-3 font-semibold">Stato</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-b border-border/60 hover:bg-muted/40 transition-colors">
                  <td className="px-5 py-3 font-mono-num text-xs">{i.numero}</td>
                  <td className="px-5 py-3 font-medium">{i.cliente}</td>
                  <td className="px-5 py-3 text-muted-foreground">{dateIt(i.data_scadenza)}</td>
                  <td className="px-5 py-3 text-right font-mono-num font-semibold">{euro(i.totale)}</td>
                  <td className="px-5 py-3"><StatusBadge stato={i.stato} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

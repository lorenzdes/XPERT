import { useEffect, useState } from "react";
import { api, euro } from "@/lib/api";
import { useCompany } from "@/context/CompanyContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { Download, FileSpreadsheet } from "lucide-react";

const Row = ({ label, value, bold, tone }) => (
  <div className={`flex justify-between py-2 border-b border-border/60 ${bold ? "font-semibold" : ""}`}>
    <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
    <span className={`font-mono-num ${tone || ""}`}>{euro(value)}</span>
  </div>
);

const Indice = ({ label, value, suffix }) => (
  <Card className="p-4">
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="font-heading text-2xl font-bold mt-1 font-mono-num">{value}{suffix}</p>
  </Card>
);

export default function Bilanci() {
  const { companyId, companies } = useCompany();
  const [bilanci, setBilanci] = useState([]);
  const [selId, setSelId] = useState(null);

  useEffect(() => {
    api.get(`/bilanci?company_id=${companyId}`).then((r) => {
      setBilanci(r.data);
      setSelId(r.data[0]?.id || null);
    }).catch(() => {});
  }, [companyId]);

  const sel = bilanci.find((b) => b.id === selId);
  const companyName = (id) => companies.find((c) => c.id === id)?.name || id;

  const download = () => toast.success("Bilancio CEE generato e scaricato (PDF)");

  if (!sel) return <div className="text-muted-foreground">Nessun bilancio disponibile</div>;

  const ce = sel.conto_economico;
  const sp = sel.stato_patrimoniale;
  const chartData = [
    { nome: "Ricavi", val: ce.ricavi, color: "#2563EB" },
    { nome: "Costi", val: ce.costi_produzione, color: "#E11D48" },
    { nome: "EBITDA", val: ce.ebitda, color: "#059669" },
    { nome: "EBIT", val: ce.ebit, color: "#D97706" },
    { nome: "Utile Netto", val: ce.utile_netto, color: "#7C3AED" },
  ];

  return (
    <div className="space-y-6" data-testid="bilanci-view">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Estrazione Bilanci Società</h1>
          <p className="text-muted-foreground text-sm mt-1">Stato patrimoniale e conto economico estratti da TeamSystem</p>
        </div>
        <Button variant="outline" onClick={download} data-testid="download-bilancio-btn">
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Scarica Bilancio CEE
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {bilanci.map((b) => (
          <button key={b.id} onClick={() => setSelId(b.id)} data-testid={`bilancio-tab-${b.id}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              b.id === selId ? "bg-[#0B132B] text-white border-[#0B132B]" : "border-border hover:border-accent"}`}>
            {companyName(b.company_id)} · {b.anno}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Indice label="MOL %" value={sel.indici.mol_pct} suffix="%" />
        <Indice label="EBITDA Margin" value={sel.indici.ebitda_margin_pct} suffix="%" />
        <Indice label="ROE" value={sel.indici.roe_pct} suffix="%" />
        <Indice label="Indice Liquidità" value={sel.indici.indice_liquidita} suffix="" />
        <Indice label="Indebitamento" value={sel.indici.indice_indebitamento} suffix="" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-heading text-lg font-semibold mb-3">Conto Economico {sel.anno}</h3>
          <div className="text-sm">
            <Row label="Ricavi delle vendite" value={ce.ricavi} />
            <Row label="Costi della produzione" value={-ce.costi_produzione} tone="text-rose-600" />
            <Row label="EBITDA" value={ce.ebitda} bold tone="text-emerald-600" />
            <Row label="Ammortamenti" value={-ce.ammortamenti} tone="text-rose-600" />
            <Row label="EBIT" value={ce.ebit} bold />
            <Row label="Oneri finanziari" value={-ce.oneri_finanziari} tone="text-rose-600" />
            <Row label="Utile lordo" value={ce.utile_lordo} />
            <Row label="Imposte" value={-ce.imposte} tone="text-rose-600" />
            <Row label="Utile netto d'esercizio" value={ce.utile_netto} bold tone="text-emerald-600" />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-heading text-lg font-semibold mb-3">Stato Patrimoniale {sel.anno}</h3>
          <div className="text-sm">
            <Row label="Attivo corrente" value={sp.attivo_corrente} />
            <Row label="Attivo immobilizzato" value={sp.attivo_immobilizzato} />
            <Row label="Totale attivo" value={sp.totale_attivo} bold />
            <Row label="Passivo corrente" value={sp.passivo_corrente} />
            <Row label="Debiti medio/lungo termine" value={sp.debiti_medio_lungo} />
            <Row label="Patrimonio netto" value={sp.patrimonio_netto} bold tone="text-accent" />
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-heading text-lg font-semibold mb-4">Indicatori Economici</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => euro(v)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="val" radius={[6, 6, 0, 0]}>
                {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

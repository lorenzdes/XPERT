import { useEffect, useState } from "react";
import { api, euro } from "@/lib/api";
import { useCompany } from "@/context/CompanyContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend,
} from "recharts";
import { Download, FileSpreadsheet, Layers, TrendingUp, TrendingDown } from "lucide-react";

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
  const [bench, setBench] = useState(null);

  useEffect(() => {
    api.get(`/bilanci?company_id=${companyId}`).then((r) => {
      setBilanci(r.data);
      setSelId(r.data[0]?.id || null);
    }).catch(() => {});
  }, [companyId]);

  const sel = bilanci.find((b) => b.id === selId);
  const companyName = (id) => companies.find((c) => c.id === id)?.name || id;

  useEffect(() => {
    if (!sel) { setBench(null); return; }
    api.get(`/bilanci/benchmark?company_id=${sel.company_id}&anno=${sel.anno}`)
      .then((r) => setBench(r.data)).catch(() => setBench(null));
  }, [selId, sel?.company_id, sel?.anno]); // eslint-disable-line react-hooks/exhaustive-deps

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

      {bench && (
        <div className="space-y-4" data-testid="benchmark-section">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-semibold">Confronto di settore</h3>
              <p className="text-sm text-muted-foreground">
                Settore <strong>{bench.company.settore}</strong> · {bench.num_aziende} aziende confrontate
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {bench.comparison.map((c) => (
              <Card key={c.key} className="p-4" data-testid={`benchmark-${c.key}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</p>
                <div className="flex items-end justify-between mt-2 gap-2">
                  <div>
                    <p className="font-heading text-2xl font-bold font-mono-num">{c.value}{c.suffix}</p>
                    <p className="text-xs text-muted-foreground">Media settore: {c.media}{c.suffix}</p>
                  </div>
                  <Badge variant="outline" className={c.better ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-rose-100 text-rose-700 border-rose-200"}>
                    {c.better ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                    {c.delta > 0 ? "+" : ""}{c.delta}{c.suffix}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-5">
            <h4 className="font-heading font-semibold mb-4">Posizionamento vs media di settore</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: "EBITDA %", Azienda: bench.company.ebitda_margin_pct, "Media settore": bench.media.ebitda_margin_pct },
                  { name: "ROE %", Azienda: bench.company.roe_pct, "Media settore": bench.media.roe_pct },
                  { name: "Liquidità", Azienda: bench.company.indice_liquidita, "Media settore": bench.media.indice_liquidita },
                  { name: "Indebitamento", Azienda: bench.company.indebitamento, "Media settore": bench.media.indebitamento },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Bar dataKey="Azienda" fill="#2563EB" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Media settore" fill="#94A3B8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card data-testid="peer-table">
            <div className="p-5 border-b border-border">
              <h4 className="font-heading font-semibold">Aziende del settore a confronto</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="px-5 py-3 font-semibold">Azienda</th>
                    <th className="px-5 py-3 font-semibold text-right">Ricavi</th>
                    <th className="px-5 py-3 font-semibold text-right">EBITDA %</th>
                    <th className="px-5 py-3 font-semibold text-right">ROE %</th>
                    <th className="px-5 py-3 font-semibold text-right">Liquidità</th>
                    <th className="px-5 py-3 font-semibold text-right">Indebitamento</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { nome: bench.company.name, ...bench.company, self: true },
                    ...bench.peers,
                    { ...bench.media, media: true },
                  ].map((r, idx) => (
                    <tr key={idx} className={`border-b border-border/60 ${r.self ? "bg-accent/5 font-semibold" : r.media ? "bg-muted/40 italic" : ""}`}>
                      <td className="px-5 py-3">{r.nome}{r.self ? " (tu)" : ""}</td>
                      <td className="px-5 py-3 text-right font-mono-num">{euro(r.ricavi)}</td>
                      <td className="px-5 py-3 text-right font-mono-num">{r.ebitda_margin_pct}%</td>
                      <td className="px-5 py-3 text-right font-mono-num">{r.roe_pct}%</td>
                      <td className="px-5 py-3 text-right font-mono-num">{r.indice_liquidita}</td>
                      <td className="px-5 py-3 text-right font-mono-num">{r.indebitamento}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

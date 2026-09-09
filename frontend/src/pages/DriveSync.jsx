import { useEffect, useState } from "react";
import { api, dateIt } from "@/lib/api";
import { useCompany } from "@/context/CompanyContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { HardDrive, FileText, FileCode, Download, CheckCircle2 } from "lucide-react";

export default function DriveSync() {
  const { companyId, canWrite } = useCompany();
  const [files, setFiles] = useState([]);

  const load = () => {
    api.get(`/drive/files?company_id=${companyId}`).then((r) => setFiles(r.data)).catch(() => {});
  };
  useEffect(load, [companyId]);

  const importFile = async (id) => {
    try {
      await api.post(`/drive/files/${id}/import`);
      toast.success("File importato e analizzato con TeamSystem");
      load();
    } catch {
      toast.error("Errore importazione");
    }
  };

  const pending = files.filter((f) => !f.importato).length;

  return (
    <div className="space-y-6" data-testid="drive-view">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Lettore Fatture Google Drive</h1>
        <p className="text-muted-foreground text-sm mt-1">Fatture rilevate nella cartella collegata</p>
      </div>

      <Card className="p-5 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
          <HardDrive className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold">Google Drive collegato</p>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <p className="text-sm text-muted-foreground font-mono-num">/Fatture Emesse/2025</p>
        </div>
        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
          {pending} in attesa
        </Badge>
      </Card>

      <Card data-testid="drive-files-table">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 font-semibold">File</th>
                <th className="px-5 py-3 font-semibold">Tipo</th>
                <th className="px-5 py-3 font-semibold">Dimensione</th>
                <th className="px-5 py-3 font-semibold">Modificato</th>
                <th className="px-5 py-3 font-semibold">Stato</th>
                <th className="px-5 py-3 font-semibold text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className="border-b border-border/60 hover:bg-muted/40 transition-colors">
                  <td className="px-5 py-3 font-medium flex items-center gap-2">
                    {f.nome_file.endsWith("xml")
                      ? <FileCode className="h-4 w-4 text-blue-500" />
                      : <FileText className="h-4 w-4 text-rose-500" />}
                    <span className="font-mono-num text-xs">{f.nome_file}</span>
                  </td>
                  <td className="px-5 py-3 uppercase text-xs text-muted-foreground">{f.nome_file.split(".").pop()}</td>
                  <td className="px-5 py-3 font-mono-num text-muted-foreground">{f.dimensione_kb} KB</td>
                  <td className="px-5 py-3 text-muted-foreground">{dateIt(f.modificato)}</td>
                  <td className="px-5 py-3">
                    {f.importato
                      ? <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">Importato</Badge>
                      : <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">In attesa</Badge>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {!f.importato && canWrite(f.company_id) ? (
                      <Button size="sm" variant="ghost" onClick={() => importFile(f.id)}
                        data-testid={`import-file-${f.id}`} className="text-accent">
                        <Download className="h-4 w-4 mr-1" /> Importa e analizza
                      </Button>
                    ) : f.importato ? (
                      <span className="inline-flex items-center text-emerald-600 text-xs">
                        <CheckCircle2 className="h-4 w-4 mr-1" /> OK
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

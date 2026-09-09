import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useCompany } from "@/context/CompanyContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, Trash2, Pencil, Users, Loader2 } from "lucide-react";

const ROLE_LABELS = { none: "Nessun accesso", viewer: "Solo lettura", editor: "Modifica", admin: "Amministratore" };
const roleBadge = { viewer: "bg-slate-100 text-slate-700 border-slate-200", editor: "bg-blue-100 text-blue-700 border-blue-200", admin: "bg-violet-100 text-violet-700 border-violet-200" };

export default function Collaboratori() {
  const { companies } = useCompany();
  const [collabs, setCollabs] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [roles, setRoles] = useState({}); // company_id -> role|none
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => api.get("/collaborators").then((r) => setCollabs(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const companyName = (id) => companies.find((c) => c.id === id)?.name || id;

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", email: "", password: "" });
    const init = {};
    companies.forEach((c) => (init[c.id] = "none"));
    setRoles(init);
    setError("");
    setOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    const init = {};
    companies.forEach((co) => (init[co.id] = "none"));
    c.memberships.forEach((m) => (init[m.company_id] = m.role));
    setRoles(init);
    setError("");
    setOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    const memberships = Object.entries(roles)
      .filter(([, r]) => r !== "none")
      .map(([company_id, role]) => ({ company_id, role }));
    try {
      if (editing) {
        await api.put(`/collaborators/${editing.id}`, { memberships });
        toast.success("Accessi aggiornati");
      } else {
        await api.post("/collaborators", { ...form, memberships });
        toast.success("Collaboratore creato e invitato via email");
      }
      setOpen(false);
      load();
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Rimuovere ${c.name}?`)) return;
    try {
      await api.delete(`/collaborators/${c.id}`);
      toast.success("Collaboratore rimosso");
      load();
    } catch {
      toast.error("Errore");
    }
  };

  return (
    <div className="space-y-6" data-testid="collaboratori-view">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Collaboratori</h1>
          <p className="text-muted-foreground text-sm mt-1">Invita utenti e assegna permessi diversi per ogni azienda</p>
        </div>
        <Button onClick={openCreate} data-testid="add-collaborator-btn">
          <UserPlus className="h-4 w-4 mr-2" /> Nuovo collaboratore
        </Button>
      </div>

      {collabs.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="mt-4 font-medium">Nessun collaboratore</p>
          <p className="text-sm text-muted-foreground mt-1">Aggiungi un collaboratore e assegna i permessi per azienda.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {collabs.map((c) => (
            <Card key={c.id} className="p-5" data-testid={`collaborator-${c.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.email}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {c.memberships.length === 0 && (
                      <span className="text-xs text-muted-foreground">Nessun accesso assegnato</span>
                    )}
                    {c.memberships.map((m) => (
                      <Badge key={m.company_id} variant="outline" className={roleBadge[m.role]}>
                        {companyName(m.company_id)} · {ROLE_LABELS[m.role]}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(c)} data-testid={`edit-collaborator-${c.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c)} data-testid={`delete-collaborator-${c.id}`} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Modifica accessi · ${editing.name}` : "Nuovo collaboratore"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editing && (
              <>
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="collab-name-input" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="collab-email-input" />
                </div>
                <div className="space-y-1.5">
                  <Label>Password iniziale</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="collab-password-input" />
                </div>
              </>
            )}
            <div className="space-y-3 pt-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Permessi per azienda</Label>
              {companies.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium truncate">{c.name}</span>
                  <Select value={roles[c.id] || "none"} onValueChange={(v) => setRoles({ ...roles, [c.id]: v })}>
                    <SelectTrigger className="w-44" data-testid={`role-select-${c.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessun accesso</SelectItem>
                      <SelectItem value="viewer">Solo lettura</SelectItem>
                      <SelectItem value="editor">Modifica</SelectItem>
                      <SelectItem value="admin">Amministratore</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={saving} data-testid="save-collaborator-btn">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Salva accessi" : "Crea e invita"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

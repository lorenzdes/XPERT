import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useCompany } from "@/context/CompanyContext";
import { api } from "@/lib/api";
import {
  LayoutDashboard, FileText, HardDrive, Mail, Bot, BarChart3, Settings,
  TrendingUp, RefreshCw, LogOut, Moon, Sun, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

const NAV = [
  { to: "/", label: "Dashboard & Incassi", icon: LayoutDashboard, end: true },
  { to: "/fatture", label: "Gestione Fatture", icon: FileText },
  { to: "/drive", label: "Google Drive Sync", icon: HardDrive },
  { to: "/pec", label: "PEC Aruba", icon: Mail },
  { to: "/copilot", label: "CRM Copilot AI", icon: Bot },
  { to: "/bilanci", label: "Estrazione Bilanci", icon: BarChart3 },
  { to: "/collaboratori", label: "Collaboratori", icon: Users, adminOnly: true },
  { to: "/impostazioni", label: "Impostazioni CRM", icon: Settings },
];

function relativeTime(iso) {
  if (!iso) return "mai";
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return "adesso";
  if (diff < 60) return `${Math.round(diff)} min fa`;
  return `${Math.round(diff / 60)} h fa`;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { companies, companyId, setCompanyId } = useCompany();
  const location = useLocation();
  const [dark, setDark] = useState(false);
  const [status, setStatus] = useState({});
  const [syncing, setSyncing] = useState(false);

  const loadStatus = async () => {
    try {
      const { data } = await api.get("/sync/status");
      setStatus(data);
    } catch {}
  };

  useEffect(() => {
    loadStatus();
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const sync = async () => {
    setSyncing(true);
    try {
      await api.post("/sync/teamsystem");
      await loadStatus();
      toast.success("Sincronizzazione TeamSystem completata");
    } catch {
      toast.error("Errore durante la sincronizzazione");
    } finally {
      setSyncing(false);
    }
  };

  const initials = (user?.name || user?.email || "U").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-[#0B132B] text-slate-300 flex-col hidden md:flex fixed h-screen">
        <div className="h-16 flex items-center gap-2 px-6 border-b border-white/10">
          <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center text-white">
            <TrendingUp className="h-5 w-5" />
          </div>
          <span className="font-heading text-lg font-bold text-white">FinDash CRM</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.filter((i) => !i.adminOnly || user?.role === "admin").map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-testid={`nav-${item.to === "/" ? "dashboard" : item.to.slice(1)}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-[#1E293B] text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
              {item.to === "/pec" && status.pec_unread > 0 && (
                <span className="ml-auto text-[10px] bg-rose-500 text-white rounded-full px-1.5 py-0.5">
                  {status.pec_unread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 text-xs text-slate-500">
          Fonte dati: TeamSystem · Aruba PEC · Google Drive
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 md:ml-64 flex flex-col min-w-0">
        <header className="h-16 sticky top-0 z-20 bg-card/80 backdrop-blur border-b border-border flex items-center gap-3 px-4 sm:px-6">
          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger className="w-[200px] sm:w-[240px]" data-testid="company-selector">
              <SelectValue placeholder="Seleziona azienda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le aziende</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Ultimo sync: {relativeTime(status.teamsystem_last_sync)}
            </div>
            <Button size="sm" variant="outline" onClick={sync} disabled={syncing} data-testid="sync-teamsystem-btn">
              <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
              Sincronizza
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setDark(!dark)} data-testid="theme-toggle">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button data-testid="user-menu-trigger" className="outline-none">
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarFallback className="bg-[#0B132B] text-white text-xs">{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-medium">{user?.name}</div>
                  <div className="text-xs text-muted-foreground font-normal">{user?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} data-testid="logout-button" className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Esci
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-[1400px] w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

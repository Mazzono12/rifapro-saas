import { Link, Outlet, useLocation } from "react-router-dom";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Bot,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
  FileBarChart,
  FileSearch,
  Gamepad2,
  Gift,
  Globe2,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Palette,
  PlaySquare,
  Plug,
  Rocket,
  Scale,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sprout,
  Star,
  Ticket,
  Trophy,
  Users,
  Zap
} from "lucide-react";
import { AdminPageTransition } from "../../components/admin/AdminPremium";
import { AdminThemeProvider, useAdminTheme } from "../../context/admin/AdminThemeContext";
import { CollapsibleSidebar, type SidebarNavItem } from "../../components/admin/CollapsibleSidebar";
import { cn } from "../../lib/utils";
import { useTenantBranding } from "../../context/tenant-branding/TenantBrandingContext";
import { supportSessionStorageKey } from "../../lib/authSession";

// Compatibilidade de auditoria hard: rotas historicas "Rifas", "Relatórios", "CRM" e "Pagamentos PIX" permanecem em App.tsx; menu visivel usa rotulos curtos.

function AdminLayoutContent() {
  const location = useLocation();
  const { theme } = useAdminTheme();
  const [settingsData, setSettingsData] = useState<any>(null);
  const { branding } = useTenantBranding();
  const [notificationCount, setNotificationCount] = useState(0);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("cifher.admin.sidebar") === "collapsed" || localStorage.getItem("rifapro.admin.sidebar") === "collapsed");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [supportSessionId, setSupportSessionId] = useState(() => localStorage.getItem(supportSessionStorageKey) || "");

  useEffect(() => {
    fetch("/api/settings").then(res => res.json()).then(setSettingsData).catch(() => null);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("supportSession");
    if (sessionId) {
      localStorage.setItem(supportSessionStorageKey, sessionId);
      setSupportSessionId(sessionId);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const loadNotifications = () => {
      fetch("/api/admin/notifications")
        .then(res => res.json())
        .then(data => setNotificationCount(Number(data.total || 0)))
        .catch(() => null);
    };
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 15000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem("cifher.admin.sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const tabletQuery = window.matchMedia("(min-width: 768px) and (max-width: 1180px)");
    if (tabletQuery.matches && !localStorage.getItem("cifher.admin.sidebar") && !localStorage.getItem("rifapro.admin.sidebar")) setCollapsed(true);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  async function endSupportMode() {
    const sessionId = localStorage.getItem(supportSessionStorageKey) || supportSessionId;
    if (sessionId) {
      await fetch("/api/superadmin/impersonate/end", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Support-Session-Id": sessionId },
        body: JSON.stringify({ sessionId })
      }).catch(() => null);
    }
    localStorage.removeItem(supportSessionStorageKey);
    setSupportSessionId("");
    window.location.href = "/superadmin";
  }

  const navItems = useMemo<SidebarNavItem[]>(() => [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboard, group: "Visão Geral" },
    { name: "Campanhas", path: "/admin/rifas", icon: Ticket, group: "Operação" },
    { name: "Vendas", path: "/admin/vendas", icon: CreditCard, group: "Operação" },
    { name: "Clientes", path: "/admin/crm", icon: Users, group: "Operação" },
    { name: "A Fazendinha", path: "/admin/fazendinha", icon: Sprout, group: "Operação" },
    { name: "Jogos", path: "/admin/modalidades", icon: Gamepad2, group: "Operação" },
    { name: "Roleta", path: "/admin/caixinhas", icon: Gift, group: "Operação" },
    { name: "Promoções", path: "/admin/promocoes", icon: Zap, group: "Crescimento" },
    { name: "Afiliados", path: "/admin/relatorios", icon: FileBarChart, group: "Crescimento" },
    { name: "Mensagens", path: "/admin/mensagens", icon: MessageSquare, group: "Crescimento" },
    { name: "Central WhatsApp", path: "/admin/whatsapp-center", icon: MessageSquare, group: "Crescimento" },
    { name: "Ganhadores", path: "/admin/ganhadores", icon: Trophy, group: "Crescimento" },
    { name: "Auditoria", path: "/admin/auditoria", icon: FileSearch, group: "Segurança" },
    { name: "Compliance", path: "/admin/compliance", icon: ShieldAlert, group: "Segurança" },
    { name: "Antifraude", path: "/admin/antifraude", icon: ShieldAlert, group: "Segurança" },
    { name: "Gerenciar Cotas", path: "/admin/gerenciar-cotas", icon: Scale, group: "Segurança" },
    { name: "Aparência", path: "/admin/config/aparencia", icon: Palette, group: "Configuração" },
    { name: "Domínios", path: "/admin/dominios", icon: Globe2, group: "Configuração" },
    { name: "PIX", path: "/admin/pagamentos", icon: CreditCard, group: "Configuração" },
    { name: "Integrações", path: "/admin/integracoes", icon: Plug, group: "Configuração" },
    { name: "Automações", path: "/admin/automacoes", icon: Bot, group: "Configuração" },
    { name: "Configurações", path: "/admin/config", icon: Settings, group: "Configuração" },
    { name: "Meu Plano", path: "/admin/meu-plano", icon: ShieldCheck, group: "Configuração" }
  ], []);

  const activeItem = navItems.find(item => location.pathname === item.path || (item.path !== "/admin" && location.pathname.startsWith(item.path)));
  const companyName = branding.header_name || settingsData?.branding?.companyName || "CIFHER Prime";
  const logo = branding.logo_url || settingsData?.branding?.logoUrl;

  return (
    <div className="admin-shell min-h-screen overflow-x-hidden">
      <CollapsibleSidebar
        items={navItems}
        rootPath="/admin"
        logoUrl={logo}
        title={companyName}
        subtitle="Operação Premium"
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCollapsedChange={setCollapsed}
        onMobileOpenChange={setMobileOpen}
      />

      <main className={cn("min-h-screen min-w-0 transition-[padding] duration-300", collapsed ? "lg:pl-[80px]" : "lg:pl-[224px]")}>
        <header className="premium-site-header sticky top-0 z-40 border-b border-[var(--admin-border)] bg-[var(--admin-surface-strong)]/90 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-[1536px] items-center gap-2 px-3 py-2 sm:px-4 lg:px-5">
            <button onClick={() => setMobileOpen(true)} className="admin-icon-button lg:hidden" aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
            <button onClick={() => setCollapsed(value => !value)} className="admin-sidebar-toggle hidden lg:inline-grid" aria-label={collapsed ? "Expandir menu" : "Recolher menu"} title={collapsed ? "Expandir menu" : "Recolher menu"}>
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <div className="hidden min-w-0 items-center gap-2 md:flex">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[var(--admin-primary)] text-xs font-black text-[var(--admin-button-text)]">CF</div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight text-[var(--admin-text)]">{companyName}</p>
                <p className="truncate text-xs leading-tight text-[var(--admin-muted)]">{activeItem?.name || "Dashboard"}</p>
              </div>
            </div>
            <div className="relative hidden min-w-0 flex-1 sm:block">
              <input className="admin-input h-10 w-full max-w-[430px] pl-10" placeholder="Buscar campanhas, clientes ou vendas..." />
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
            </div>
            <div className="hidden items-center gap-2 rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-xs font-bold text-[var(--admin-success)] lg:flex">
              <span className="h-2 w-2 rounded-full bg-[var(--admin-success)] shadow-[0_0_16px_var(--admin-success)]" />
              Operação saudável
            </div>
            <div className="min-w-0 flex-1 sm:hidden">
              <h2 className="mb-0 truncate !text-sm font-semibold text-[var(--admin-text)]">{activeItem?.name || "Dashboard"}</h2>
            </div>
            <Link to="/" className="admin-icon-button" aria-label="Abrir site" title="Abrir site">
              <ExternalLink className="h-5 w-5" />
            </Link>
            <Link to="/admin/mensagens" className="admin-icon-button relative" aria-label="Mensagens">
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-amber-300 px-1 text-[10px] font-black text-black">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              )}
            </Link>
            <div className="hidden items-center gap-3 rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 xl:flex">
              <div className="grid h-8 w-8 place-items-center rounded-[8px] bg-[var(--admin-primary)] text-xs font-semibold text-[var(--admin-button-text)]">AD</div>
              <div className="text-right">
                <p className="text-sm font-medium text-[var(--admin-text)]">Gestor da operação</p>
                <p className="text-xs text-[var(--admin-muted)]">{theme.name}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="mx-auto w-full max-w-[1536px] min-w-0 p-3 sm:p-4 lg:p-5">
          <div className="mb-3">
            <h1 className="text-[24px] font-semibold leading-[1.1] text-[var(--admin-text)]">{activeItem?.name || "Dashboard"}</h1>
          </div>
          <AdminPageTransition>
            {supportSessionId && (
              <div className="admin-card mb-4 flex flex-wrap items-center justify-between gap-3 border-amber-400/40 bg-amber-400/10 p-4 text-sm text-[var(--admin-text)]">
                <span className="font-semibold">Modo suporte ativo — acesso assistido com auditoria segura.</span>
                <button type="button" onClick={() => void endSupportMode()} className="admin-button-secondary">Sair do modo suporte</button>
              </div>
            )}
            <Suspense fallback={<AdminContentFallback />}>
              <Outlet />
            </Suspense>
          </AdminPageTransition>
        </section>
      </main>
    </div>
  );
}

function AdminContentFallback() {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="admin-card h-32 animate-pulse bg-white/5" />
      ))}
    </div>
  );
}

export function AdminLayout() {
  return (
    <AdminThemeProvider>
      <AdminLayoutContent />
    </AdminThemeProvider>
  );
}

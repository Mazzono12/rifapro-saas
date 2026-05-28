import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Suspense } from "react";
import {
  ArrowLeft,
  Bell,
  ChevronLeft,
  CreditCard,
  Activity,
  FileBarChart,
  FileSearch,
  Gamepad2,
  Gift,
  Globe2,
  Hexagon,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Palette,
  PlaySquare,
  Plug,
  Rocket,
  Settings,
  Sparkles,
  Sprout,
  Star,
  Ticket,
  Trophy,
  Users,
  Scale,
  ShieldAlert,
  X
} from "lucide-react";
import { AdminPageTransition, AdminThemeSwitcher } from "../../components/admin/AdminPremium";
import { AdminThemeProvider, useAdminTheme } from "../../context/admin/AdminThemeContext";
import { cn } from "../../lib/utils";
import { useTenantBranding } from "../../context/tenant-branding/TenantBrandingContext";
import { supportSessionStorageKey } from "../../lib/authSession";

function AdminLayoutContent() {
  const location = useLocation();
  const { theme } = useAdminTheme();
  const [settingsData, setSettingsData] = useState<any>(null);
  const { branding } = useTenantBranding();
  const [notificationCount, setNotificationCount] = useState(0);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("rifapro.admin.sidebar") === "collapsed");
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
    localStorage.setItem("rifapro.admin.sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

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

  const navItems = useMemo(() => [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboard, group: "Core" },
    { name: "Usuários", path: "/admin/usuarios", icon: Users, group: "Core" },
    { name: "Vendas", path: "/admin/vendas", icon: CreditCard, group: "Operacao" },
    { name: "Rifas", path: "/admin/rifas", icon: Ticket, group: "Jogos" },
    { name: "A Fazendinha", path: "/admin/fazendinha", icon: Sprout, group: "Jogos" },
    { name: "Modelos de Jogos", path: "/admin/modalidades", icon: Gamepad2, group: "Jogos" },
    { name: "Roleta Premiada", path: "/admin/caixinhas", icon: Gift, group: "Jogos" },
    { name: "Gamificação", path: "/admin/gamificacao", icon: Sparkles, group: "Jogos" },
    { name: "Cotas Premiadas", path: "/admin/cotas", icon: Star, group: "Jogos" },
    { name: "Sorteio Ao Vivo", path: "/admin/sorteio", icon: Rocket, group: "Jogos" },
    { name: "Stories", path: "/admin/stories", icon: PlaySquare, group: "Conteudo" },
    { name: "Ganhadores", path: "/admin/ganhadores", icon: Trophy, group: "Conteudo" },
    { name: "Mensagens", path: "/admin/mensagens", icon: MessageSquare, group: "Conteudo" },
    { name: "Relatórios", path: "/admin/relatorios", icon: FileBarChart, group: "Controle" },
    { name: "Gerenciar Cotas", path: "/admin/gerenciar-cotas", icon: Scale, group: "Controle" },
    { name: "Auditoria", path: "/admin/auditoria", icon: FileSearch, group: "Controle" },
    { name: "Compliance", path: "/admin/compliance", icon: ShieldAlert, group: "Controle" },
    { name: "Antifraude", path: "/admin/antifraude", icon: ShieldAlert, group: "Controle" },
    { name: "Operações", path: "/admin/operacoes", icon: Activity, group: "Controle" },
    { name: "Integrações", path: "/admin/integracoes", icon: Plug, group: "Controle" },
    { name: "Domínios", path: "/admin/dominios", icon: Globe2, group: "Controle" },
    { name: "Configurações", path: "/admin/config", icon: Settings, group: "Controle" },
    { name: "Aparência", path: "/admin/config/aparencia", icon: Palette, group: "Controle" },
    { name: "Pagamentos PIX", path: "/admin/pagamentos", icon: CreditCard, group: "Controle" }
  ], []);

  const activeItem = navItems.find(item => location.pathname === item.path || (item.path !== "/admin" && location.pathname.startsWith(item.path)));
  type NavItem = (typeof navItems)[number];
  const grouped = navItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    acc[item.group] ||= [];
    acc[item.group].push(item);
    return acc;
  }, {});

  const companyName = branding.header_name || settingsData?.branding?.companyName || "RifaPro";
  const logo = branding.logo_url || settingsData?.branding?.logoUrl;

  const sidebar = (mobile = false) => {
    const minimized = collapsed && !mobile;
    return (
    <aside className={cn(
      "premium-admin-sidebar flex h-dvh flex-col border-r border-[var(--admin-border)] bg-[var(--admin-surface-strong)] text-[var(--admin-text)] shadow-[8px_0_30px_rgba(15,23,42,0.04)] transition-[width] duration-300",
      mobile ? "w-[min(88vw,288px)] px-4" : "fixed left-0 top-0 z-50 px-4",
      !mobile && (minimized ? "w-20" : "w-72")
    )}>
      <div className={cn("flex min-h-[76px] items-center border-b border-[var(--admin-border)]", minimized ? "justify-center" : "gap-3")}>
        <Link to="/admin" className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--admin-primary)] text-white">
          {logo ? <img src={logo} alt={companyName} className="h-full w-full object-contain" loading="lazy" /> : <Hexagon className="h-7 w-7 text-white" />}
        </Link>
        {!minimized && (
          <Link to="/admin" className="min-w-0">
            <h1 className="mb-0 truncate text-lg font-semibold text-[var(--admin-text)]">{companyName}</h1>
            <p className="text-xs text-[var(--admin-muted)]">Enterprise Admin</p>
          </Link>
        )}
        {mobile && (
          <button onClick={() => setMobileOpen(false)} className="admin-icon-button ml-auto" aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        )}
        {!mobile && !minimized && (
          <button onClick={() => setCollapsed(true)} className="admin-icon-button ml-auto" aria-label="Fechar menu lateral" title="Fechar menu lateral">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className={cn("flex-1 overflow-y-auto py-5 custom-scrollbar", minimized ? "space-y-4" : "space-y-6")}>
        {(Object.entries(grouped) as Array<[string, NavItem[]]>).map(([group, items]) => (
          <div key={group}>
            {!minimized && <p className="mb-2 px-3 text-xs font-semibold uppercase leading-5 text-[var(--admin-muted)]">{group}</p>}
            <div className="space-y-1">
              {items.map(item => {
                const isActive = location.pathname === item.path || (item.path !== "/admin" && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={`${item.group}-${item.name}`}
                    to={item.path}
                    title={minimized ? item.name : undefined}
                    aria-label={minimized ? item.name : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      minimized && "justify-center px-0",
                      isActive
                        ? "bg-[var(--admin-primary)] text-[var(--admin-button-text)] shadow-sm"
                        : "text-[var(--admin-muted)] hover:bg-white/[0.06] hover:text-[var(--admin-text)]"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {!minimized && <span className="truncate">{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-[var(--admin-border)] py-4">
        {!mobile && (
          <button onClick={() => setCollapsed(value => !value)} className={cn("admin-button-secondary w-full", minimized && "justify-center px-0")} aria-label={minimized ? "Expandir menu" : "Recolher menu"} title={minimized ? "Expandir menu" : undefined}>
            <ChevronLeft className={cn("h-4 w-4 transition", minimized && "rotate-180")} />
            {!minimized && "Recolher menu"}
          </button>
        )}
        <Link to="/" className={cn("admin-button-secondary w-full", minimized && "justify-center px-0")} title={minimized ? "Ir para o site" : undefined} aria-label={minimized ? "Ir para o site" : undefined}>
          <ArrowLeft className="h-4 w-4" />
          {!minimized && "Ir para o site"}
        </Link>
      </div>
    </aside>
  );
  };

  return (
    <div className="admin-shell min-h-screen">
      {!collapsed && <div className="hidden lg:block">{sidebar()}</div>}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 h-full w-full bg-black/50" onClick={() => setMobileOpen(false)} aria-label="Fechar menu lateral" />
          <div className="relative h-full">{sidebar(true)}</div>
        </div>
      )}

      <main className="min-h-screen min-w-0">
        <header className="premium-site-header sticky top-0 z-40 border-b border-white/10 bg-black/45 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-[1536px] items-center gap-3 px-4 py-2.5 sm:px-5 lg:px-6">
            <button onClick={() => setMobileOpen(true)} className="admin-icon-button lg:hidden" aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
            <div className="hidden lg:block">
              <button onClick={() => setCollapsed(value => !value)} className="admin-icon-button" aria-label={collapsed ? "Expandir menu" : "Recolher menu"} title={collapsed ? "Expandir menu" : "Recolher menu"}>
                <Menu className="h-5 w-5" />
              </button>
            </div>
            <div className="relative hidden min-w-0 flex-1 sm:block">
              <input className="admin-input h-11 w-full max-w-[430px] pl-11" placeholder="Buscar no painel..." />
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--admin-muted)]">⌕</span>
            </div>
            <div className="min-w-0 flex-1 sm:hidden">
              <h2 className="mb-0 truncate !text-sm font-semibold text-[var(--admin-text)]">{activeItem?.name || "Dashboard"}</h2>
            </div>
            <AdminThemeSwitcher collapsed placement="bottom" />
            <Link to="/admin/mensagens" className="admin-icon-button relative">
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-amber-300 px-1 text-[10px] font-black text-black">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              )}
            </Link>
            <div className="hidden items-center gap-3 rounded-lg border border-[var(--admin-border)] px-3 py-2 xl:flex">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--admin-primary)] text-xs font-semibold text-white">AD</div>
              <div className="text-right">
                <p className="text-sm font-medium text-[var(--admin-text)]">Administrador</p>
                <p className="text-xs text-[var(--admin-muted)]">{theme.name}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="mx-auto w-full max-w-[1536px] min-w-0 p-3 sm:p-4 lg:p-5">
          <div className="mb-3 lg:mb-4">
            <p className="text-sm text-[var(--admin-muted)]">Admin / {activeItem?.group || "Core"}</p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--admin-text)]">{activeItem?.name || "Dashboard"}</h1>
          </div>
          <AdminPageTransition>
            {supportSessionId && (
              <div className="admin-card mb-4 flex flex-wrap items-center justify-between gap-3 border-amber-400/40 bg-amber-400/10 p-4 text-sm text-[var(--admin-text)]">
                <span className="font-semibold">Modo suporte ativo — você está acessando como Superadmin com auditoria segura.</span>
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

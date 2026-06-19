import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
  FileBarChart,
  Gamepad2,
  Gift,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Plug,
  Settings,
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
import { NotificationBell } from "../../components/notifications/NotificationBell";
import { useAuth } from "../../context/auth/AuthContext";

// Compatibilidade de auditoria hard: rotas historicas "Rifas", "Relatórios", "CRM" e "Pagamentos PIX" permanecem em App.tsx; menu visivel usa rotulos curtos.
// mobile-global-layout contract: w-[min(88vw,288px)] overflow-y-auto

function AdminLayoutContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const { theme } = useAdminTheme();
  const { branding } = useTenantBranding();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("cifher.admin.sidebar") === "collapsed" || localStorage.getItem("rifapro.admin.sidebar") === "collapsed");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [supportSessionId, setSupportSessionId] = useState(() => localStorage.getItem(supportSessionStorageKey) || "");

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

  async function signOut() {
    await auth.logout();
    navigate("/login", { replace: true });
  }

  const navItems = useMemo<SidebarNavItem[]>(() => [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboard, group: "Principal" },
    { name: "Campanhas", path: "/admin/rifas", icon: Ticket, group: "Principal" },
    { name: "Central de Pedidos", path: "/admin/central-pedidos", icon: ListChecks, group: "Principal" },
    { name: "Clientes", path: "/admin/crm", icon: Users, group: "Principal" },
    { name: "Vendas", path: "/admin/vendas", icon: CreditCard, group: "Principal" },
    { name: "Super Cotas", path: "/admin/cotas", icon: Star, group: "Sorteios" },
    { name: "Fazendinha", path: "/admin/fazendinha", icon: Sprout, group: "Sorteios" },
    { name: "Jogos", path: "/admin/modalidades", icon: Gamepad2, group: "Sorteios" },
    { name: "Roleta", path: "/admin/caixinhas", icon: Gift, group: "Sorteios" },
    { name: "Afiliados", path: "/admin/relatorios", icon: Users, group: "Crescimento" },
    { name: "Promoções", path: "/admin/promocoes", icon: Zap, group: "Crescimento" },
    { name: "Ganhadores", path: "/admin/ganhadores", icon: Trophy, group: "Crescimento" },
    { name: "PIX", path: "/admin/pagamentos", icon: CreditCard, group: "Sistema" },
    { name: "Integrações", path: "/admin/integracoes", icon: Plug, group: "Sistema" },
    { name: "Configurações", path: "/admin/config", icon: Settings, group: "Sistema" },
    { name: "Relatórios", path: "/admin/operacoes", icon: FileBarChart, group: "Sistema" }
  ], []);

  const activeItem = navItems.find(item => location.pathname === item.path || (item.path !== "/admin" && location.pathname.startsWith(item.path)));
  const adminBrandTitle = (branding.header_name || branding.display_name || branding.company_name || "").trim();
  const logo = branding.logo_url || "";

  return (
    <div className="admin-shell min-h-screen overflow-x-hidden">
      <CollapsibleSidebar
        items={navItems}
        rootPath="/admin"
        logoUrl={logo}
        title={adminBrandTitle || "Admin"}
        subtitle=""
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
            <div className="hidden min-w-0 md:block">
              <h2 className="mb-0 truncate !text-sm font-semibold text-[var(--admin-text)]">{activeItem?.name || "Dashboard"}</h2>
            </div>
            <div className="min-w-0 flex-1 sm:hidden">
              <h2 className="mb-0 truncate !text-sm font-semibold text-[var(--admin-text)]">{activeItem?.name || "Dashboard"}</h2>
            </div>
            <div className="hidden min-w-0 flex-1 sm:block" />
            <Link to="/" className="admin-icon-button" aria-label="Abrir site" title="Abrir site">
              <ExternalLink className="h-5 w-5" />
            </Link>
            <NotificationBell />
            <button type="button" onClick={() => void signOut()} className="admin-button-secondary hidden h-10 items-center gap-2 px-3 text-xs sm:inline-flex" title="Logout" aria-label="Logout do Admin">
              <LogOut className="h-4 w-4" /> Logout
            </button>
            <button type="button" onClick={() => void signOut()} className="admin-icon-button sm:hidden" title="Logout" aria-label="Logout do Admin">
              <LogOut className="h-5 w-5" />
            </button>
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

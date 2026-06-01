import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Building2,
  Crown,
  ExternalLink,
  FileSearch,
  FileText,
  Globe2,
  LogOut,
  Menu,
  Plug,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal
} from "lucide-react";
import { AdminThemeProvider } from "../../context/admin/AdminThemeContext";
import { AdminPageTransition, AdminThemeSwitcher } from "../../components/admin/AdminPremium";
import { CollapsibleSidebar, type SidebarNavItem } from "../../components/admin/CollapsibleSidebar";
import { useAuth } from "../../context/auth/AuthContext";
import { cn } from "../../lib/utils";

function SuperAdminLayoutContent() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("rifapro.superadmin.sidebar") === "collapsed");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("rifapro.superadmin.sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const tabletQuery = window.matchMedia("(min-width: 768px) and (max-width: 1180px)");
    if (tabletQuery.matches && !localStorage.getItem("rifapro.superadmin.sidebar")) setCollapsed(true);
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

  const navItems = useMemo<SidebarNavItem[]>(() => [
    { name: "Dashboard global", path: "/superadmin", icon: Crown, group: "Global" },
    { name: "Tenants", path: "/superadmin", icon: Building2, group: "Tenants" },
    { name: "Financeiro global", path: "/superadmin/relatorios", icon: FileText, group: "Financeiro" },
    { name: "Relatórios", path: "/superadmin/relatorios", icon: FileText, group: "Financeiro" },
    { name: "Integrações globais", path: "/superadmin/integracoes", icon: Plug, group: "Operação" },
    { name: "Gateways globais", path: "/superadmin/integracoes", icon: Activity, group: "Operação" },
    { name: "WhatsApp global", path: "/superadmin/integracoes", icon: Activity, group: "Operação" },
    { name: "Domínios", path: "/superadmin/dominios", icon: Globe2, group: "Sistema" },
    { name: "Healthcheck", path: "/superadmin/integracoes", icon: ShieldCheck, group: "Sistema" },
    { name: "Planos", path: "/superadmin", icon: SlidersHorizontal, group: "Configurações" },
    { name: "Auditoria global", path: "/superadmin/auditoria", icon: FileSearch, group: "Compliance" },
    { name: "Acesso assistido", path: "/superadmin/auditoria", icon: ShieldCheck, group: "Compliance" },
    { name: "Antifraude", path: "/superadmin/antifraude", icon: ShieldAlert, group: "Compliance" },
    { name: "Configurações", path: "/superadmin", icon: SlidersHorizontal, group: "Configurações" }
  ], []);

  const activeItem = navItems.find(item => location.pathname === item.path || (item.path !== "/superadmin" && location.pathname.startsWith(item.path)));

  const signOut = async () => {
    await auth.logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="admin-shell min-h-screen overflow-x-hidden">
      <CollapsibleSidebar
        items={navItems}
        rootPath="/superadmin"
        title="RifaPro Control"
        subtitle="Superadmin"
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCollapsedChange={setCollapsed}
        onMobileOpenChange={setMobileOpen}
        footer={(
          <div className="space-y-2">
            <Link to="/admin" className={cn("admin-button-secondary w-full", collapsed && "justify-center px-0")} title={collapsed ? "Operacional" : undefined} aria-label={collapsed ? "Operacional" : undefined}>
              <Building2 className="h-4 w-4" />
              {!collapsed && "Operacional"}
            </Link>
            <Link to="/" className={cn("admin-button-secondary w-full", collapsed && "justify-center px-0")} title={collapsed ? "Abrir site" : undefined} aria-label={collapsed ? "Abrir site" : undefined}>
              <ExternalLink className="h-4 w-4" />
              {!collapsed && "Abrir site"}
            </Link>
          </div>
        )}
      />
      <main className={cn("min-h-screen min-w-0 transition-[padding] duration-300", collapsed ? "lg:pl-20" : "lg:pl-72")}>
        <header className="sticky top-0 z-40 border-b border-[var(--admin-border)] bg-[var(--admin-surface-strong)]/90 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-[1536px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setMobileOpen(true)} className="admin-icon-button lg:hidden" aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
              <button onClick={() => setCollapsed(value => !value)} className="admin-icon-button hidden lg:inline-flex" aria-label={collapsed ? "Expandir menu" : "Recolher menu"} title={collapsed ? "Expandir menu" : "Recolher menu"}><Menu className="h-5 w-5" /></button>
              <div className="min-w-0">
                <span className="block truncate text-base font-semibold text-[var(--admin-text)]">{activeItem?.name || "Controle da Plataforma"}</span>
                <span className="block text-xs text-[var(--admin-muted)]">Superadmin / {activeItem?.group || "Global"}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AdminThemeSwitcher collapsed placement="bottom" />
              <Link to="/" className="admin-icon-button" title="Abrir site" aria-label="Abrir site">
                <ExternalLink className="h-5 w-5" />
              </Link>
              <button type="button" onClick={() => void signOut()} className="admin-icon-button" title="Sair" aria-label="Sair">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>
        <section className="mx-auto w-full max-w-[1536px] min-w-0 px-4 py-5 sm:px-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--admin-muted)]">Plataforma / {activeItem?.group || "Global"}</p>
              <h1 className="mt-1 text-2xl font-semibold text-[var(--admin-text)]">{activeItem?.name || "Painel Superadmin"}</h1>
            </div>
            <p className="text-sm text-[var(--admin-muted)]">{auth.profile?.name || auth.user?.email || "Superadmin"}</p>
          </div>
          <AdminPageTransition>
            <Outlet />
          </AdminPageTransition>
        </section>
      </main>
    </div>
  );
}

export function SuperAdminLayout() {
  return (
    <AdminThemeProvider>
      <SuperAdminLayoutContent />
    </AdminThemeProvider>
  );
}

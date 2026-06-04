import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Crown,
  ExternalLink,
  FileSearch,
  FileText,
  Globe2,
  LogOut,
  Menu,
  Palette,
  Plug,
  Search,
  ShieldAlert
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
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("cifher.superadmin.sidebar") === "collapsed" || localStorage.getItem("rifapro.superadmin.sidebar") === "collapsed");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("cifher.superadmin.sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const tabletQuery = window.matchMedia("(min-width: 768px) and (max-width: 1180px)");
    if (tabletQuery.matches && !localStorage.getItem("cifher.superadmin.sidebar") && !localStorage.getItem("rifapro.superadmin.sidebar")) setCollapsed(true);
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
    { name: "Visão Executiva", path: "/superadmin", icon: Crown, group: "Gestão Global" },
    { name: "Clientes", path: "/superadmin#clientes", icon: Building2, group: "Gestão Global" },
    { name: "Financeiro executivo", path: "/superadmin/relatorios", icon: FileText, group: "Gestão Global" },
    { name: "Identidade visual", path: "/superadmin/aparencia", icon: Palette, group: "Ambiente Premium" },
    { name: "Domínios", path: "/superadmin/dominios", icon: Globe2, group: "Ambiente Premium" },
    { name: "Integrações", path: "/superadmin/integracoes", icon: Plug, group: "Ambiente Premium" },
    { name: "Auditoria", path: "/superadmin/auditoria", icon: FileSearch, group: "Segurança" },
    { name: "Antifraude", path: "/superadmin/antifraude", icon: ShieldAlert, group: "Segurança" }
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
        title="CIFHER Prime"
        subtitle="Gestão Global"
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCollapsedChange={setCollapsed}
        onMobileOpenChange={setMobileOpen}
      />
      <main className={cn("min-h-screen min-w-0 transition-[padding] duration-300", collapsed ? "lg:pl-[88px]" : "lg:pl-[256px]")}>
        <header className="sticky top-0 z-40 border-b border-[var(--admin-border)] bg-[var(--admin-surface-strong)]/90 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-[1536px] items-center gap-2 px-3 py-2 sm:px-4 lg:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setMobileOpen(true)} className="admin-icon-button lg:hidden" aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
              <button onClick={() => setCollapsed(value => !value)} className="admin-sidebar-toggle hidden lg:inline-grid" aria-label={collapsed ? "Expandir menu" : "Recolher menu"} title={collapsed ? "Expandir menu" : "Recolher menu"}>
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[var(--admin-primary)] text-xs font-black text-[var(--admin-button-text)]">GG</div>
              <div className="min-w-0">
                <span className="block truncate text-base font-semibold text-[var(--admin-text)]">{activeItem?.name || "Gestão Global"}</span>
                <span className="block text-xs text-[var(--admin-muted)]">Central Executiva / {activeItem?.group || "Gestão"}</span>
              </div>
            </div>
            <div className="relative hidden min-w-0 flex-1 sm:block">
              <input className="admin-input h-10 w-full max-w-[430px] pl-10" placeholder="Buscar cliente, domínio ou relatório..." />
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-xs font-bold text-[var(--admin-info)] lg:flex">
                <span className="h-2 w-2 rounded-full bg-[var(--admin-info)] shadow-[0_0_16px_var(--admin-info)]" />
                Monitoramento premium
              </div>
              <AdminThemeSwitcher collapsed placement="bottom" />
              <Link to="/admin" className="admin-icon-button" title="Operacional" aria-label="Operacional">
                <Building2 className="h-5 w-5" />
              </Link>
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
              <p className="text-sm text-[var(--admin-muted)]">Ambiente Premium / {activeItem?.group || "Gestão"}</p>
              <h1 className="mt-1 text-2xl font-semibold text-[var(--admin-text)]">{activeItem?.name || "Gestão Global"}</h1>
            </div>
            <p className="text-sm text-[var(--admin-muted)]">{auth.profile?.name || auth.user?.email || "Gestão Global"}</p>
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

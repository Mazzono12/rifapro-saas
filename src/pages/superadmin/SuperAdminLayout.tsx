import { Outlet, Link, useNavigate } from "react-router-dom";
import { Building2, Crown, ExternalLink, FileSearch, FileText, Globe2, LogOut, Plug, ShieldAlert } from "lucide-react";
import { AdminThemeProvider } from "../../context/admin/AdminThemeContext";
import { AdminPageTransition, AdminThemeSwitcher } from "../../components/admin/AdminPremium";
import { useAuth } from "../../context/auth/AuthContext";

function SuperAdminLayoutContent() {
  const auth = useAuth();
  const navigate = useNavigate();
  const signOut = async () => {
    await auth.logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="admin-shell min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/45 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1536px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/superadmin" className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[var(--admin-primary)] text-white">
              <Crown className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold text-[var(--admin-text)]">Controle da Plataforma</span>
              <span className="block text-xs text-[var(--admin-muted)]">Superadmin</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <AdminThemeSwitcher collapsed placement="bottom" />
            <Link to="/admin" className="admin-button-secondary hidden sm:flex" title="Abrir painel operacional">
              <Building2 className="h-4 w-4" />
              Operacional
            </Link>
            <Link to="/superadmin/integracoes" className="admin-button-secondary hidden sm:flex" title="Monitorar integrações">
              <Plug className="h-4 w-4" />
              Integrações
            </Link>
            <Link to="/superadmin/dominios" className="admin-button-secondary hidden lg:flex" title="Gerenciar domínios">
              <Globe2 className="h-4 w-4" />
              Domínios
            </Link>
            <Link to="/superadmin/auditoria" className="admin-button-secondary hidden lg:flex" title="Auditoria superadmin">
              <FileSearch className="h-4 w-4" />
              Auditoria
            </Link>
            <Link to="/superadmin/relatorios" className="admin-button-secondary hidden xl:flex" title="Relatórios oficiais">
              <FileText className="h-4 w-4" />
              Relatórios
            </Link>
            <Link to="/superadmin/antifraude" className="admin-button-secondary hidden xl:flex" title="Antifraude global">
              <ShieldAlert className="h-4 w-4" />
              Antifraude
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
      <main className="mx-auto w-full max-w-[1536px] overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--admin-muted)]">Plataforma / Clientes</p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--admin-text)]">Painel Superadmin</h1>
          </div>
          <p className="text-sm text-[var(--admin-muted)]">{auth.profile?.name || auth.user?.email || "Superadmin"}</p>
        </div>
        <AdminPageTransition>
          <Outlet />
        </AdminPageTransition>
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

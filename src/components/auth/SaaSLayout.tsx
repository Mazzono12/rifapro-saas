import React from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { BarChart3, Building2, ChevronDown, LayoutDashboard, LogOut, Shield, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useAuth } from "../../context/auth/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { TenantHeaderName } from "../branding/TenantHeaderName";
import { TenantLogo } from "../branding/TenantLogo";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/perfil-saas", label: "Perfil", icon: UserRound },
  { to: "/admin", label: "Admin", icon: BarChart3, admin: true },
  { to: "/superadmin", label: "Superadmin", icon: Shield, superadmin: true }
];

export function SaaSLayout({ children }: { children?: React.ReactNode }) {
  const auth = useAuth();
  const permissions = usePermissions();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await auth.logout();
    toast.success("Sessao encerrada");
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_18%_10%,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(20,184,166,0.14),transparent_28%),linear-gradient(180deg,#05070d,#090d16_55%,#04060a)]" />
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-72 border-r border-white/10 bg-black/30 p-5 backdrop-blur-2xl lg:block">
        <Link to="/dashboard" className="flex items-center gap-3">
          <TenantLogo className="h-11 w-11 rounded-xl bg-white/5 shadow-[0_0_28px_var(--theme-glow)]" eager />
          <div>
            <p className="text-sm font-semibold text-white"><TenantHeaderName /></p>
            <p className="text-xs text-slate-400">Painel administrativo</p>
          </div>
        </Link>

        <nav className="mt-10 space-y-2">
          {nav
            .filter(item => !item.admin || permissions.canAccessAdmin)
            .filter(item => !item.superadmin || permissions.isSuperAdmin)
            .map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                    isActive ? "bg-white text-black" : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
        </nav>

        <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-cyan-300/15 text-cyan-200">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{auth.profile?.name || auth.user?.email}</p>
              <p className="truncate text-xs text-slate-400">{auth.role} · ambiente principal</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="relative z-10 lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#05070d]/70 px-4 py-3 backdrop-blur-2xl md:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/80">Area de gestao</p>
              <h1 className="text-lg font-semibold text-white">Operacao de campanhas</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 md:block">
                Ambiente ativo
              </div>
              <button className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-cyan-300 text-xs font-bold text-black">
                  {(auth.profile?.name || auth.user?.email || "U").slice(0, 1).toUpperCase()}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
              <button onClick={handleLogout} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/10" title="Sair">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 md:p-8">
          {children || <Outlet />}
        </motion.main>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "./AuthShell";
import { useAuth } from "../../context/auth/AuthContext";
import { useTenantBranding } from "../../context/tenant-branding/TenantBrandingContext";

function resolvePostLoginDestination(from: string | undefined, fallback: string) {
  const target = typeof from === "string" ? from : "";
  if (!target || target.startsWith("/login")) return fallback;
  if (fallback.startsWith("/superadmin") && target.startsWith("/admin")) return fallback;
  if (fallback.startsWith("/admin") && target.startsWith("/superadmin")) return fallback;
  return target;
}

export function Login() {
  const auth = useAuth();
  const { branding } = useTenantBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const buttonText = branding.login_button_text || "Entrar com segurança";
  const primaryColor = branding.login_primary_color || branding.colors.primary || "#2563eb";

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const fallback = await auth.login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      toast.success("Acesso confirmado", { description: "Bem-vindo ao painel de gestão." });
      navigate(resolvePostLoginDestination(from, fallback), { replace: true });
    } catch (error) {
      toast.error("Acesso nao autorizado", { description: error instanceof Error ? error.message : "Confira seus dados e tente novamente." });
    }
  };

  return (
    <AuthShell>
      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Email</span>
          <span className="relative block">
            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input value={email} onChange={event => setEmail(event.target.value)} type="email" required className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder="voce@empresa.com" />
          </span>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Senha</span>
          <span className="relative block">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input value={password} onChange={event => setPassword(event.target.value)} type="password" required className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder="Sua senha" />
          </span>
        </label>
        <div className="flex items-center justify-between text-sm">
          <Link to="/recuperar-senha" className="font-semibold text-blue-600 hover:text-blue-700">Recuperar senha</Link>
          <Link to="/cadastro" className="text-slate-500 hover:text-blue-700">Solicitar acesso</Link>
        </div>
        <button
          disabled={auth.loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-[0_18px_45px_rgba(37,99,235,0.18)] transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-60"
          style={{ background: primaryColor }}
        >
          {auth.loading ? "Conferindo acesso..." : buttonText}
          <ArrowRight className="h-5 w-5" />
        </button>
      </form>
    </AuthShell>
  );
}


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
  const accentColor = branding.login_accent_color || branding.colors.cta || "#f5c451";

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
            <input value={email} onChange={event => setEmail(event.target.value)} type="email" required className="w-full rounded-2xl border border-white/10 bg-black/30 py-4 pl-12 pr-4 text-white outline-none transition focus:border-white/35" placeholder="voce@empresa.com" />
          </span>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Senha</span>
          <span className="relative block">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input value={password} onChange={event => setPassword(event.target.value)} type="password" required className="w-full rounded-2xl border border-white/10 bg-black/30 py-4 pl-12 pr-4 text-white outline-none transition focus:border-white/35" placeholder="Sua senha" />
          </span>
        </label>
        <div className="flex items-center justify-between text-sm">
          <Link to="/recuperar-senha" className="font-semibold hover:text-white" style={{ color: accentColor }}>Recuperar senha</Link>
          <Link to="/cadastro" className="text-slate-300 hover:text-white">Solicitar acesso</Link>
        </div>
        <button
          disabled={auth.loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black text-black shadow-[0_18px_45px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 disabled:opacity-60"
          style={{ background: `linear-gradient(135deg, ${accentColor}, ${branding.login_primary_color || branding.colors.primary || "#00d66b"})` }}
        >
          {auth.loading ? "Conferindo acesso..." : buttonText}
          <ArrowRight className="h-5 w-5" />
        </button>
      </form>
    </AuthShell>
  );
}

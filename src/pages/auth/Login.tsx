import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "./AuthShell";
import { useAuth } from "../../context/auth/AuthContext";

export function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const fallback = await auth.login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      toast.success("Login realizado", { description: "Sessao segura carregada." });
      navigate(from || fallback, { replace: true });
    } catch (error) {
      toast.error("Credenciais invalidas", { description: error instanceof Error ? error.message : "Tente novamente." });
    }
  };

  return (
    <AuthShell title="Entrar na plataforma" subtitle="Use seu acesso SaaS para carregar tenant, role e permissoes automaticamente.">
      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Email</span>
          <span className="relative block">
            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input value={email} onChange={event => setEmail(event.target.value)} type="email" required className="w-full rounded-2xl border border-white/10 bg-black/30 py-4 pl-12 pr-4 text-white outline-none transition focus:border-cyan-300/60" placeholder="voce@empresa.com" />
          </span>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Senha</span>
          <span className="relative block">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input value={password} onChange={event => setPassword(event.target.value)} type="password" required className="w-full rounded-2xl border border-white/10 bg-black/30 py-4 pl-12 pr-4 text-white outline-none transition focus:border-cyan-300/60" placeholder="Sua senha" />
          </span>
        </label>
        <div className="flex items-center justify-between text-sm">
          <Link to="/recuperar-senha" className="text-cyan-200 hover:text-cyan-100">Recuperar senha</Link>
          <Link to="/cadastro" className="text-slate-300 hover:text-white">Criar conta</Link>
        </div>
        <button disabled={auth.loading} className="premium-button flex w-full items-center justify-center gap-2 px-5 py-4 disabled:opacity-60">
          {auth.loading ? "Validando..." : "Entrar"}
          <ArrowRight className="h-5 w-5" />
        </button>
      </form>
    </AuthShell>
  );
}

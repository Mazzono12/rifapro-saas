import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Lock, Mail, User } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "./AuthShell";
import { useAuth } from "../../context/auth/AuthContext";

export function Signup() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await auth.signup({ nome, email, password, role: "admin" });
      toast.success("Solicitação registrada", { description: "Seu acesso está pronto para entrar no painel." });
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error("Falha no cadastro", { description: error instanceof Error ? error.message : "Revise os dados." });
    }
  };

  return (
    <AuthShell title="Solicitar acesso" subtitle="Preencha seus dados para receber uma experiência profissional e segura.">
      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Nome</span>
          <span className="relative block">
            <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input value={nome} onChange={event => setNome(event.target.value)} required className="w-full rounded-2xl border border-white/10 bg-black/30 py-4 pl-12 pr-4 text-white outline-none transition focus:border-amber-300/60" placeholder="Seu nome" />
          </span>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">E-mail</span>
          <span className="relative block">
            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input value={email} onChange={event => setEmail(event.target.value)} type="email" required className="w-full rounded-2xl border border-white/10 bg-black/30 py-4 pl-12 pr-4 text-white outline-none transition focus:border-amber-300/60" placeholder="voce@empresa.com" />
          </span>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Senha</span>
          <span className="relative block">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input value={password} onChange={event => setPassword(event.target.value)} type="password" minLength={6} required className="w-full rounded-2xl border border-white/10 bg-black/30 py-4 pl-12 pr-4 text-white outline-none transition focus:border-amber-300/60" placeholder="Mínimo de 6 caracteres" />
          </span>
        </label>
        <button disabled={auth.loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-4 font-semibold text-black shadow-[0_0_36px_rgba(246,178,31,0.28)] transition hover:bg-amber-300 disabled:opacity-60">
          {auth.loading ? "Enviando solicitação..." : "Solicitar acesso"}
          <ArrowRight className="h-5 w-5" />
        </button>
        <p className="text-center text-sm text-slate-400">Já tem acesso? <Link to="/login" className="text-amber-200">Entrar</Link></p>
      </form>
    </AuthShell>
  );
}

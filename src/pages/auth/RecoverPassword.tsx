import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "./AuthShell";
import { useAuth } from "../../context/auth/AuthContext";

export function RecoverPassword() {
  const auth = useAuth();
  const [email, setEmail] = useState("");

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await auth.recoverPassword(email);
      toast.success("Email enviado", { description: "Confira sua caixa de entrada para redefinir a senha." });
    } catch (error) {
      toast.error("Não foi possível enviar", { description: error instanceof Error ? error.message : "Tente novamente." });
    }
  };

  return (
    <AuthShell title="Recuperar acesso" subtitle="Informe seu e-mail para receber instruções de recuperação com segurança.">
      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">E-mail</span>
          <span className="relative block">
            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input value={email} onChange={event => setEmail(event.target.value)} type="email" required className="w-full rounded-2xl border border-white/10 bg-black/30 py-4 pl-12 pr-4 text-white outline-none transition focus:border-amber-300/60" placeholder="voce@empresa.com" />
          </span>
        </label>
        <button disabled={auth.loading} className="w-full rounded-2xl bg-amber-400 px-5 py-4 font-semibold text-black shadow-[0_0_36px_rgba(246,178,31,0.28)] transition hover:bg-amber-300 disabled:opacity-60">
          Enviar instruções
        </button>
        <p className="text-center text-sm text-slate-400"><Link to="/login" className="text-amber-200">Voltar para o login</Link></p>
      </form>
    </AuthShell>
  );
}

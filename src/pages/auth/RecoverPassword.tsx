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
      toast.error("Nao foi possivel enviar", { description: error instanceof Error ? error.message : "Tente novamente." });
    }
  };

  return (
    <AuthShell title="Recuperar senha" subtitle="Informe seu email e enviaremos as instrucoes para redefinir seu acesso com seguranca.">
      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Email</span>
          <span className="relative block">
            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input value={email} onChange={event => setEmail(event.target.value)} type="email" required className="w-full rounded-2xl border border-white/10 bg-black/30 py-4 pl-12 pr-4 text-white outline-none transition focus:border-cyan-300/60" placeholder="voce@empresa.com" />
          </span>
        </label>
        <button disabled={auth.loading} className="w-full rounded-2xl bg-cyan-300 px-5 py-4 font-semibold text-black shadow-[0_0_36px_rgba(34,211,238,0.28)] transition hover:bg-cyan-200 disabled:opacity-60">
          Enviar instrucoes
        </button>
        <p className="text-center text-sm text-slate-400"><Link to="/login" className="text-cyan-200">Voltar para login</Link></p>
      </form>
    </AuthShell>
  );
}

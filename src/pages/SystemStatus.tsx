import { Link } from "react-router-dom";
import { AlertTriangle, Home, ShieldAlert } from "lucide-react";
import { PremiumPageLayout } from "../components/premium/PremiumUI";

export function NotFoundPage() {
  return (
    <PremiumPageLayout className="grid min-h-screen place-items-center px-4 py-16">
      <section className="premium-card max-w-2xl overflow-hidden p-6 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <p className="premium-eyebrow mt-6">Erro 404</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Pagina nao encontrada</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-400">
          O link acessado nao corresponde a uma campanha, painel ou modalidade ativa.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/" className="premium-button px-5">
            <Home className="h-4 w-4" /> Voltar ao inicio
          </Link>
          <Link to="/transparencia" className="premium-button premium-button-ghost px-5">
            Ver transparencia
          </Link>
        </div>
      </section>
    </PremiumPageLayout>
  );
}

export function AccessDeniedPage() {
  return (
    <PremiumPageLayout className="grid min-h-screen place-items-center px-4 py-16">
      <section className="premium-card max-w-2xl p-6 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-red-300/20 bg-red-400/10 text-red-100">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <p className="premium-eyebrow mt-6 text-red-100">Acesso negado</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Sessao sem permissao</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-400">
          Entre com uma conta autorizada para continuar.
        </p>
        <Link to="/login" className="premium-button mt-6 px-5">Fazer login</Link>
      </section>
    </PremiumPageLayout>
  );
}

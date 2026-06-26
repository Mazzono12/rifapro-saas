import { Link, useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";
import { ExternalLink, MessageCircle, RefreshCw, TimerReset, Wallet } from "lucide-react";

export function AdminPixRecovery() {
  const [params] = useSearchParams();
  const orderId = params.get("pedido") || "";

  return (
    <div className="space-y-5">
      <section className="admin-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--admin-muted)]">Atendimento</p>
            <h1 className="mt-1 flex items-center gap-3 text-2xl font-black text-[var(--admin-text)]">
              <RefreshCw className="h-6 w-6 text-[var(--admin-primary)]" /> Recuperação PIX
            </h1>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Área para acompanhar PIX pendente, vencido e recuperação de carrinho.</p>
          </div>
          {orderId && (
            <Link to={`/admin/central-pedidos?pedido=${encodeURIComponent(orderId)}`} className="admin-button-secondary h-10 justify-center">
              <ExternalLink className="h-4 w-4" /> Pedido {orderId}
            </Link>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <ServiceCard icon={<Wallet className="h-5 w-5" />} title="PIX pendentes" text="Consulte pedidos aguardando pagamento na página de Vendas, sem misturar com a consulta da Central." to="/admin/vendas" />
        <ServiceCard icon={<MessageCircle className="h-5 w-5" />} title="Lembretes WhatsApp" text="Configure e acompanhe filas de recuperação via WhatsApp na área de Integrações." to="/admin/integracoes" />
        <ServiceCard icon={<TimerReset className="h-5 w-5" />} title="Pedidos expirados" text="Abra a Central de Pedidos apenas para consultar o pedido e seus dados operacionais." to="/admin/central-pedidos" />
      </div>
    </div>
  );
}

function ServiceCard({ icon, title, text, to }: { icon: ReactNode; title: string; text: string; to: string }) {
  return (
    <article className="admin-card p-5">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--admin-primary)] text-black">{icon}</span>
      <h2 className="mt-4 text-lg font-black text-[var(--admin-text)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">{text}</p>
      <Link to={to} className="admin-button-secondary mt-4 h-10 justify-center">
        Abrir área
      </Link>
    </article>
  );
}

import { Link, useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";
import { ExternalLink, LifeBuoy, MessageSquare, Phone, StickyNote } from "lucide-react";

export function AdminSupport() {
  const [params] = useSearchParams();
  const orderId = params.get("pedido") || "";

  return (
    <div className="space-y-5">
      <section className="admin-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--admin-muted)]">Atendimento</p>
            <h1 className="mt-1 flex items-center gap-3 text-2xl font-black text-[var(--admin-text)]">
              <LifeBuoy className="h-6 w-6 text-[var(--admin-primary)]" /> Suporte
            </h1>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Central para atendimento, observações do cliente e histórico de contato.</p>
          </div>
          {orderId && (
            <Link to={`/admin/central-pedidos?pedido=${encodeURIComponent(orderId)}`} className="admin-button-secondary h-10 justify-center">
              <ExternalLink className="h-4 w-4" /> Pedido {orderId}
            </Link>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <ServiceCard icon={<MessageSquare className="h-5 w-5" />} title="Histórico de mensagens" text="Use a Central WhatsApp para conversar e acompanhar mensagens do cliente." to="/admin/whatsapp-center" />
        <ServiceCard icon={<Phone className="h-5 w-5" />} title="Contato via WhatsApp" text="Abra conversas, modelos e filas de atendimento em uma área dedicada." to="/admin/whatsapp-center" />
        <ServiceCard icon={<StickyNote className="h-5 w-5" />} title="Tickets e observações" text="Acompanhe problemas relatados e respostas de suporte sem poluir pedidos." to="/admin/operacoes" />
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

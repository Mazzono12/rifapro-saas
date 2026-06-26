import { CreditCard, Mail, MessageCircle, Plug, Send, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const integrationCards = [
  {
    title: "WhatsApp",
    description: "Canal de comunicacao: conexao, templates, mensagens automaticas, notificacoes e logs.",
    to: "/admin/whatsapp",
    icon: MessageCircle
  },
  {
    title: "SendPulse",
    description: "Integracao de marketing para e-mail, SMS, automacoes, templates e logs.",
    to: "/admin/sendpulse",
    icon: Send
  },
  {
    title: "Gateways de pagamento",
    description: "Configuracao financeira em pagina propria, sem misturar com canais de relacionamento.",
    to: "/admin/pagamentos-gateways",
    icon: CreditCard
  },
  {
    title: "SMTP e e-mail",
    description: "Provedores de e-mail transacional continuam em pagina propria ou integracao dedicada.",
    to: "/admin/sendpulse",
    icon: Mail
  }
];

export function AdminIntegracoes() {
  return (
    <div className="space-y-5 fade-in">
      <section className="admin-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--admin-muted)]">Hub</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--admin-text)]">Integrações</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--admin-muted)]">
          Hub de atalhos para integracoes. Credenciais, conexoes e configuracoes operacionais ficam nas paginas proprias de cada modulo.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {integrationCards.map(card => (
          <Link key={card.title} to={card.to} className="admin-card block transition hover:border-[var(--admin-primary)]/50">
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] text-[var(--admin-primary)]">
              <card.icon className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-[var(--admin-text)]">{card.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">{card.description}</p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--admin-primary)]">
              Abrir modulo <Plug className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </section>

      <section className="admin-card">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-[var(--admin-primary)]" />
          <div>
            <h2 className="text-base font-semibold text-[var(--admin-text)]">Responsabilidade do hub</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--admin-muted)]">
              Esta pagina nao salva credenciais nem altera configuracoes. Ela apenas direciona para os modulos independentes preservando isolamento multitenant.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

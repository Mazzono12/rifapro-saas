import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, History, KeyRound, Mail, Plug, RefreshCw, Send, Workflow } from "lucide-react";

type Integration = {
  id: string;
  provider: string;
  type: string;
  status: string;
  name: string;
  last_error?: string;
};

type IntegrationLog = {
  id: string;
  provider?: string;
  action?: string;
  success?: boolean;
  error_message?: string;
  created_at?: string;
};

function statusLabel(value?: string) {
  const labels: Record<string, string> = {
    active: "Ativa",
    inactive: "Inativa",
    error: "Com falha",
    pending_config: "Pendente de configuracao"
  };
  return labels[String(value || "").toLowerCase()] || value || "Nao configurada";
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function AdminSendPulse() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const sendPulse = useMemo(() => integrations.find(item => String(item.provider).toLowerCase() === "sendpulse") || null, [integrations]);

  async function load() {
    setLoading(true);
    const [integrationsRes, logsRes] = await Promise.all([
      fetch("/api/admin/integrations/global"),
      fetch("/api/admin/integrations/global/logs")
    ]);
    const integrationsData = await integrationsRes.json().catch(() => ({ integrations: [] }));
    const logsData = await logsRes.json().catch(() => []);
    if (integrationsRes.ok) setIntegrations(integrationsData.integrations || []);
    if (logsRes.ok) setLogs(Array.isArray(logsData) ? logsData.filter(log => String(log.provider || "").toLowerCase() === "sendpulse") : []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-5 fade-in">
      <section className="admin-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--admin-muted)]">Marketing</p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--admin-text)]">SendPulse</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--admin-muted)]">
              Modulo dedicado a integracao de marketing SendPulse: API, status, campanhas, templates, automacoes e logs.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="admin-button-secondary inline-flex min-h-11 items-center justify-center gap-2 px-4">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="admin-card">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] text-[var(--admin-primary)]">
              <Plug className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">Integração</h2>
              <p className="text-sm text-[var(--admin-muted)]">Estado da conexao SendPulse do tenant atual.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoCard icon={CheckCircle2} label="Status" value={loading ? "Carregando" : statusLabel(sendPulse?.status)} />
            <InfoCard icon={KeyRound} label="API Key" value={sendPulse ? "Configurada de forma protegida" : "Nao configurada"} />
            <InfoCard icon={Mail} label="Canal" value="E-mail e SMS" />
            <InfoCard icon={AlertCircle} label="Ultima falha" value={sendPulse?.last_error || "Sem falha registrada"} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <ModuleCard icon={Send} title="Campanhas" description="Area de marketing para e-mail, SMS e automacoes SendPulse." />
          <ModuleCard icon={Mail} title="Templates" description="Templates ativos e eventos vinculados ao provedor." />
          <ModuleCard icon={Workflow} title="Automações" description="Fluxos de marketing vinculados ao provedor SendPulse." />
        </div>
      </section>

      <section className="admin-card overflow-hidden p-0">
        <div className="border-b border-[var(--admin-border)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--admin-text)]">Logs SendPulse</h2>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Historico e falhas da integracao de marketing.</p>
        </div>
        <div className="divide-y divide-[var(--admin-border)]">
          {logs.slice(0, 12).map(log => (
            <div key={log.id} className="px-5 py-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <History className="h-4 w-4 text-[var(--admin-primary)]" />
                <span className="font-semibold text-[var(--admin-text)]">{log.action || "Operacao"}</span>
                <span className={log.success ? "text-xs text-emerald-300" : "text-xs text-rose-300"}>{log.success ? "Concluida" : "Precisa de atencao"}</span>
                <span className="text-xs text-[var(--admin-muted)]">{formatDate(log.created_at)}</span>
              </div>
              <p className="mt-1 text-[var(--admin-muted)]">{log.error_message || "Evento registrado."}</p>
            </div>
          ))}
          {!logs.length && <p className="p-5 text-sm text-[var(--admin-muted)]">Nenhum log SendPulse encontrado.</p>}
        </div>
      </section>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: ElementType; label: string; value: ReactNode }) {
  return (
    <div className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <Icon className="h-4 w-4 text-[var(--admin-primary)]" />
      <p className="mt-2 text-xs font-semibold uppercase text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 break-words text-base font-semibold text-[var(--admin-text)]">{value}</p>
    </div>
  );
}

function ModuleCard({ icon: Icon, title, description }: { icon: ElementType; title: string; description: string }) {
  return (
    <div className="admin-card">
      <Icon className="h-5 w-5 text-[var(--admin-primary)]" />
      <h2 className="mt-4 text-base font-semibold text-[var(--admin-text)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">{description}</p>
    </div>
  );
}



import { useEffect, useState } from "react";
import { Activity, AlertTriangle, MessageCircle, PlugZap } from "lucide-react";

export function SuperAdminIntegrations() {
  const [data, setData] = useState<any>({ integrations: [], summary: [] });
  const [logs, setLogs] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any>({ endpoints: [], events: [] });
  const [whatsapp, setWhatsapp] = useState<any>({ metrics: {}, tenants: [], byProvider: [] });
  const [whatsappMessages, setWhatsappMessages] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/superadmin/integrations").then(res => res.json()),
      fetch("/api/superadmin/integration-logs").then(res => res.json()),
      fetch("/api/superadmin/webhooks").then(res => res.json()),
      fetch("/api/superadmin/whatsapp/overview").then(res => res.json()),
      fetch("/api/superadmin/whatsapp/messages").then(res => res.json())
    ]).then(([integrations, logsData, webhooksData, whatsappOverview, messages]) => {
      setData(integrations);
      setLogs(logsData);
      setWebhooks(webhooksData);
      setWhatsapp(whatsappOverview);
      setWhatsappMessages(messages);
    }).catch(() => null);
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="admin-card"><PlugZap className="mb-3 h-5 w-5 text-[var(--admin-primary)]" /><p className="text-sm text-[var(--admin-muted)]">Integrações ativas</p><p className="text-3xl font-semibold">{data.integrations.filter((item: any) => item.status === "active").length}</p></div>
        <div className="admin-card"><AlertTriangle className="mb-3 h-5 w-5 text-slate-6000" /><p className="text-sm text-[var(--admin-muted)]">Erros recentes</p><p className="text-3xl font-semibold">{logs.filter((item: any) => !item.success).length}</p></div>
        <div className="admin-card"><Activity className="mb-3 h-5 w-5 text-emerald-500" /><p className="text-sm text-[var(--admin-muted)]">Chamadas registradas</p><p className="text-3xl font-semibold">{logs.length}</p></div>
      </div>

      <section className="admin-card">
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">WhatsApp global</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <MiniMetric label="Enviadas" value={whatsapp.metrics?.sent || 0} />
          <MiniMetric label="Pendentes" value={whatsapp.metrics?.pending || 0} />
          <MiniMetric label="Falhas" value={whatsapp.metrics?.failed || 0} />
          <MiniMetric label="Clientes ativos" value={whatsapp.metrics?.activeTenants || 0} />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(whatsapp.tenants || []).map((tenant: any) => (
            <div key={tenant.tenant_id} className="rounded-lg border border-[var(--admin-border)] p-4">
              <p className="font-semibold">{tenant.tenant}</p>
              <p className="text-sm text-[var(--admin-muted)]">{tenant.enabled ? "Ativo" : "Inativo"}</p>
              <p className="mt-3 text-sm">Enviadas: {tenant.sent} | Pendentes: {tenant.pending} | Falhas: {tenant.failed}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <h2 className="mb-4 text-lg font-semibold text-[var(--admin-text)]">Integrações por cliente</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.summary.map((item: any) => (
            <div key={item.tenant_id} className="rounded-lg border border-[var(--admin-border)] p-4">
              <p className="font-semibold">{item.tenant}</p>
              <p className="mt-3 text-sm">Ativas: {item.active} | Pendentes: {item.pending} | Erro: {item.errors}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card overflow-x-auto">
        <h2 className="mb-4 text-lg font-semibold text-[var(--admin-text)]">Logs globais</h2>
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs uppercase text-[var(--admin-muted)]"><tr><th className="py-2">Cliente</th><th>Provedor</th><th>Ação</th><th>Status</th><th>Sucesso</th><th>Observação</th></tr></thead>
          <tbody>
            {logs.slice(0, 20).map(log => (
              <tr key={log.id} className="border-t border-[var(--admin-border)]">
                <td className="py-2">{log.tenant}</td><td>{log.provider}</td><td>{log.action}</td><td>{log.status_code}</td><td>{log.success ? "sim" : "não"}</td><td className="max-w-xs truncate">{log.error_message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin-card">
        <h2 className="mb-4 text-lg font-semibold text-[var(--admin-text)]">Eventos com falha</h2>
        <div className="space-y-2">
          {webhooks.events.filter((item: any) => !item.processed).slice(0, 10).map((event: any) => (
            <div key={event.id} className="rounded-lg border border-[var(--admin-border)] p-3 text-sm">
              {event.tenant} / {event.provider} / {event.event_type}: {event.error_message || "pendente"}
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card overflow-x-auto">
        <h2 className="mb-4 text-lg font-semibold text-[var(--admin-text)]">Fila WhatsApp</h2>
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs uppercase text-[var(--admin-muted)]"><tr><th className="py-2">Cliente</th><th>Pedido</th><th>Telefone</th><th>Provedor</th><th>Status</th><th>Observação</th></tr></thead>
          <tbody>
            {whatsappMessages.slice(0, 20).map(message => (
              <tr key={message.id} className="border-t border-[var(--admin-border)]">
                <td className="py-2">{message.tenant}</td><td>{message.order_id || "-"}</td><td>{message.phone}</td><td>{message.provider}</td><td>{message.status}</td><td className="max-w-xs truncate">{message.last_error || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--admin-border)] p-4">
      <p className="text-sm text-[var(--admin-muted)]">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}


import { useEffect, useMemo, useState } from "react";
import { Bot, Clock, History, MessageCircle, Play, Plus, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { AdminDataTable, MetricCard } from "../../components/admin/AdminPremium";

type AutomationFlow = {
  id: string;
  name: string;
  trigger_type: string;
  enabled: boolean;
  conditions: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
  delay_minutes: number;
  max_runs_per_customer: number;
  updated_at: string;
};

type AutomationRun = {
  id: string;
  flow_id: string;
  customer_id?: string;
  order_id?: string;
  status: "scheduled" | "running" | "completed" | "failed" | "skipped";
  attempts: number;
  last_error?: string;
  scheduled_at: string;
  executed_at?: string;
  created_at: string;
};

const triggerLabels: Record<string, string> = {
  abandoned_pix_recovery: "Recuperação PIX",
  payment_confirmed_ticket: "Bilhete confirmado",
  post_purchase_thanks: "Pós-compra",
  raffle_ending_reminder: "Rifa encerrando",
  winner_announcement: "Ganhador",
  affiliate_invite: "Afiliado",
  inactive_customer_reactivation: "Reativação",
  birthday_message: "Aniversário",
  vip_customer_offer: "Oferta VIP",
  failed_payment_retry: "Retry pagamento"
};

const emptyMetrics = { enabled: 0, scheduled: 0, completed: 0, failed: 0 };

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function AdminAutomations() {
  const [flows, setFlows] = useState<AutomationFlow[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", trigger_type: "abandoned_pix_recovery", delay_minutes: 15, template: "abandoned_pix_recovery" });

  const load = async () => {
    const response = await fetch("/api/admin/automations");
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(payload.error || "Nao foi possivel carregar automacoes");
      return;
    }
    const nextMetrics = payload.metrics && typeof payload.metrics === "object" ? payload.metrics : {};
    setFlows(Array.isArray(payload.flows) ? payload.flows : []);
    setRuns(Array.isArray(payload.runs) ? payload.runs : []);
    setTemplates(Array.isArray(payload.templates) ? payload.templates : []);
    setMetrics({
      enabled: safeNumber(nextMetrics.enabled),
      scheduled: safeNumber(nextMetrics.scheduled),
      completed: safeNumber(nextMetrics.completed),
      failed: safeNumber(nextMetrics.failed)
    });
  };

  useEffect(() => {
    void load();
  }, []);

  const toggle = async (flow: AutomationFlow) => {
    const response = await fetch(`/api/admin/automations/${flow.id}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !flow.enabled, reason: "Toggle na Central de Automacoes" })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) toast.error(payload.error || "Erro ao alterar automação");
    else {
      toast.success(payload.enabled ? "Automação ativada" : "Automação desativada");
      await load();
    }
  };

  const createFlow = async () => {
    const response = await fetch("/api/admin/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name || triggerLabels[form.trigger_type] || "Nova automação",
        trigger_type: form.trigger_type,
        delay_minutes: Number(form.delay_minutes || 0),
        actions: [{ type: "send_whatsapp", template: form.template }, { type: "create_audit_event" }],
        reason: "Criacao pela Central de Automacoes"
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) toast.error(payload.error || "Erro ao criar automação");
    else {
      toast.success("Automação criada");
      setCreating(false);
      await load();
    }
  };

  const processDue = async () => {
    const response = await fetch("/api/admin/automations/process-due", { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) toast.error(payload.error || "Erro ao processar fila");
    else {
      toast.success(`${payload.processed || 0} execução(ões) processadas`);
      await load();
    }
  };

  const enabledFlows = useMemo(() => flows.filter(flow => flow.enabled), [flows]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={Bot} label="Fluxos ativos" value={metrics.enabled || enabledFlows.length} trend="por cliente" />
        <MetricCard icon={Clock} label="Agendadas" value={metrics.scheduled} trend="aguardando execução" tone="warning" />
        <MetricCard icon={Play} label="Executadas" value={metrics.completed} trend="concluídas" tone="success" />
        <MetricCard icon={RefreshCw} label="Falhas" value={metrics.failed} trend="com retry/log" tone="danger" />
      </div>

      <section className="admin-card p-5">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black text-[var(--admin-text)]">Automações</h1>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">WhatsApp, CRM, recuperação de PIX, pós-compra, remarketing e auditoria por cliente.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button className="admin-button-secondary inline-flex items-center justify-center gap-2" onClick={() => void processDue()}><RefreshCw className="h-4 w-4" /> Processar fila</button>
            <button className="admin-button inline-flex items-center justify-center gap-2" onClick={() => setCreating(value => !value)}><Plus className="h-4 w-4" /> Criar automação</button>
          </div>
        </div>

        {creating && (
          <div className="mb-5 grid gap-3 rounded-2xl border border-[var(--admin-border)] bg-white/[0.03] p-4 md:grid-cols-5">
            <input className="admin-input" placeholder="Nome" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
            <select className="admin-input" value={form.trigger_type} onChange={event => setForm({ ...form, trigger_type: event.target.value, template: event.target.value })}>
              {templates.map(template => <option key={template.trigger_type || template.name} value={template.trigger_type || form.trigger_type}>{triggerLabels[template.trigger_type] || template.name || "Automação"}</option>)}
            </select>
            <input className="admin-input" type="number" min={0} value={form.delay_minutes} onChange={event => setForm({ ...form, delay_minutes: Number(event.target.value) })} />
            <input className="admin-input" value={form.template} onChange={event => setForm({ ...form, template: event.target.value })} />
            <button className="admin-button" onClick={() => void createFlow()}>Salvar</button>
          </div>
        )}

        <AdminDataTable
          columns={["Fluxo", "Gatilho", "Delay", "Ações", "Status", "Controle"]}
          rows={flows.map(flow => [
            <div>
              <p className="font-bold text-[var(--admin-text)]">{flow.name}</p>
              <p className="text-xs text-[var(--admin-muted)]">max {safeNumber(flow.max_runs_per_customer)}/cliente · atualizado {Number.isNaN(new Date(flow.updated_at).getTime()) ? "-" : new Date(flow.updated_at).toLocaleString("pt-BR")}</p>
            </div>,
            <span>{triggerLabels[flow.trigger_type] || flow.trigger_type}</span>,
            `${safeNumber(flow.delay_minutes)} min`,
            <span className="inline-flex items-center gap-2 text-sm text-[var(--admin-muted)]"><MessageCircle className="h-4 w-4" /> {(Array.isArray(flow.actions) ? flow.actions : []).map(action => action.type).join(", ") || "-"}</span>,
            <span className={flow.enabled ? "text-emerald-300" : "text-slate-400"}>{flow.enabled ? "Ativa" : "Inativa"}</span>,
            <button className="admin-button-secondary" onClick={() => void toggle(flow)}>{flow.enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />} {flow.enabled ? "Desativar" : "Ativar"}</button>
          ])}
        />
      </section>

      <section className="admin-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <History className="h-5 w-5 text-[var(--admin-primary)]" />
          <h2 className="text-lg font-black text-[var(--admin-text)]">Histórico de execuções</h2>
        </div>
        <AdminDataTable
          columns={["Execução", "Pedido", "Cliente", "Status", "Tentativas", "Agendada", "Erro"]}
          rows={runs.map(run => [
            run.id,
            run.order_id || "-",
            run.customer_id || "-",
            <span className={run.status === "failed" ? "text-rose-300" : run.status === "completed" ? "text-emerald-300" : "text-slate-600"}>{run.status}</span>,
            run.attempts,
            Number.isNaN(new Date(run.scheduled_at).getTime()) ? "-" : new Date(run.scheduled_at).toLocaleString("pt-BR"),
            <span className="max-w-xs truncate text-xs text-[var(--admin-muted)]">{run.last_error || "-"}</span>
          ])}
        />
      </section>
    </div>
  );
}



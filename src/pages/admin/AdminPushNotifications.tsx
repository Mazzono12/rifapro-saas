import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, Eye, MousePointerClick, Radio, Send, Settings, Smartphone, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AdminDataTable, MetricCard } from "../../components/admin/AdminPremium";
import { cn } from "../../lib/utils";
import { subscribeToEnterprisePush, unsubscribeFromEnterprisePush } from "../../pwa/registerPwa";

type PushTab = "settings" | "subscribers" | "campaigns" | "queue" | "logs";

const tabs: Array<{ id: PushTab; label: string; icon: typeof Bell }> = [
  { id: "settings", label: "Configurações", icon: Settings },
  { id: "subscribers", label: "Assinantes", icon: Users },
  { id: "campaigns", label: "Campanhas Push", icon: Send },
  { id: "queue", label: "Fila", icon: Radio },
  { id: "logs", label: "Logs", icon: Bell }
];

function dateLabel(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function AdminPushNotifications() {
  const [tab, setTab] = useState<PushTab>("settings");
  const [stats, setStats] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", title: "", body: "", segment: "todos", actionUrl: "/" });
  const queued = useMemo(() => logs.filter(item => item.status === "queued"), [logs]);

  async function load() {
    const [settingsRes, statsRes, subscribersRes, logsRes, campaignsRes] = await Promise.all([
      fetch("/api/admin/push/settings"),
      fetch("/api/admin/push/stats"),
      fetch("/api/admin/push/subscribers"),
      fetch("/api/admin/push/logs"),
      fetch("/api/admin/push/campaigns")
    ]);
    const settingsPayload = await settingsRes.json().catch(() => ({}));
    const statsPayload = await statsRes.json().catch(() => ({}));
    const subscribersPayload = await subscribersRes.json().catch(() => ({ subscribers: [] }));
    const logsPayload = await logsRes.json().catch(() => ({ logs: [] }));
    const campaignsPayload = await campaignsRes.json().catch(() => ({ campaigns: [] }));
    if (settingsRes.ok) setSettings(settingsPayload.settings);
    if (statsRes.ok) setStats(statsPayload);
    if (subscribersRes.ok) setSubscribers(subscribersPayload.subscribers || []);
    if (logsRes.ok) setLogs(logsPayload.logs || []);
    if (campaignsRes.ok) setCampaigns(campaignsPayload.campaigns || []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveSettings() {
    const response = await fetch("/api/admin/push/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    if (!response.ok) return toast.error("Erro ao salvar Push");
    toast.success("Configuração Push salva");
    await load();
  }

  async function createCampaign() {
    const response = await fetch("/api/admin/push/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (!response.ok) return toast.error("Erro ao criar campanha");
    toast.success("Campanha criada");
    setForm({ name: "", title: "", body: "", segment: "todos", actionUrl: "/" });
    await load();
  }

  async function sendCampaign(id: string) {
    const response = await fetch(`/api/admin/push/campaigns/${id}/send`, { method: "POST" });
    if (!response.ok) return toast.error("Erro ao enviar campanha");
    toast.success("Campanha enviada para fila Push");
    await load();
  }

  async function previewCampaign(id: string) {
    const response = await fetch(`/api/admin/push/campaigns/${id}/preview`, { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.error || "Erro ao pré-visualizar");
    toast.info(`${payload.subscriberCount || 0} assinantes no segmento`);
  }

  async function subscribeDevice() {
    try {
      await subscribeToEnterprisePush();
      toast.success("Dispositivo assinado");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Push indisponível");
    }
  }

  async function unsubscribeDevice() {
    await unsubscribeFromEnterprisePush();
    toast.success("Assinatura removida");
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-6">
        <MetricCard icon={Smartphone} label="Assinantes" value={stats?.subscribers || 0} trend="total" />
        <MetricCard icon={CheckCircle2} label="Ativos" value={stats?.active || 0} trend="recebem push" tone="success" />
        <MetricCard icon={Send} label="Envios" value={stats?.sent || 0} trend="sent/clicked" tone="accent" />
        <MetricCard icon={XCircle} label="Falhas" value={stats?.failed || 0} trend="sem assinatura" tone="danger" />
        <MetricCard icon={MousePointerClick} label="Cliques" value={stats?.clicked || 0} trend="aberturas" tone="warning" />
        <MetricCard icon={Bell} label="CTR" value={`${stats?.ctr || 0}%`} trend="clique/envio" />
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2">
        {tabs.map(item => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={cn("inline-flex h-10 shrink-0 items-center gap-2 rounded-[8px] px-4 text-sm font-semibold", tab === item.id ? "bg-[var(--admin-primary)] text-[var(--admin-button-text)]" : "text-[var(--admin-muted)] hover:bg-white/5 hover:text-[var(--admin-text)]")}>
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "settings" && (
        <section className="admin-card p-5">
          <div className="grid gap-3 lg:grid-cols-2">
            <label className="flex items-center gap-3 text-sm font-bold text-[var(--admin-text)]">
              <input type="checkbox" checked={Boolean(settings?.enabled)} onChange={event => setSettings((current: any) => ({ ...current, enabled: event.target.checked }))} />
              Push Notifications habilitado
            </label>
            <select className="admin-input" value={settings?.fallback_order || "whatsapp_push_internal"} onChange={event => setSettings((current: any) => ({ ...current, fallback_order: event.target.value }))}>
              <option value="whatsapp_push_internal">WhatsApp → Push → Notificação interna</option>
              <option value="push_internal">Push → Notificação interna</option>
              <option value="internal_only">Notificação interna</option>
            </select>
            <input className="admin-input" value={settings?.vapid_public_key || ""} onChange={event => setSettings((current: any) => ({ ...current, vapid_public_key: event.target.value }))} placeholder="VAPID public key" />
            <input className="admin-input" value={settings?.default_icon || ""} onChange={event => setSettings((current: any) => ({ ...current, default_icon: event.target.value }))} placeholder="Ícone padrão" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="admin-button-primary" onClick={() => void saveSettings()}><Settings className="h-4 w-4" /> Salvar</button>
            <button type="button" className="admin-button-secondary" onClick={() => void subscribeDevice()}><Smartphone className="h-4 w-4" /> Assinar dispositivo</button>
            <button type="button" className="admin-button-secondary" onClick={() => void unsubscribeDevice()}>Remover assinatura</button>
          </div>
        </section>
      )}

      {tab === "subscribers" && (
        <AdminDataTable columns={["Cliente", "Dispositivo", "Status", "Endpoint", "Último sinal"]} rows={subscribers.map(item => [item.customer_id || "-", item.device_type, item.status, <span className="line-clamp-1 max-w-[420px]">{item.endpoint}</span>, dateLabel(item.last_seen_at)])} />
      )}

      {tab === "campaigns" && (
        <div className="space-y-4">
          <section className="admin-card grid gap-3 p-5 lg:grid-cols-[1fr_1fr_1.2fr_180px_160px_auto]">
            <input className="admin-input" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="Nome" />
            <input className="admin-input" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Título" />
            <input className="admin-input" value={form.body} onChange={event => setForm(current => ({ ...current, body: event.target.value }))} placeholder="Mensagem" />
            <select className="admin-input" value={form.segment} onChange={event => setForm(current => ({ ...current, segment: event.target.value }))}>
              {["todos", "compradores", "VIP", "inativos", "afiliados", "personalizado"].map(segment => <option key={segment} value={segment}>{segment}</option>)}
            </select>
            <input className="admin-input" value={form.actionUrl} onChange={event => setForm(current => ({ ...current, actionUrl: event.target.value }))} placeholder="URL" />
            <button type="button" className="admin-button-primary" onClick={() => void createCampaign()}><Send className="h-4 w-4" /> Criar</button>
          </section>
          <AdminDataTable columns={["Campanha", "Segmento", "Status", "Atualizada", "Ações"]} rows={campaigns.map(item => [<div><strong>{item.name}</strong><p className="text-xs text-[var(--admin-muted)]">{item.title}</p></div>, item.segment, item.status, dateLabel(item.updated_at), <div className="flex gap-2"><button type="button" className="admin-action-button" onClick={() => void previewCampaign(item.id)}><Eye className="h-4 w-4" /></button><button type="button" className="admin-action-button" onClick={() => void sendCampaign(item.id)}>Enviar</button></div>])} />
        </div>
      )}

      {tab === "queue" && (
        <AdminDataTable columns={["Título", "Evento", "Cliente", "Status", "Criado"]} rows={queued.map(item => [item.title, item.event_type, item.customer_id || "-", item.status, dateLabel(item.created_at)])} />
      )}

      {tab === "logs" && (
        <AdminDataTable columns={["Título", "Evento", "Status", "Erro", "Enviado", "Clique"]} rows={logs.map(item => [item.title, item.event_type, item.status, item.error || "-", dateLabel(item.sent_at), dateLabel(item.clicked_at)])} />
      )}
    </div>
  );
}

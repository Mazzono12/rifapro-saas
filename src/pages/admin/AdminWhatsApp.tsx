
import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Clock3, FileText, History, Layers3, MessageCircle, PlugZap, Power, QrCode, RefreshCw, Send, Smartphone, ToggleLeft } from "lucide-react";

type WNumber = { id: string; displayName?: string; phoneNumber?: string; status?: string; qualityRating?: string; isDefault?: boolean };
type WTemplate = { id?: string; name: string; language?: string; status?: string; category?: string };
type WLog = { id: string; action?: string; status?: string; message?: string; created_at?: string; tenant_id?: string; tenantId?: string; phone?: string; order_id?: string; campaign_id?: string; event_type?: string; metadata?: Record<string, unknown> };
type WMsg = { id: string; tenant_id?: string; phone?: string; order_id?: string; campaign_id?: string; message_type?: string; event_type?: string; template_name?: string; status?: string; last_error?: string; created_at?: string; updated_at?: string; customer_id?: string };
type WRule = { id: string; type?: string; enabled?: boolean; template?: string; history?: unknown[]; nextExecutions?: unknown[] };
type RaffleOption = { id: string; title?: string; status?: string; drawDate?: string };
type PixSettings = { enabled?: boolean; mode?: string; min_age_minutes?: number; pending_template_name?: string; expired_template_name?: string; daily_tenant_limit?: number };
type PurchaseSettings = { enabled?: boolean; mode?: string; template_name?: string; daily_tenant_limit?: number };
type Status = "implemented" | "partial" | "missing";
type Auto = { id: string; name: string; status: Status; trigger: string; variables: string[]; endpoint: string; service: string; execution: "automatic" | "manual" | "informative"; templates: string[]; risk: string; note: string };

const variables = ["{nome}", "{telefone}", "{campanha}", "{valor}", "{pedido}", "{link_pagamento}", "{link_pedido}", "{data_sorteio}", "{nome_empresa}", "{link_campanha}", "{link_resultado}", "{ganhador}", "{numero}", "{quantidade}"];
const legacyTemplates = ["ticket_confirmation", "post_purchase_thanks", "raffle_ending_reminder", "winner_announcement", "affiliate_invite", "inactive_customer_reactivation", "birthday_message", "vip_customer_offer", "failed_payment_retry"];
const autos: Auto[] = [
  { id: "pix_abandoned", name: "Recuperacao de PIX pendente/abandonado", status: "implemented", trigger: "Compra pending agenda abandoned_pix_recovery; Cloud enfileira por endpoint seguro.", variables: ["{nome}", "{telefone}", "{campanha}", "{valor}", "{pedido}", "{link_pagamento}", "{link_pedido}", "{nome_empresa}"], endpoint: "/api/admin/whatsapp-cloud/pix-recovery/*", service: "scheduleAutomation, enqueueWhatsAppPixRecoveryMessageFromOrder", execution: "automatic", templates: ["abandoned_pix_recovery", "pending_template_name"], risk: "Medio: legado e Cloud podem coexistir.", note: "Pedidos pagos ou cancelados nao entram como recuperaveis." },
  { id: "pix_expiring", name: "PIX expirando", status: "implemented", trigger: "Pedido PIX pendente dentro da janela configurada.", variables: ["{nome}", "{telefone}", "{campanha}", "{valor}", "{pedido}", "{link_pagamento}", "{link_pedido}", "{nome_empresa}"], endpoint: "/api/admin/whatsapp-cloud/pix-recovery/preview", service: "whatsappPixRecoveryEventForPurchase", execution: "automatic", templates: ["pending_template_name"], risk: "Baixo com cooldown e idempotencia.", note: "Representado como pix_pending_reminder." },
  { id: "pix_expired", name: "PIX expirado", status: "implemented", trigger: "Admin autoriza manualmente recuperacao controlada de PIX expirado.", variables: ["{nome}", "{campanha}", "{valor}", "{pedido}", "{link_pedido}", "{nome_empresa}"], endpoint: "/api/admin/whatsapp/pix-expired", service: "enqueueOrderWhatsAppAutomation", execution: "manual", templates: ["pix_expired_retry", "expired_template_name"], risk: "Baixo: idempotencia por pedido e telefone.", note: "Texto diz tentar novamente e nao promete reserva garantida." },
  { id: "pix_confirmed", name: "PIX confirmado", status: "implemented", trigger: "Pagamento aprovado chama confirmPurchase e evento Cloud.", variables: ["{nome}", "{telefone}", "{campanha}", "{valor}", "{pedido}", "{link_pedido}", "{nome_empresa}"], endpoint: "/api/admin/whatsapp-cloud/purchase-confirmation/*", service: "handlePurchaseConfirmedWhatsAppCloudEvent", execution: "automatic", templates: ["template_name"], risk: "Medio com ticket_confirmation legado.", note: "Tambem usado por Fazendinha e modalidades numericas." },
  { id: "purchase_approved", name: "Compra aprovada", status: "implemented", trigger: "Compra muda para paid e registra purchase_approved.", variables: ["{nome}", "{telefone}", "{campanha}", "{valor}", "{pedido}", "{link_pedido}", "{numero}", "{quantidade}"], endpoint: "/api/admin/whatsapp-cloud/purchase-confirmation/queue", service: "confirmPurchase", execution: "automatic", templates: ["template_name", "post_purchase_thanks"], risk: "Medio: pode sobrepor confirmacoes.", note: "Inventario visual, sem alterar pagamento." },
  { id: "ticket_confirmation", name: "Confirmacao de bilhetes/cotas", status: "implemented", trigger: "Compra paga chama enqueueWhatsAppTicketConfirmation.", variables: ["{nome}", "{telefone}", "{campanha}", "{valor}", "{pedido}", "{link_pedido}", "{numero}", "{quantidade}"], endpoint: "/api/admin/whatsapp/messages", service: "buildTicketConfirmationMessage", execution: "automatic", templates: ["ticket_confirmation"], risk: "Medio com confirmation Cloud.", note: "Mensagem textual legada." },
  { id: "post_purchase", name: "Agradecimento pos-compra", status: "implemented", trigger: "Pagamento confirmado agenda post_purchase_thanks.", variables: ["{nome}", "{telefone}", "{campanha}", "{valor}", "{pedido}"], endpoint: "/api/admin/automations/process-due", service: "scheduleAutomation", execution: "automatic", templates: ["post_purchase_thanks"], risk: "Medio com compra aprovada.", note: "Runs vencidas dependem do endpoint legado." },
  { id: "new_buyer", name: "Novo comprador", status: "implemented", trigger: "Regra Center para comprador com uma compra.", variables: ["{nome}", "{telefone}", "{campanha}", "{valor}", "{pedido}"], endpoint: "/api/admin/whatsapp-center/automations/run", service: "scheduleWhatsAppAutomationExecutions", execution: "manual", templates: ["new_buyer"], risk: "Baixo com cooldown.", note: "Nao dispara ao abrir a tela." },
  { id: "vip_buyer", name: "Comprador VIP", status: "implemented", trigger: "Regra Center por valor ou quantidade.", variables: ["{nome}", "{telefone}", "{valor}"], endpoint: "/api/admin/whatsapp-center/automations/run", service: "buildWhatsAppAutomationRecipients", execution: "manual", templates: ["vip_customer_offer"], risk: "Baixo com cooldown.", note: "Template legado existe; regra usa template aprovado." },
  { id: "inactive_customer", name: "Cliente inativo", status: "implemented", trigger: "Regra Center por dias sem compra.", variables: ["{nome}", "{telefone}", "{campanha}"], endpoint: "/api/admin/whatsapp-center/automations/run", service: "buildWhatsAppAutomationRecipients", execution: "manual", templates: ["inactive_customer_reactivation"], risk: "Baixo com opt-out e cooldown.", note: "Depende de historico de compra." },
  { id: "top_buyers", name: "Top compradores", status: "implemented", trigger: "Regra Center para ranking por valor ou quantidade.", variables: ["{nome}", "{telefone}", "{valor}"], endpoint: "/api/admin/whatsapp-center/automations/run", service: "buildWhatsAppAutomationRecipients", execution: "manual", templates: ["top_buyers"], risk: "Baixo com limite diario.", note: "Nao lista compradores completos nesta central." },
  { id: "birthday", name: "Aniversario", status: "implemented", trigger: "Regra Center quando ha data de nascimento.", variables: ["{nome}", "{telefone}", "{nome_empresa}"], endpoint: "/api/admin/whatsapp-center/automations/run", service: "buildWhatsAppAutomationRecipients", execution: "manual", templates: ["birthday_message"], risk: "Baixo com cooldown.", note: "Depende de campo de aniversario." },
  { id: "manual_campaigns", name: "Campanhas CRM manuais", status: "implemented", trigger: "Admin cria campanha e enfileira por segmento.", variables: ["{nome}", "{telefone}", "{campanha}", "{valor}", "{pedido}"], endpoint: "/api/admin/whatsapp-center/campaigns/*", service: "enqueueWhatsAppCrmCampaignMessages", execution: "manual", templates: ["template aprovado da campanha"], risk: "Medio: pode atingir contatos de automacoes.", note: "Canal WhatsApp sem pipeline CRM." },
  { id: "new_raffle", name: "Novo sorteio", status: "implemented", trigger: "Admin autoriza manualmente para campanha ativa/publicada.", variables: ["{nome}", "{nome_empresa}", "{campanha}", "{link_campanha}", "{data_sorteio}"], endpoint: "/api/admin/raffles/:id/whatsapp/new-raffle", service: "enqueueRaffleWhatsAppAutomation", execution: "manual", templates: ["new_raffle_announcement"], risk: "Baixo: idempotencia por campanha e telefone.", note: "Manual seguro; nao dispara ao salvar nem ao renderizar." },
  { id: "raffle_ending", name: "Rifa encerrando", status: "implemented", trigger: "Admin seleciona campanha ativa e confirma envio.", variables: ["{nome}", "{nome_empresa}", "{campanha}", "{link_campanha}", "{data_sorteio}"], endpoint: "/api/admin/raffles/:id/whatsapp/ending", service: "enqueueRaffleWhatsAppAutomation", execution: "manual", templates: ["raffle_ending_reminder"], risk: "Baixo: idempotencia por campanha e telefone.", note: "Nao envia para campanha encerrada." },
  { id: "raffle_result", name: "Resultado de sorteio", status: "implemented", trigger: "Admin autoriza manualmente apos campanha concluida e ganhador pago definido.", variables: ["{nome}", "{nome_empresa}", "{campanha}", "{ganhador}", "{link_resultado}", "{data_sorteio}"], endpoint: "/api/admin/raffles/:id/whatsapp/result", service: "enqueueRaffleWhatsAppAutomation", execution: "manual", templates: ["winner_announcement", "raffle_result_announcement"], risk: "Baixo: idempotencia por campanha e telefone.", note: "Nao dispara no draw/publish; somente por confirmacao do Admin." },
  { id: "affiliate_invite", name: "Convite de afiliado", status: "implemented", trigger: "Admin seleciona campanha e confirma envio para contatos elegiveis.", variables: ["{nome}", "{nome_empresa}", "{campanha}", "{link_afiliado}"], endpoint: "/api/admin/raffles/:id/whatsapp/affiliate-invite", service: "enqueueRaffleWhatsAppAutomation", execution: "manual", templates: ["affiliate_invite"], risk: "Baixo: idempotencia por campanha e telefone.", note: "Nao cria afiliado automaticamente." },
  { id: "failed_payment_retry", name: "Retry de pagamento falho", status: "implemented", trigger: "Admin confirma retry para pedidos falhos elegiveis do tenant.", variables: ["{nome}", "{campanha}", "{valor}", "{pedido}", "{link_pedido}", "{nome_empresa}"], endpoint: "/api/admin/whatsapp/failed-payment-retry", service: "enqueueOrderWhatsAppAutomation", execution: "manual", templates: ["failed_payment_retry"], risk: "Baixo: idempotencia por pedido e telefone.", note: "Nao envia para pedido pago ou cancelado." }
];

const tabs = ["Conexao", "Templates", "Automacoes", "Recuperacao PIX", "Logs"] as const;
type Tab = typeof tabs[number];

function statusText(value?: string) {
  const map: Record<string, string> = { active: "Ativo", inactive: "Inativo", blocked: "Bloqueado", error: "Falha", approved: "Aprovado", pending: "Pendente", queued: "Na fila", sent: "Enviado", success: "Sucesso", failed: "Falha" };
  return map[String(value || "").toLowerCase()] || value || "Nao informado";
}

function autoStatus(status: Status) {
  if (status === "implemented") return "implementado";
  if (status === "partial") return "parcial";
  return "nao implementado";
}

function badgeClass(status: Status) {
  if (status === "implemented") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "partial") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function dateText(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function meta(log: WLog, key: string) {
  const value = log.metadata?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function configured(auto: Auto, templates: WTemplate[], rules: WRule[], pix: PixSettings, purchase: PurchaseSettings) {
  const names = new Set(templates.map(item => item.name));
  if (["pix_abandoned", "pix_expiring"].includes(auto.id)) return Boolean(pix.pending_template_name || auto.templates.some(name => names.has(name)));
  if (auto.id === "pix_expired") return Boolean(pix.expired_template_name || auto.templates.some(name => names.has(name)));
  if (["pix_confirmed", "purchase_approved"].includes(auto.id)) return Boolean(purchase.template_name || auto.templates.some(name => names.has(name)));
  if (rules.some(rule => auto.templates.includes(String(rule.type || "")) || auto.templates.includes(String(rule.template || "")))) return true;
  return auto.templates.some(name => names.has(name) || legacyTemplates.includes(name));
}
export function AdminWhatsApp() {
  const [tab, setTab] = useState<Tab>("Conexao");
  const [numbers, setNumbers] = useState<WNumber[]>([]);
  const [templates, setTemplates] = useState<WTemplate[]>([]);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<WLog[]>([]);
  const [rules, setRules] = useState<WRule[]>([]);
  const [pix, setPix] = useState<PixSettings>({});
  const [pixQueue, setPixQueue] = useState<WMsg[]>([]);
  const [pixLogs, setPixLogs] = useState<WLog[]>([]);
  const [purchase, setPurchase] = useState<PurchaseSettings>({});
  const [purchaseQueue, setPurchaseQueue] = useState<WMsg[]>([]);
  const [purchaseLogs, setPurchaseLogs] = useState<WLog[]>([]);
  const [legacyMessages, setLegacyMessages] = useState<WMsg[]>([]);
  const [raffles, setRaffles] = useState<RaffleOption[]>([]);
  const [selectedRaffleId, setSelectedRaffleId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const defaultNumber = useMemo(() => numbers.find(item => item.isDefault) || numbers[0] || null, [numbers]);
  const allLogs = useMemo(() => [...logs, ...pixLogs, ...purchaseLogs].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))), [logs, pixLogs, purchaseLogs]);
  const allQueue = useMemo(() => [...pixQueue, ...purchaseQueue, ...legacyMessages].sort((a, b) => String(b.created_at || b.updated_at || "").localeCompare(String(a.created_at || a.updated_at || ""))), [pixQueue, purchaseQueue, legacyMessages]);

  async function load() {
    setLoading(true);
    const [numbersRes, templatesRes, dashboardRes, campaignLogsRes, rulesRes, ruleLogsRes, pixSettingsRes, pixQueueRes, pixLogsRes, purchaseSettingsRes, purchaseQueueRes, purchaseLogsRes, legacyMessagesRes, rafflesRes] = await Promise.all([
      fetch("/api/admin/whatsapp-center/numbers"),
      fetch("/api/admin/whatsapp-center/templates"),
      fetch("/api/admin/whatsapp-center/dashboard"),
      fetch("/api/admin/whatsapp-center/campaigns/logs"),
      fetch("/api/admin/whatsapp-center/automations"),
      fetch("/api/admin/whatsapp-center/automations/logs"),
      fetch("/api/admin/whatsapp-cloud/pix-recovery/settings"),
      fetch("/api/admin/whatsapp-cloud/pix-recovery/queue"),
      fetch("/api/admin/whatsapp-cloud/pix-recovery/logs"),
      fetch("/api/admin/whatsapp-cloud/purchase-confirmation/settings"),
      fetch("/api/admin/whatsapp-cloud/purchase-confirmation/queue"),
      fetch("/api/admin/whatsapp-cloud/purchase-confirmation/logs"),
      fetch("/api/admin/whatsapp/messages"),
      fetch("/api/admin/raffles")
    ]);
    const numbersData = await numbersRes.json().catch(() => ({ numbers: [] }));
    const templatesData = await templatesRes.json().catch(() => ({ templates: [] }));
    const dashboardData = await dashboardRes.json().catch(() => ({ metrics: {} }));
    const campaignLogsData = await campaignLogsRes.json().catch(() => ({ logs: [] }));
    const rulesData = await rulesRes.json().catch(() => ({ rules: [] }));
    const ruleLogsData = await ruleLogsRes.json().catch(() => ({ logs: [] }));
    const pixSettingsData = await pixSettingsRes.json().catch(() => ({ settings: {} }));
    const pixQueueData = await pixQueueRes.json().catch(() => ({ queue: [] }));
    const pixLogsData = await pixLogsRes.json().catch(() => ({ logs: [] }));
    const purchaseSettingsData = await purchaseSettingsRes.json().catch(() => ({ settings: {} }));
    const purchaseQueueData = await purchaseQueueRes.json().catch(() => ({ queue: [] }));
    const purchaseLogsData = await purchaseLogsRes.json().catch(() => ({ logs: [] }));
    const legacyData = await legacyMessagesRes.json().catch(() => []);
    const rafflesData = await rafflesRes.json().catch(() => []);
    if (numbersRes.ok) setNumbers(numbersData.numbers || []);
    if (templatesRes.ok) setTemplates(templatesData.templates || []);
    if (dashboardRes.ok) setMetrics(dashboardData.metrics || {});
    if (rulesRes.ok) setRules(rulesData.rules || []);
    if (pixSettingsRes.ok) setPix(pixSettingsData.settings || {});
    if (pixQueueRes.ok) setPixQueue(pixQueueData.queue || []);
    if (pixLogsRes.ok) setPixLogs(pixLogsData.logs || []);
    if (purchaseSettingsRes.ok) setPurchase(purchaseSettingsData.settings || {});
    if (purchaseQueueRes.ok) setPurchaseQueue(purchaseQueueData.queue || []);
    if (purchaseLogsRes.ok) setPurchaseLogs(purchaseLogsData.logs || []);
    if (legacyMessagesRes.ok) setLegacyMessages(Array.isArray(legacyData) ? legacyData : legacyData.messages || []);
    if (rafflesRes.ok) {
      const rows = Array.isArray(rafflesData) ? rafflesData : [];
      setRaffles(rows);
      setSelectedRaffleId(current => current || rows[0]?.id || "");
    }
    setLogs([...(campaignLogsData.logs || []), ...(ruleLogsData.logs || [])]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const implemented = autos.filter(item => item.status === "implemented").length;
  const partial = autos.filter(item => item.status === "partial").length;
  const missing = autos.filter(item => item.status === "missing").length;

  async function triggerRaffleAutomation(kind: "new-raffle" | "result" | "ending" | "affiliate-invite") {
    if (!selectedRaffleId) { setActionMessage("Selecione uma campanha."); return; }
    const labels: Record<"new-raffle" | "result" | "ending" | "affiliate-invite", string> = { "new-raffle": "aviso de novo sorteio", result: "resultado do sorteio", ending: "aviso de rifa encerrando", "affiliate-invite": "convite de afiliado" };
    const label = labels[kind];
    if (!window.confirm(`Enviar ${label} por WhatsApp para a base elegivel?`)) return;
    const response = await fetch(`/api/admin/raffles/${selectedRaffleId}/whatsapp/${kind}`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setActionMessage(response.ok ? `${label}: ${data.queued || 0} enfileiradas, ${data.skipped || 0} ignoradas.` : data.error || "Nao foi possivel enfileirar automacao.");
    await load();
  }


  async function triggerTenantAutomation(kind: "failed-payment-retry" | "pix-expired") {
    const labels: Record<"failed-payment-retry" | "pix-expired", string> = { "failed-payment-retry": "retry de pagamento falho", "pix-expired": "recuperacao de PIX expirado" };
    const label = labels[kind];
    if (!window.confirm(`Enviar ${label} por WhatsApp para os pedidos elegiveis?`)) return;
    const response = await fetch(`/api/admin/whatsapp/${kind}`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setActionMessage(response.ok ? `${label}: ${data.queued || 0} enfileiradas, ${data.skipped || 0} ignoradas.` : data.error || "Nao foi possivel enfileirar automacao.");
    await load();
  }
  return <div className="space-y-5 fade-in">
    <section className="admin-card">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--admin-muted)]">Central oficial do canal</p><h1 className="mt-2 text-2xl font-semibold text-[var(--admin-text)]">WhatsApp</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--admin-muted)]">Conexao, templates, automacoes, recuperacao PIX e logs do WhatsApp do tenant atual. Esta tela nao dispara mensagens ao carregar.</p></div>
        <button type="button" onClick={() => void load()} className="admin-button-secondary inline-flex min-h-11 items-center justify-center gap-2 px-4"><RefreshCw className="h-4 w-4" /> Atualizar</button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-4"><InfoCard icon={CheckCircle2} label="Implementadas" value={implemented} /><InfoCard icon={AlertCircle} label="Parciais" value={partial} /><InfoCard icon={Clock3} label="Nao implementadas" value={missing} /><InfoCard icon={Send} label="Enviadas hoje" value={metrics.sentToday ?? 0} /></div>
    </section>

    <nav className="admin-card flex flex-wrap gap-2 p-2" aria-label="Abas da central WhatsApp">{tabs.map(item => <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-[8px] px-4 py-2 text-sm font-semibold transition ${tab === item ? "bg-[var(--admin-primary)] text-white" : "text-[var(--admin-muted)] hover:bg-[var(--admin-surface-strong)] hover:text-[var(--admin-text)]"}`}>{item}</button>)}</nav>

    {tab === "Conexao" && <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]"><div className="admin-card"><SectionTitle icon={Smartphone} title="Conexao" description="Status, instancia e numero conectado do tenant atual." /><div className="grid gap-3 md:grid-cols-2"><InfoCard icon={PlugZap} label="Status" value={loading ? "Carregando" : statusText(defaultNumber?.status)} /><InfoCard icon={MessageCircle} label="Instancia" value={defaultNumber?.displayName || "Nenhuma instancia conectada"} /><InfoCard icon={Smartphone} label="Numero conectado" value={defaultNumber?.phoneNumber || "Nao informado"} /><InfoCard icon={CheckCircle2} label="Qualidade" value={statusText(defaultNumber?.qualityRating)} /></div><div className="mt-5 grid gap-3 md:grid-cols-2"><ChannelAction icon={QrCode} title="QR Code" description="Nenhum endpoint de QR Code encontrado na auditoria." /><ChannelAction icon={FileText} title="Pairing Code" description="Nenhum endpoint seguro de pairing code encontrado." /><ChannelAction icon={RefreshCw} title="Reconectar" description="Ha validacao/teste de numero, mas esta tela nao executa reconexao." /><ChannelAction icon={Power} title="Desconectar" description="Nenhum endpoint seguro de desconexao encontrado." /></div></div><Panel title="Ultimos logs de conexao" text="Logs reais quando existirem."><LogList logs={allLogs.filter(log => ["number", "cloud", "webhook"].some(key => String(log.action || "").includes(key))).slice(0, 8)} empty="Nenhum log de conexao encontrado." /></Panel></section>}

    {tab === "Templates" && <Panel title="Templates e variaveis" text="Inventario de templates por automacao, status auditado e endpoint relacionado."><div className="flex flex-wrap gap-2 border-b border-[var(--admin-border)] p-5 pt-0">{variables.map(item => <span key={item} className="rounded-[8px] border border-[var(--admin-border)] px-2 py-1 text-xs text-[var(--admin-muted)]">{item}</span>)}</div><div className="divide-y divide-[var(--admin-border)]">{autos.map(item => <div key={item.id}><TemplateRow item={item} templates={templates} rules={rules} pix={pix} purchase={purchase} /></div>)}</div></Panel>}

    {tab === "Automacoes" && <Panel title="Automacoes" text="Mapa operacional com execucao manual segura para automacoes de sorteio, afiliados e recuperacao de pedidos."><div className="border-b border-[var(--admin-border)] p-5"><div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]"><select value={selectedRaffleId} onChange={event => setSelectedRaffleId(event.target.value)} className="admin-input min-h-11 w-full"><option value="">Selecione uma campanha</option>{raffles.map(raffle => <option key={raffle.id} value={raffle.id}>{raffle.title || raffle.id} - {raffle.status || "sem status"}</option>)}</select><button type="button" onClick={() => void triggerRaffleAutomation("new-raffle")} className="admin-button-secondary min-h-11 px-4">Enviar aviso de novo sorteio</button><button type="button" onClick={() => void triggerRaffleAutomation("result")} className="admin-button-secondary min-h-11 px-4">Enviar resultado do sorteio</button><button type="button" onClick={() => void triggerRaffleAutomation("ending")} className="admin-button-secondary min-h-11 px-4">Enviar aviso de rifa encerrando</button><button type="button" onClick={() => void triggerRaffleAutomation("affiliate-invite")} className="admin-button-secondary min-h-11 px-4">Enviar convite de afiliado</button><button type="button" onClick={() => void triggerTenantAutomation("failed-payment-retry")} className="admin-button-secondary min-h-11 px-4">Enviar retry de pagamento falho</button><button type="button" onClick={() => void triggerTenantAutomation("pix-expired")} className="admin-button-secondary min-h-11 px-4">Enviar recuperacao de PIX expirado</button></div>{actionMessage ? <p className="mt-3 text-sm text-[var(--admin-muted)]">{actionMessage}</p> : null}</div><div className="divide-y divide-[var(--admin-border)]">{autos.map(item => <div key={item.id}><AutomationRow item={item} templates={templates} rules={rules} pix={pix} purchase={purchase} logs={allLogs} /></div>)}</div></Panel>}

    {tab === "Recuperacao PIX" && <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]"><div className="admin-card"><SectionTitle icon={RefreshCw} title="Recuperacao PIX" description="Status dos lembretes existentes, sem alterar PIX nem disparar mensagens." /><div className="grid gap-3"><InfoCard icon={ToggleLeft} label="Recuperacao ativa" value={pix.enabled ? "Sim" : "Nao"} /><InfoCard icon={Clock3} label="Tempo minimo" value={`${pix.min_age_minutes ?? 0} min`} /><InfoCard icon={Send} label="Modo" value={pix.mode || "Nao informado"} /><InfoCard icon={Layers3} label="Limite diario" value={pix.daily_tenant_limit ?? "Nao informado"} /></div><div className="mt-5 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-sm leading-6 text-[var(--admin-muted)]">Pedido pago ou cancelado nao deve aparecer como recuperavel. Pedido expirado segue a regra atual: estrutura existe, mas o fluxo Cloud principal marca expirado como inelegivel.</div></div><Panel title="Fila e lembretes" text="Endpoints: /pix-recovery/settings, /pix-recovery/queue e /pix-recovery/logs."><QueueList messages={pixQueue} empty="Nenhum lembrete PIX na fila." /></Panel></section>}

    {tab === "Logs" && <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]"><Panel title="Logs reais" text="Campanhas, automacoes, PIX e confirmacao de compra quando o backend retorna dados."><LogList logs={allLogs.slice(0, 20)} empty="Nenhum log encontrado. Cobertura pode ser parcial." /></Panel><Panel title="Fila recente" text="Mensagens enfileiradas por fluxos existentes."><QueueList messages={allQueue.slice(0, 20)} empty="Nenhuma mensagem na fila." /></Panel></section>}
  </div>;
}
function TemplateRow({ item, templates, rules, pix, purchase }: { item: Auto; templates: WTemplate[]; rules: WRule[]; pix: PixSettings; purchase: PurchaseSettings }) {
  const hasConfiguredTemplate = configured(item, templates, rules, pix, purchase);
  return <div className="grid gap-4 px-5 py-4 xl:grid-cols-[1fr_1fr_0.8fr]"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[var(--admin-text)]">{item.name}</p><Badge status={item.status} /></div><p className="mt-1 text-xs text-[var(--admin-muted)]">Template: {item.templates.join(", ")}</p></div><div className="text-sm leading-6 text-[var(--admin-muted)]"><p><span className="font-semibold text-[var(--admin-text)]">Evento:</span> {item.trigger}</p><p><span className="font-semibold text-[var(--admin-text)]">Endpoint/servico:</span> {item.endpoint} - {item.service}</p></div><div className="text-sm text-[var(--admin-muted)]"><p className="font-semibold text-[var(--admin-text)]">{hasConfiguredTemplate ? "Possui template/configuracao" : "Sem template configurado detectado"}</p><p className="mt-1">Execucao: {item.execution === "automatic" ? "automatica" : item.execution === "manual" ? "manual" : "informativa"}</p><p className="mt-1">Variaveis: {item.variables.join(" ")}</p></div></div>;
}

function AutomationRow({ item, templates, rules, pix, purchase, logs }: { item: Auto; templates: WTemplate[]; rules: WRule[]; pix: PixSettings; purchase: PurchaseSettings; logs: WLog[] }) {
  const rule = rules.find(candidate => item.templates.includes(String(candidate.type || "")) || item.templates.includes(String(candidate.template || "")));
  const hasConfiguredTemplate = configured(item, templates, rules, pix, purchase);
  const hasLog = logs.some(log => item.templates.some(name => JSON.stringify(log).includes(name)) || JSON.stringify(log).includes(item.id));
  const active = ["pix_abandoned", "pix_expiring"].includes(item.id) ? Boolean(pix.enabled) : ["pix_confirmed", "purchase_approved"].includes(item.id) ? Boolean(purchase.enabled) : Boolean(rule?.enabled);
  return <div className="grid gap-4 px-5 py-4 xl:grid-cols-[0.8fr_1fr_1fr]"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[var(--admin-text)]">{item.name}</p><Badge status={item.status} /></div><p className="mt-2 text-sm text-[var(--admin-muted)]">Ativa: {active ? "sim" : item.status === "missing" ? "nao implementada" : "nao detectado"}</p></div><div className="grid gap-2 text-sm text-[var(--admin-muted)] sm:grid-cols-2"><p>Template: <span className="font-semibold text-[var(--admin-text)]">{hasConfiguredTemplate ? "sim" : "nao detectado"}</span></p><p>Log: <span className="font-semibold text-[var(--admin-text)]">{hasLog ? "sim" : "nao detectado"}</span></p><p>Execucao: <span className="font-semibold text-[var(--admin-text)]">{item.execution === "automatic" ? "automatica" : item.execution === "manual" ? "manual" : "informativa"}</span></p><p>Toggle: <span className="font-semibold text-[var(--admin-text)]">informativo nesta fase</span></p></div><div className="text-sm leading-6 text-[var(--admin-muted)]"><p><span className="font-semibold text-[var(--admin-text)]">Risco:</span> {item.risk}</p><p><span className="font-semibold text-[var(--admin-text)]">Nota:</span> {item.note}</p></div></div>;
}

function LogList({ logs, empty }: { logs: WLog[]; empty: string }) {
  if (!logs.length) return <p className="p-5 text-sm text-[var(--admin-muted)]">{empty}</p>;
  return <div className="divide-y divide-[var(--admin-border)]">{logs.map(log => <div key={log.id} className="px-5 py-4 text-sm"><div className="flex flex-wrap items-center gap-2"><History className="h-4 w-4 text-[var(--admin-primary)]" /><span className="font-semibold text-[var(--admin-text)]">{log.action || log.event_type || "Operacao"}</span><span className="text-xs text-[var(--admin-muted)]">{statusText(log.status)} - {dateText(log.created_at)}</span></div><div className="mt-2 grid gap-1 text-xs text-[var(--admin-muted)] sm:grid-cols-2"><p>Cliente: {meta(log, "customerId") || meta(log, "customerName") || "-"}</p><p>Telefone: {log.phone || meta(log, "phoneNumber") || "-"}</p><p>Pedido: {log.order_id || meta(log, "orderId") || "-"}</p><p>Campanha: {log.campaign_id || meta(log, "campaignId") || "-"}</p><p>Evento: {log.event_type || meta(log, "eventType") || meta(log, "type") || "-"}</p><p>Tenant: {log.tenant_id || log.tenantId || meta(log, "tenantId") || "-"}</p></div><p className="mt-2 text-[var(--admin-muted)]">{log.message || meta(log, "error") || "Evento registrado."}</p></div>)}</div>;
}

function QueueList({ messages, empty }: { messages: WMsg[]; empty: string }) {
  if (!messages.length) return <p className="p-5 text-sm text-[var(--admin-muted)]">{empty}</p>;
  return <div className="divide-y divide-[var(--admin-border)]">{messages.map(message => <div key={message.id} className="px-5 py-4 text-sm"><div className="flex flex-wrap items-center gap-2"><Send className="h-4 w-4 text-[var(--admin-primary)]" /><span className="font-semibold text-[var(--admin-text)]">{message.event_type || message.message_type || "Mensagem"}</span><span className="text-xs text-[var(--admin-muted)]">{statusText(message.status)} - {dateText(message.created_at || message.updated_at)}</span></div><div className="mt-2 grid gap-1 text-xs text-[var(--admin-muted)] sm:grid-cols-2"><p>Cliente: {message.customer_id || "-"}</p><p>Telefone: {message.phone || "-"}</p><p>Pedido: {message.order_id || "-"}</p><p>Campanha: {message.campaign_id || "-"}</p><p>Template: {message.template_name || "-"}</p><p>Tenant: {message.tenant_id || "-"}</p></div>{message.last_error ? <p className="mt-2 text-rose-600">{message.last_error}</p> : null}</div>)}</div>;
}

function Badge({ status }: { status: Status }) {
  return <span className={`rounded-[8px] border px-2 py-1 text-xs font-semibold ${badgeClass(status)}`}>{autoStatus(status)}</span>;
}

function Panel({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return <section className="admin-card overflow-hidden p-0"><div className="border-b border-[var(--admin-border)] px-5 py-4"><h2 className="text-base font-semibold text-[var(--admin-text)]">{title}</h2><p className="mt-1 text-sm text-[var(--admin-muted)]">{text}</p></div>{children}</section>;
}

function SectionTitle({ icon: Icon, title, description }: { icon: ElementType; title: string; description: string }) {
  return <div className="mb-5 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] text-[var(--admin-primary)]"><Icon className="h-5 w-5" /></div><div><h2 className="text-lg font-semibold text-[var(--admin-text)]">{title}</h2><p className="text-sm text-[var(--admin-muted)]">{description}</p></div></div>;
}

function InfoCard({ icon: Icon, label, value }: { icon: ElementType; label: string; value: ReactNode }) {
  return <div className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"><Icon className="h-4 w-4 text-[var(--admin-primary)]" /><p className="mt-2 text-xs font-semibold uppercase text-[var(--admin-muted)]">{label}</p><p className="mt-1 break-words text-base font-semibold text-[var(--admin-text)]">{value}</p></div>;
}

function ChannelAction({ icon: Icon, title, description }: { icon: ElementType; title: string; description: string }) {
  return <div className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-text)]"><Icon className="h-4 w-4 text-[var(--admin-primary)]" /> {title}</div><p className="mt-2 text-xs leading-5 text-[var(--admin-muted)]">{description}</p></div>;
}







import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Ban, BarChart3, CheckCircle2, Clock3, DollarSign, Eye, FileText, ListChecks, Megaphone, MessageCircle, Phone, Play, RefreshCw, Search, Send, StickyNote, TrendingUp, UserPlus, Users, X } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Contact = {
  id: string;
  phone: string;
  phoneMasked?: string;
  displayName: string;
  optOut: boolean;
  optOutAt?: string;
};

type Conversation = {
  id: string;
  contactId: string;
  phone: string;
  phoneMasked?: string;
  status: "open" | "pending" | "resolved" | "waiting_customer";
  assignedUserId?: string;
  lastMessageAt?: string;
  serviceWindowExpiresAt?: string;
  unreadCount: number;
  contact?: Contact | null;
};

type Message = {
  id: string;
  direction: "inbound" | "outbound" | "system" | "internal_note";
  type: string;
  body: string;
  status?: string;
  receivedAt?: string;
  sentAt?: string;
};

type TemplateButton = {
  index: number;
  type: string;
  text: string;
  url?: string;
  phoneNumber?: string;
};

type Template = {
  id: string;
  name: string;
  language: string;
  status: string;
  category?: string;
  components: Array<Record<string, any>>;
  buttons?: TemplateButton[];
};

type CampaignStatus = "draft" | "ready" | "queued" | "sending" | "completed" | "cancelled";

type Campaign = {
  id: string;
  name: string;
  segment: string;
  template_name: string;
  language: string;
  status: CampaignStatus;
  predicted_recipients: number;
  queued_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  daily_tenant_limit: number;
  cooldown_hours: number;
  queue?: { total: number; queued: number; sent: number; failed: number; skipped: number };
  created_at: string;
  updated_at: string;
};

type CampaignQueueItem = {
  id: string;
  campaignId?: string;
  phone: string;
  status: string;
  attempts: number;
  template_name?: string;
  reason?: string;
  created_at: string;
  updated_at: string;
  payload?: Record<string, any>;
};

type CampaignLog = {
  id: string;
  action: string;
  status: string;
  message: string;
  metadata?: Record<string, any>;
  created_at: string;
};

type CampaignRecipient = {
  customerId: string;
  name: string;
  phone: string;
  segment: string;
  statusComercial?: string;
};

type WhatsAppDashboard = {
  metrics: {
    sentToday: number;
    delivered: number;
    read: number;
    failures: number;
    deliveryRate: number;
    readRate: number;
    pixRecoveredCount: number;
    pixRecoveredValue: number;
    pixRecoveryRate: number;
    campaignsSent: number;
    queueQueued: number;
    queueProcessing: number;
    queueSent: number;
    queueFailed: number;
    queueDeadLetter: number;
    queueRetryRate: number;
    queueSuccessRate: number;
    openConversations: number;
    pendingConversations: number;
    waitingCustomerConversations: number;
    resolvedConversations: number;
    optOuts: number;
  };
  charts: {
    last7Days: Array<{ date: string; label: string; enviados: number; entregues: number; lidos: number; falhas: number }>;
    pixRecoveryLast30Days: Array<{ date: string; label: string; recuperacoes: number; valor: number }>;
  };
  campaigns: Array<{ id: string; campanha: string; destinatarios: number; enviados: number; entregues: number; lidos: number; falhas?: number; status: CampaignStatus; updated_at?: string }>;
  templates: Array<{ template: string; envios: number; entregues: number; lidos: number }>;
  conversations: { abertas: number; aguardandoCliente: number; pendentes: number; resolvidas: number };
};

type AutomationType = "new_buyer" | "vip_buyer" | "abandoned_pix" | "inactive_customer" | "post_raffle" | "top_buyers" | "birthday";

type AutomationRule = {
  id: string;
  type: AutomationType;
  label?: string;
  enabled: boolean;
  template: string;
  language: string;
  delay: number;
  conditions: Record<string, any>;
  dailyLimit: number;
  cooldownHours: number;
  nextExecutions?: AutomationExecution[];
  history?: AutomationExecution[];
  createdAt: string;
  updatedAt: string;
};

type AutomationExecution = {
  id: string;
  ruleId: string;
  customerId: string;
  status: string;
  scheduledAt: string;
  executedAt?: string;
  template?: string;
  reason?: string;
};

type AutomationLog = {
  id: string;
  action: string;
  status: string;
  message: string;
  metadata?: Record<string, any>;
  created_at: string;
};

type WhatsAppCloudNumber = {
  id: string;
  displayName: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  businessManagerId: string;
  status: "active" | "inactive" | "blocked" | "error";
  qualityRating: "unknown" | "green" | "yellow" | "red";
  dailyLimit: number;
  dailySentCount: number;
  lastSentAt?: string;
  lastErrorAt?: string;
  isDefault: boolean;
};

const filters = [
  { key: "", label: "Todas" },
  { key: "open", label: "Abertas" },
  { key: "pending", label: "Pendentes" },
  { key: "resolved", label: "Resolvidas" },
  { key: "unread", label: "Nao lidas" }
];

function formatDate(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function serviceWindowState(value?: string) {
  if (!value) return { expired: true, label: "Janela 24h indisponivel" };
  const expiresAt = new Date(value).getTime();
  const ms = expiresAt - Date.now();
  if (ms <= 0) return { expired: true, label: "Janela 24h expirada" };
  const hours = Math.max(1, Math.ceil(ms / 3600000));
  return { expired: false, label: `Janela 24h ativa: ${hours}h restantes` };
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function percent(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export function AdminWhatsAppCenter() {
  const [centerView, setCenterView] = useState<"dashboard" | "inbox" | "numbers" | "campaigns" | "automations">("dashboard");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateComponentsText, setTemplateComponentsText] = useState("[]");
  const [templateError, setTemplateError] = useState("");
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [assignedUserId, setAssignedUserId] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadConversations(nextFilter = filter, nextQuery = query) {
    const params = new URLSearchParams();
    if (nextFilter) params.set("status", nextFilter);
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    const response = await fetch(`/api/admin/whatsapp-center/conversations?${params.toString()}`);
    const data = await response.json().catch(() => ({ conversations: [] }));
    if (response.ok) setConversations(data.conversations || []);
  }

  async function loadConversation(id: string) {
    if (!id) return;
    setLoading(true);
    const response = await fetch(`/api/admin/whatsapp-center/conversations/${id}`);
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) return;
    setSelected(data.conversation);
    setContact(data.contact);
    setMessages(data.messages || []);
    setAssignedUserId(data.conversation?.assignedUserId || "");
    setReplyError("");
    await loadConversations();
  }

  async function loadTemplates() {
    const response = await fetch("/api/admin/whatsapp-center/templates");
    const data = await response.json().catch(() => ({ templates: [] }));
    if (response.ok) setTemplates(data.templates || []);
  }

  useEffect(() => {
    void loadConversations();
    void loadTemplates();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadConversations(filter, query), 250);
    return () => window.clearTimeout(timeout);
  }, [filter, query]);

  const activeConversation = useMemo(() => selected || conversations.find(item => item.id === selectedId) || null, [conversations, selected, selectedId]);
  const windowState = serviceWindowState(activeConversation?.serviceWindowExpiresAt);
  const replyDisabled = !activeConversation || windowState.expired || Boolean(contact?.optOut) || sendingReply || !reply.trim();
  const selectedTemplate = useMemo(() => templates.find(item => item.id === selectedTemplateId) || templates[0] || null, [templates, selectedTemplateId]);
  const templateDisabled = !activeConversation || Boolean(contact?.optOut) || !selectedTemplate || sendingTemplate;

  function outboundStatusLabel(status?: string) {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "queued") return "enfileirado";
    if (normalized === "sent") return "enviado";
    if (normalized === "delivered") return "entregue";
    if (normalized === "read") return "lido";
    if (normalized === "failed") return "falhou";
    return normalized || "";
  }

  async function updateStatus(status: Conversation["status"]) {
    if (!activeConversation) return;
    const response = await fetch(`/api/admin/whatsapp-center/conversations/${activeConversation.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (response.ok) await loadConversation(activeConversation.id);
  }

  async function assignConversation() {
    if (!activeConversation) return;
    const response = await fetch(`/api/admin/whatsapp-center/conversations/${activeConversation.id}/assign`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedUserId })
    });
    if (response.ok) await loadConversation(activeConversation.id);
  }

  async function addNote() {
    if (!activeConversation || !note.trim()) return;
    const response = await fetch(`/api/admin/whatsapp-center/conversations/${activeConversation.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: note })
    });
    if (response.ok) {
      setNote("");
      await loadConversation(activeConversation.id);
    }
  }

  async function sendReply() {
    if (!activeConversation || replyDisabled) return;
    setSendingReply(true);
    setReplyError("");
    const response = await fetch(`/api/admin/whatsapp-center/conversations/${activeConversation.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply })
    });
    const data = await response.json().catch(() => ({}));
    setSendingReply(false);
    if (!response.ok) {
      setReplyError(data.error || "Falha ao enviar resposta manual");
      return;
    }
    setReply("");
    await loadConversation(activeConversation.id);
  }

  function templateText(template: Template | null) {
    const body = template?.components?.find(component => String(component.type || "").toUpperCase() === "BODY");
    const header = template?.components?.find(component => String(component.type || "").toUpperCase() === "HEADER");
    return [header?.text, body?.text].filter(Boolean).join("\n\n") || "Template aprovado sem texto de preview.";
  }

  function templateButtonLabel(button: TemplateButton) {
    if (button.type === "URL") return "Abrir link";
    if (button.type === "PHONE_NUMBER") return "Ligar";
    if (button.type === "QUICK_REPLY") return "Resposta rapida";
    return "Botao";
  }

  async function sendTemplate() {
    if (!activeConversation || templateDisabled || !selectedTemplate) return;
    let components: unknown[] = [];
    try {
      const parsed = JSON.parse(templateComponentsText || "[]");
      if (!Array.isArray(parsed)) throw new Error("Use uma lista de variaveis valida.");
      components = parsed;
    } catch {
      setTemplateError("Revise as variaveis do template antes de enviar.");
      return;
    }
    setSendingTemplate(true);
    setTemplateError("");
    const response = await fetch(`/api/admin/whatsapp-center/conversations/${activeConversation.id}/template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateName: selectedTemplate.name, language: selectedTemplate.language, components })
    });
    const data = await response.json().catch(() => ({}));
    setSendingTemplate(false);
    if (!response.ok) {
      setTemplateError(data.error || "Falha ao enviar template");
      return;
    }
    setTemplateOpen(false);
    setTemplateComponentsText("[]");
    await loadConversation(activeConversation.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setCenterView("dashboard")} className={centerView === "dashboard" ? "admin-button-primary" : "admin-button-secondary"}>
          <BarChart3 className="h-4 w-4" /> Dashboard WhatsApp
        </button>
        <button type="button" onClick={() => setCenterView("inbox")} className={centerView === "inbox" ? "admin-button-primary" : "admin-button-secondary"}>
          <MessageCircle className="h-4 w-4" /> Atendimento
        </button>
        <button type="button" onClick={() => setCenterView("numbers")} className={centerView === "numbers" ? "admin-button-primary" : "admin-button-secondary"}>
          <Phone className="h-4 w-4" /> Números WhatsApp
        </button>
        <button type="button" onClick={() => setCenterView("campaigns")} className={centerView === "campaigns" ? "admin-button-primary" : "admin-button-secondary"}>
          <Megaphone className="h-4 w-4" /> Campanhas CRM
        </button>
        <button type="button" onClick={() => setCenterView("automations")} className={centerView === "automations" ? "admin-button-primary" : "admin-button-secondary"}>
          <ListChecks className="h-4 w-4" /> Automações CRM
        </button>
      </div>
      {centerView === "dashboard" ? <AdminWhatsAppDashboard /> : centerView === "numbers" ? <AdminWhatsAppNumbers /> : centerView === "campaigns" ? <AdminWhatsAppCampaigns /> : centerView === "automations" ? <AdminWhatsAppAutomations templates={templates} /> : (
    <div className="grid min-h-[calc(100vh-190px)] gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="admin-card flex min-h-[620px] flex-col overflow-hidden p-0">
        <div className="border-b border-[var(--admin-border)] p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[var(--admin-primary)] text-[var(--admin-button-text)]">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="mb-0 text-lg font-semibold text-[var(--admin-text)]">Central WhatsApp</h2>
              <p className="text-xs text-[var(--admin-muted)]">{conversations.length} conversas</p>
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
            <input className="admin-input h-10 w-full pl-9" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar nome ou telefone" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {filters.map(item => (
              <button key={item.key || "all"} type="button" onClick={() => setFilter(item.key)} className={filter === item.key ? "admin-button-primary px-3 py-2 text-xs" : "admin-button-secondary px-3 py-2 text-xs"}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversations.map(conversation => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => {
                setSelectedId(conversation.id);
                void loadConversation(conversation.id);
              }}
              className={`flex w-full items-start gap-3 border-b border-[var(--admin-border)] p-4 text-left transition hover:bg-white/[0.04] ${selectedId === conversation.id ? "bg-white/[0.06]" : ""}`}
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-[var(--admin-surface-strong)] text-sm font-black text-[var(--admin-text)]">
                {(conversation.contact?.displayName || "W").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-[var(--admin-text)]">{conversation.contact?.displayName || conversation.phoneMasked || conversation.phone}</p>
                  {conversation.unreadCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-emerald-300 px-1 text-[10px] font-black text-black">{conversation.unreadCount}</span>}
                </div>
                <p className="truncate text-xs text-[var(--admin-muted)]">{conversation.phoneMasked || conversation.phone}</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[var(--admin-muted)]">
                  <span className="rounded-[6px] border border-[var(--admin-border)] px-2 py-1">{conversation.status}</span>
                  <span>{formatDate(conversation.lastMessageAt)}</span>
                </div>
              </div>
            </button>
          ))}
          {!conversations.length && <div className="p-6 text-sm text-[var(--admin-muted)]">Nenhuma conversa encontrada.</div>}
        </div>
      </aside>

      <section className="admin-card flex min-h-[620px] flex-col overflow-hidden p-0">
        {activeConversation ? (
          <>
            <header className="border-b border-[var(--admin-border)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="mb-1 text-xl font-semibold text-[var(--admin-text)]">{contact?.displayName || activeConversation.contact?.displayName || activeConversation.phoneMasked}</h2>
                  <p className="text-sm text-[var(--admin-muted)]">{activeConversation.phoneMasked || activeConversation.phone}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select className="admin-input h-10 w-[170px]" value={activeConversation.status} onChange={event => void updateStatus(event.target.value as Conversation["status"])}>
                    <option value="open">Aberta</option>
                    <option value="pending">Pendente</option>
                    <option value="waiting_customer">Aguardando cliente</option>
                    <option value="resolved">Resolvida</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <input className="admin-input h-10 w-[190px]" value={assignedUserId} onChange={event => setAssignedUserId(event.target.value)} placeholder="Responsavel" />
                    <button type="button" onClick={() => void assignConversation()} className="admin-icon-button" title="Atribuir responsavel" aria-label="Atribuir responsavel">
                      <UserPlus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {contact?.optOut && (
                  <div className="inline-flex items-center gap-2 rounded-[8px] border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-100">
                    <AlertTriangle className="h-4 w-4" /> Opt-out registrado {contact.optOutAt ? formatDate(contact.optOutAt) : ""}
                  </div>
                )}
                <div className={`inline-flex items-center gap-2 rounded-[8px] border px-3 py-2 text-xs font-semibold ${windowState.expired ? "border-amber-400/40 bg-amber-400/10 text-amber-100" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"}`}>
                  {windowState.expired ? <Clock3 className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} {windowState.label}
                </div>
              </div>
            </header>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-black/[0.08] p-4">
              {loading && <p className="text-sm text-[var(--admin-muted)]">Carregando conversa...</p>}
              {messages.map(message => (
                <div key={message.id} className={`flex ${message.direction === "inbound" ? "justify-start" : message.direction === "internal_note" ? "justify-center" : "justify-end"}`}>
                  <div className={`max-w-[min(680px,92%)] rounded-[8px] border p-3 text-sm ${
                    message.direction === "inbound"
                      ? "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text)]"
                      : message.direction === "internal_note"
                        ? "border-amber-300/30 bg-amber-300/10 text-amber-50"
                        : "border-emerald-300/30 bg-emerald-300/10 text-emerald-50"
                  }`}>
                    <div className="mb-1 flex items-center gap-2 text-[11px] uppercase text-[var(--admin-muted)]">
                      {message.direction === "internal_note" && <StickyNote className="h-3 w-3" />}
                      <span>{message.direction === "internal_note" ? "Nota interna" : message.direction}</span>
                      <span>{formatDate(message.receivedAt || message.sentAt)}</span>
                      {message.direction === "outbound" && message.status && <span>{outboundStatusLabel(message.status)}</span>}
                      {message.direction !== "outbound" && message.status && <span>{message.status}</span>}
                    </div>
                    <p className="whitespace-pre-wrap break-words">{message.body || `[${message.type}]`}</p>
                  </div>
                </div>
              ))}
              {!messages.length && !loading && <p className="text-sm text-[var(--admin-muted)]">Selecione uma conversa para ver as mensagens.</p>}
            </div>
            <footer className="border-t border-[var(--admin-border)] p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
                <div className="flex gap-2">
                  <textarea className="admin-input min-h-[78px] flex-1 resize-none" value={note} onChange={event => setNote(event.target.value)} placeholder="Adicionar nota interna" />
                  <button type="button" onClick={() => void addNote()} className="admin-button-secondary self-stretch">
                    <StickyNote className="h-4 w-4" /> Nota
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <textarea
                      className="admin-input min-h-[78px] flex-1 resize-none"
                      value={reply}
                      maxLength={4000}
                      onChange={event => setReply(event.target.value)}
                      disabled={windowState.expired || Boolean(contact?.optOut)}
                      placeholder={windowState.expired ? "Janela expirada" : "Responder cliente"}
                    />
                    <button type="button" disabled={replyDisabled} onClick={() => void sendReply()} className={`admin-button-primary self-stretch ${replyDisabled ? "cursor-not-allowed opacity-60" : ""}`} title="Enviar resposta manual">
                      <Send className="h-4 w-4" /> Enviar
                    </button>
                  </div>
                  {windowState.expired && (
                    <p className="rounded-[8px] border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-100">
                      A janela de atendimento expirou. Utilize um template aprovado.
                    </p>
                  )}
                  {contact?.optOut && <p className="text-xs font-semibold text-rose-100">Contato em opt-out. Envio bloqueado.</p>}
                  {replyError && <p className="text-xs font-semibold text-rose-100">{replyError}</p>}
                  <button type="button" onClick={() => setTemplateOpen(true)} disabled={!activeConversation || Boolean(contact?.optOut)} className="admin-button-secondary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60">
                    <FileText className="h-4 w-4" /> Usar template
                  </button>
                  {windowState.expired && (
                    <p className="text-xs font-semibold text-[var(--admin-muted)]">
                      Fora da janela de 24h, somente templates aprovados podem ser enviados.
                    </p>
                  )}
                </div>
              </div>
            </footer>
            {templateOpen && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
                <div className="admin-card max-h-[88vh] w-full max-w-3xl overflow-y-auto p-0">
                  <div className="flex items-center justify-between border-b border-[var(--admin-border)] p-4">
                    <div>
                      <h3 className="mb-1 text-lg font-semibold text-[var(--admin-text)]">Usar template</h3>
                      <p className="text-xs text-[var(--admin-muted)]">Escolha uma mensagem aprovada para este atendimento.</p>
                    </div>
                    <button type="button" className="admin-icon-button" onClick={() => setTemplateOpen(false)} aria-label="Fechar">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid gap-4 p-4 md:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="space-y-3">
                      <select className="admin-input h-10 w-full" value={selectedTemplate?.id || ""} onChange={event => setSelectedTemplateId(event.target.value)}>
                        {templates.map(template => (
                          <option key={template.id} value={template.id}>{template.name} · {template.language}</option>
                        ))}
                      </select>
                      {!templates.length && <p className="rounded-[8px] border border-amber-400/40 bg-amber-400/10 p-3 text-xs font-semibold text-amber-100">Nenhum template aprovado sincronizado.</p>}
                      <div className="rounded-[8px] border border-[var(--admin-border)] bg-black/10 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-[var(--admin-muted)]">Botoes aprovados</p>
                        <div className="space-y-2">
                          {(selectedTemplate?.buttons || []).map(button => (
                            <div key={`${button.index}-${button.type}`} className="rounded-[8px] border border-[var(--admin-border)] px-3 py-2 text-xs text-[var(--admin-text)]">
                              <strong>{button.text || templateButtonLabel(button)}</strong>
                              <span className="mt-1 block text-[var(--admin-muted)]">{templateButtonLabel(button)}</span>
                            </div>
                          ))}
                          {selectedTemplate && !(selectedTemplate.buttons || []).length && <p className="text-xs text-[var(--admin-muted)]">Este template nao possui botoes.</p>}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                        <p className="mb-2 text-xs font-semibold uppercase text-[var(--admin-muted)]">Preview</p>
                        <p className="whitespace-pre-wrap text-sm text-[var(--admin-text)]">{templateText(selectedTemplate)}</p>
                      </div>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold text-[var(--admin-muted)]">Variaveis do template</span>
                        <textarea className="admin-input min-h-[120px] w-full resize-none font-mono text-xs" value={templateComponentsText} onChange={event => setTemplateComponentsText(event.target.value)} />
                      </label>
                      <p className="text-xs text-[var(--admin-muted)]">Use [] quando o template nao tiver variaveis.</p>
                      {templateError && <p className="rounded-[8px] border border-rose-400/40 bg-rose-400/10 p-3 text-xs font-semibold text-rose-100">{templateError}</p>}
                      <div className="flex justify-end gap-2">
                        <button type="button" className="admin-button-secondary" onClick={() => setTemplateOpen(false)}>Cancelar</button>
                        <button type="button" className="admin-button-primary" disabled={templateDisabled} onClick={() => void sendTemplate()}>
                          <Send className="h-4 w-4" /> Enviar template
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <MessageCircle className="mx-auto h-12 w-12 text-[var(--admin-muted)]" />
              <h2 className="mt-4 text-xl font-semibold text-[var(--admin-text)]">Central WhatsApp</h2>
              <p className="mt-2 text-sm text-[var(--admin-muted)]">Escolha uma conversa para iniciar o atendimento.</p>
            </div>
          </div>
        )}
      </section>
    </div>
      )}
    </div>
  );
}

function AdminWhatsAppNumbers() {
  const [numbers, setNumbers] = useState<WhatsAppCloudNumber[]>([]);
  const [routingMode, setRoutingMode] = useState<"automatic" | "default_number">("automatic");
  const [form, setForm] = useState<Record<string, string>>({ status: "inactive", qualityRating: "unknown", dailyLimit: "1000" });
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/admin/whatsapp-center/numbers");
    const data = await response.json().catch(() => ({ numbers: [], routing: {} }));
    if (!response.ok) {
      setError(data.error || "Falha ao carregar números");
      return;
    }
    setNumbers(data.numbers || []);
    setRoutingMode(data.routing?.whatsappRoutingMode === "default_number" ? "default_number" : "automatic");
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveNumber() {
    setError("");
    const response = await fetch("/api/admin/whatsapp-center/numbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: form.displayName,
        phoneNumber: form.phoneNumber,
        phoneNumberId: form.phoneNumberId,
        wabaId: form.wabaId,
        businessManagerId: form.businessManagerId,
        accessToken: form.accessToken,
        appSecret: form.appSecret,
        verifyToken: form.verifyToken,
        status: form.status,
        qualityRating: form.qualityRating,
        dailyLimit: Number(form.dailyLimit || 1000)
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || "Falha ao salvar número");
      return;
    }
    setForm({ status: "inactive", qualityRating: "unknown", dailyLimit: "1000" });
    await load();
  }

  async function updateNumber(id: string, patch: Record<string, unknown>) {
    const response = await fetch(`/api/admin/whatsapp-center/numbers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    if (response.ok) await load();
  }

  async function simpleAction(id: string, action: "test" | "validate" | "set-default" | "sync-templates") {
    const response = await fetch(`/api/admin/whatsapp-center/numbers/${id}/${action}`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.error || "Ação não concluída");
    await load();
  }

  async function saveRouting(mode: "automatic" | "default_number") {
    setRoutingMode(mode);
    await fetch("/api/admin/whatsapp-center/routing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsappRoutingMode: mode })
    });
  }

  return (
    <div className="space-y-4">
      <section className="admin-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="mb-1 text-lg font-semibold text-[var(--admin-text)]">Números WhatsApp</h2>
            <p className="text-sm text-[var(--admin-muted)]">Roteamento por menor carga ou número padrão.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void saveRouting("automatic")} className={routingMode === "automatic" ? "admin-button-primary" : "admin-button-secondary"}>Automático</button>
            <button type="button" onClick={() => void saveRouting("default_number")} className={routingMode === "default_number" ? "admin-button-primary" : "admin-button-secondary"}>Número padrão</button>
          </div>
        </div>
        {error && <p className="mt-3 rounded-[8px] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      </section>

      <section className="admin-card p-4">
        <h3 className="mb-3 text-base font-semibold text-[var(--admin-text)]">Adicionar número</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["displayName", "Nome exibido"],
            ["phoneNumber", "Número"],
            ["phoneNumberId", "Phone Number ID"],
            ["wabaId", "WABA ID"],
            ["businessManagerId", "Business Manager ID"],
            ["dailyLimit", "Limite diário"],
            ["accessToken", "Access token"],
            ["appSecret", "App secret"],
            ["verifyToken", "Verify token"]
          ].map(([key, label]) => (
            <label key={key} className="grid gap-1 text-xs font-semibold text-[var(--admin-muted)]">{label}<input className="admin-input" value={form[key] || ""} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} /></label>
          ))}
          <label className="grid gap-1 text-xs font-semibold text-[var(--admin-muted)]">Status<select className="admin-input" value={form.status || "inactive"} onChange={event => setForm(current => ({ ...current, status: event.target.value }))}><option value="active">active</option><option value="inactive">inactive</option><option value="blocked">blocked</option><option value="error">error</option></select></label>
          <label className="grid gap-1 text-xs font-semibold text-[var(--admin-muted)]">Qualidade<select className="admin-input" value={form.qualityRating || "unknown"} onChange={event => setForm(current => ({ ...current, qualityRating: event.target.value }))}><option value="unknown">unknown</option><option value="green">green</option><option value="yellow">yellow</option><option value="red">red</option></select></label>
        </div>
        <button type="button" onClick={() => void saveNumber()} className="admin-button mt-4"><CheckCircle2 className="h-4 w-4" /> Adicionar número</button>
      </section>

      <section className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-[var(--admin-muted)]"><tr><th className="p-3">Número</th><th className="p-3">Status</th><th className="p-3">Qualidade</th><th className="p-3">Uso diário</th><th className="p-3">Último erro</th><th className="p-3">Ações</th></tr></thead>
            <tbody>
              {numbers.map(number => (
                <tr key={number.id} className="border-t border-[var(--admin-border)] text-[var(--admin-text)]">
                  <td className="p-3"><p className="font-semibold">{number.displayName} {number.isDefault ? "• padrão" : ""}</p><p className="text-xs text-[var(--admin-muted)]">{number.phoneNumberId}</p></td>
                  <td className="p-3">{number.status}</td>
                  <td className="p-3">{number.qualityRating}</td>
                  <td className="p-3">{number.dailySentCount}/{number.dailyLimit}</td>
                  <td className="p-3">{number.lastErrorAt ? formatDate(number.lastErrorAt) : "Sem erro"}</td>
                  <td className="p-3"><div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void updateNumber(number.id, { status: number.status === "active" ? "inactive" : "active" })} className="admin-action-button">{number.status === "active" ? "Desativar" : "Ativar"}</button>
                    <button type="button" onClick={() => void simpleAction(number.id, "set-default")} className="admin-action-button">Definir padrão</button>
                    <button type="button" onClick={() => void simpleAction(number.id, "test")} className="admin-action-button">Testar</button>
                    <button type="button" onClick={() => void simpleAction(number.id, "validate")} className="admin-action-button">Validar</button>
                    <button type="button" onClick={() => void simpleAction(number.id, "sync-templates")} className="admin-action-button">Sincronizar templates</button>
                  </div></td>
                </tr>
              ))}
              {!numbers.length && <tr><td className="p-4 text-[var(--admin-muted)]" colSpan={6}>Nenhum número conectado.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AdminWhatsAppDashboard() {
  const [dashboard, setDashboard] = useState<WhatsAppDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/whatsapp-center/dashboard");
    const data = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok || !data) {
      setError(data?.error || "Nao foi possivel carregar o dashboard");
      return;
    }
    setDashboard(data);
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const metrics = dashboard?.metrics;
  const cards = [
    { label: "Enviadas hoje", value: metrics?.sentToday || 0, detail: "movimento do dia", icon: Send },
    { label: "Entregues", value: metrics?.delivered || 0, detail: percent(metrics?.deliveryRate || 0), icon: CheckCircle2 },
    { label: "Lidas", value: metrics?.read || 0, detail: percent(metrics?.readRate || 0), icon: Eye },
    { label: "Recuperacoes PIX", value: metrics?.pixRecoveredCount || 0, detail: percent(metrics?.pixRecoveryRate || 0), icon: TrendingUp },
    { label: "Valor recuperado", value: money(metrics?.pixRecoveredValue || 0), detail: "compras pagas", icon: DollarSign },
    { label: "Campanhas", value: metrics?.campaignsSent || 0, detail: "ativas ou finalizadas", icon: Megaphone },
    { label: "Fila pendente", value: metrics?.queueQueued || 0, detail: `${metrics?.queueProcessing || 0} em processamento`, icon: ListChecks },
    { label: "DLQ", value: metrics?.queueDeadLetter || 0, detail: `retry ${percent(metrics?.queueRetryRate || 0)}`, icon: RefreshCw },
    { label: "Sucesso fila", value: percent(metrics?.queueSuccessRate || 0), detail: `${metrics?.queueSent || 0} enviados · ${metrics?.queueFailed || 0} falhas`, icon: CheckCircle2 },
    { label: "Opt-outs", value: metrics?.optOuts || 0, detail: "clientes que sairam", icon: Ban }
  ];

  return (
    <div className="space-y-4">
      <section className="admin-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--admin-muted)]">Resultados comerciais</p>
            <h2 className="mb-1 text-2xl font-bold text-[var(--admin-text)]">Dashboard WhatsApp</h2>
            <p className="text-sm text-[var(--admin-muted)]">Vendas recuperadas, campanhas e conversas em um painel executivo.</p>
          </div>
          <button type="button" onClick={() => void loadDashboard()} className="admin-button-secondary" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>
        {error && <div className="mt-4 rounded-[8px] border border-rose-400/35 bg-rose-500/10 p-3 text-sm font-semibold text-rose-200">{error}</div>}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="admin-card min-h-[132px]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--admin-muted)]">{card.label}</p>
                  <p className="mt-3 text-3xl font-black text-[var(--admin-text)]">{card.value}</p>
                </div>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-[var(--admin-primary)] text-[var(--admin-button-text)]">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--admin-muted)]">{card.detail}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="admin-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="mb-0 text-lg font-bold text-[var(--admin-text)]">Ultimos 7 dias</h3>
            <StatusPill status={`${metrics?.failures || 0} falhas`} />
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboard?.charts.last7Days || []}>
                <CartesianGrid stroke="rgba(148,163,184,0.18)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--admin-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--admin-muted)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)", borderRadius: 8, color: "var(--admin-text)" }} />
                <Area type="monotone" dataKey="enviados" name="Enviadas" stroke="#22c55e" fill="#22c55e33" strokeWidth={2} />
                <Area type="monotone" dataKey="entregues" name="Entregues" stroke="#38bdf8" fill="#38bdf833" strokeWidth={2} />
                <Area type="monotone" dataKey="lidos" name="Lidas" stroke="#a78bfa" fill="#a78bfa26" strokeWidth={2} />
                <Area type="monotone" dataKey="falhas" name="Falhas" stroke="#fb7185" fill="#fb718526" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="admin-card">
          <div className="mb-4">
            <h3 className="mb-0 text-lg font-bold text-[var(--admin-text)]">Recuperacao PIX</h3>
            <p className="text-sm text-[var(--admin-muted)]">Ultimos 30 dias</p>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard?.charts.pixRecoveryLast30Days || []}>
                <CartesianGrid stroke="rgba(148,163,184,0.18)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--admin-muted)", fontSize: 11 }} axisLine={false} tickLine={false} interval={5} />
                <YAxis tick={{ fill: "var(--admin-muted)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip formatter={(value: any, name: any) => name === "valor" ? money(Number(value)) : value} contentStyle={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)", borderRadius: 8, color: "var(--admin-text)" }} />
                <Bar dataKey="recuperacoes" name="Recuperacoes" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <div className="admin-card">
          <p className="text-sm font-bold text-[var(--admin-muted)]">Abertas</p>
          <p className="mt-2 text-3xl font-black text-[var(--admin-text)]">{dashboard?.conversations.abertas || 0}</p>
        </div>
        <div className="admin-card">
          <p className="text-sm font-bold text-[var(--admin-muted)]">Aguardando cliente</p>
          <p className="mt-2 text-3xl font-black text-[var(--admin-text)]">{dashboard?.conversations.aguardandoCliente || 0}</p>
        </div>
        <div className="admin-card">
          <p className="text-sm font-bold text-[var(--admin-muted)]">Pendentes</p>
          <p className="mt-2 text-3xl font-black text-[var(--admin-text)]">{dashboard?.conversations.pendentes || 0}</p>
        </div>
        <div className="admin-card">
          <p className="text-sm font-bold text-[var(--admin-muted)]">Resolvidas</p>
          <p className="mt-2 text-3xl font-black text-[var(--admin-text)]">{dashboard?.conversations.resolvidas || 0}</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DashboardTable
          title="Campanhas com melhor desempenho"
          empty="Nenhuma campanha encontrada."
          headers={["Campanha", "Destinatarios", "Enviadas", "Entregues", "Lidas", "Status"]}
          rows={(dashboard?.campaigns || []).map(campaign => [
            campaign.campanha,
            campaign.destinatarios,
            campaign.enviados,
            campaign.entregues,
            campaign.lidos,
            campaignStatusLabel(campaign.status)
          ])}
        />
        <DashboardTable
          title="Templates mais usados"
          empty="Nenhum template utilizado ainda."
          headers={["Template", "Envios", "Entregues", "Lidos"]}
          rows={(dashboard?.templates || []).map(template => [template.template, template.envios, template.entregues, template.lidos])}
        />
      </section>
    </div>
  );
}

function DashboardTable({ title, headers, rows, empty }: { title: string; headers: string[]; rows: Array<Array<string | number>>; empty: string }) {
  return (
    <div className="admin-card overflow-hidden p-0">
      <div className="border-b border-[var(--admin-border)] p-4">
        <h3 className="mb-0 text-lg font-bold text-[var(--admin-text)]">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.12em] text-[var(--admin-muted)]">
            <tr>
              {headers.map(header => <th key={header} className="px-4 py-3 font-bold">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`} className="border-t border-[var(--admin-border)] text-[var(--admin-text)]">
                {row.map((cell, cellIndex) => <td key={`${title}-${rowIndex}-${cellIndex}`} className="px-4 py-3 font-semibold">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-4 text-sm font-semibold text-[var(--admin-muted)]">{empty}</p>}
      </div>
    </div>
  );
}

function AdminWhatsAppAutomations({ templates }: { templates: Template[] }) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    type: "new_buyer" as AutomationType,
    template: "",
    delay: 1440,
    enabled: true,
    dailyLimit: 100,
    cooldownHours: 24,
    conditions: "{}"
  });

  const labels: Record<AutomationType, string> = {
    new_buyer: "Comprador Novo",
    vip_buyer: "Comprador VIP",
    abandoned_pix: "PIX Abandonado",
    inactive_customer: "Cliente Inativo",
    post_raffle: "Pós-Sorteio",
    top_buyers: "Top Compradores",
    birthday: "Aniversário"
  };

  const delays: Record<AutomationType, Array<{ value: number; label: string }>> = {
    new_buyer: [{ value: 1440, label: "D+1" }, { value: 4320, label: "D+3" }, { value: 10080, label: "D+7" }],
    vip_buyer: [{ value: 0, label: "Ao atingir regra" }],
    abandoned_pix: [{ value: 30, label: "30 min" }, { value: 360, label: "6 horas" }, { value: 1440, label: "24 horas" }, { value: 4320, label: "72 horas" }],
    inactive_customer: [{ value: 43200, label: "30 dias" }, { value: 86400, label: "60 dias" }, { value: 129600, label: "90 dias" }],
    post_raffle: [{ value: 0, label: "Após encerramento" }],
    top_buyers: [{ value: 0, label: "Ranking atual" }],
    birthday: [{ value: 0, label: "No aniversário" }]
  };

  async function loadAutomations() {
    setLoading(true);
    setError("");
    const [rulesResponse, logsResponse] = await Promise.all([
      fetch("/api/admin/whatsapp-center/automations"),
      fetch("/api/admin/whatsapp-center/automations/logs")
    ]);
    const rulesData = await rulesResponse.json().catch(() => ({ rules: [] }));
    const logsData = await logsResponse.json().catch(() => ({ executions: [], logs: [] }));
    setLoading(false);
    if (!rulesResponse.ok) {
      setError(rulesData.error || "Nao foi possivel carregar automacoes");
      return;
    }
    setRules(rulesData.rules || []);
    if (logsResponse.ok) {
      setExecutions(logsData.executions || []);
      setLogs(logsData.logs || []);
    }
  }

  useEffect(() => {
    void loadAutomations();
  }, []);

  useEffect(() => {
    if (!form.template && templates[0]) setForm(current => ({ ...current, template: templates[0].name }));
  }, [templates, form.template]);

  function delayLabel(type: AutomationType, delay: number) {
    return delays[type]?.find(item => item.value === delay)?.label || `${delay} min`;
  }

  async function saveAutomation() {
    let conditions: Record<string, any> = {};
    try {
      conditions = JSON.parse(form.conditions || "{}");
      if (!conditions || typeof conditions !== "object" || Array.isArray(conditions)) throw new Error("JSON invalido");
    } catch {
      setError("Revise as condições JSON da automação.");
      return;
    }
    setSaving(true);
    setError("");
    const response = await fetch("/api/admin/whatsapp-center/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.type,
        template: form.template,
        language: templates.find(template => template.name === form.template)?.language || "pt_BR",
        delay: form.delay,
        enabled: form.enabled,
        dailyLimit: form.dailyLimit,
        cooldownHours: form.cooldownHours,
        conditions
      })
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(data.error || "Falha ao salvar automação");
      return;
    }
    await loadAutomations();
  }

  async function toggleAutomation(rule: AutomationRule) {
    const response = await fetch(`/api/admin/whatsapp-center/automations/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rule, enabled: !rule.enabled })
    });
    if (response.ok) await loadAutomations();
  }

  async function removeAutomation(rule: AutomationRule) {
    const response = await fetch(`/api/admin/whatsapp-center/automations/${rule.id}`, { method: "DELETE" });
    if (response.ok) await loadAutomations();
  }

  async function runAutomations() {
    setLoading(true);
    const response = await fetch("/api/admin/whatsapp-center/automations/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 50 }) });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(data.error || "Falha ao executar automações");
      return;
    }
    await loadAutomations();
  }

  return (
    <div className="space-y-4">
      <section className="admin-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--admin-muted)]">CRM WhatsApp Cloud</p>
            <h2 className="mb-1 text-2xl font-bold text-[var(--admin-text)]">Automações CRM</h2>
            <p className="text-sm text-[var(--admin-muted)]">Gatilhos comerciais com templates aprovados, opt-out, cooldown e limite diário.</p>
          </div>
          <button type="button" onClick={() => void runAutomations()} className="admin-button-primary" disabled={loading}>
            <Play className="h-4 w-4" /> Executar fila
          </button>
        </div>
        <p className="mt-3 rounded-[8px] border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm font-medium text-amber-100">
          As automações criam execuções programadas e filas com segurança. Nesta etapa, o envio é processado ao clicar em Executar fila. Para execução automática contínua, configure um orquestrador/cron chamando /api/admin/whatsapp-center/automations/run.
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="admin-card space-y-4">
          <h3 className="mb-0 text-lg font-semibold text-[var(--admin-text)]">Nova automação</h3>
          <label className="grid gap-2 text-sm font-semibold text-[var(--admin-muted)]">
            Automação
            <select className="admin-input h-11" value={form.type} onChange={event => {
              const type = event.target.value as AutomationType;
              setForm(current => ({ ...current, type, delay: delays[type][0].value }));
            }}>
              {(Object.keys(labels) as AutomationType[]).map(type => <option key={type} value={type}>{labels[type]}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[var(--admin-muted)]">
            Template aprovado
            <select className="admin-input h-11" value={form.template} onChange={event => setForm(current => ({ ...current, template: event.target.value }))}>
              {templates.map(template => <option key={template.id} value={template.name}>{template.name} · {template.language}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[var(--admin-muted)]">
            Gatilho
            <select className="admin-input h-11" value={form.delay} onChange={event => setForm(current => ({ ...current, delay: Number(event.target.value) }))}>
              {delays[form.type].map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[var(--admin-muted)]">Limite diário<input className="admin-input h-11" type="number" min={1} value={form.dailyLimit} onChange={event => setForm(current => ({ ...current, dailyLimit: Number(event.target.value) }))} /></label>
            <label className="grid gap-2 text-sm font-semibold text-[var(--admin-muted)]">Cooldown (h)<input className="admin-input h-11" type="number" min={1} value={form.cooldownHours} onChange={event => setForm(current => ({ ...current, cooldownHours: Number(event.target.value) }))} /></label>
          </div>
          <label className="grid gap-2 text-sm font-semibold text-[var(--admin-muted)]">
            Condições JSON
            <textarea className="admin-input min-h-[110px] font-mono text-xs" value={form.conditions} onChange={event => setForm(current => ({ ...current, conditions: event.target.value }))} />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-text)]">
            <input type="checkbox" checked={form.enabled} onChange={event => setForm(current => ({ ...current, enabled: event.target.checked }))} /> Ativa
          </label>
          {error && <p className="rounded-[8px] border border-rose-400/40 bg-rose-400/10 p-3 text-xs font-semibold text-rose-100">{error}</p>}
          <button type="button" onClick={() => void saveAutomation()} className="admin-button-primary w-full justify-center" disabled={saving || !templates.length}>
            <ListChecks className="h-4 w-4" /> Salvar automação
          </button>
        </section>

        <section className="admin-card overflow-hidden p-0">
          <div className="border-b border-[var(--admin-border)] p-4">
            <h3 className="mb-1 text-lg font-semibold text-[var(--admin-text)]">Regras configuradas</h3>
            <p className="text-xs text-[var(--admin-muted)]">{rules.length} automações nativas</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-[var(--admin-border)] text-xs uppercase text-[var(--admin-muted)]">
                <tr><th className="p-3">Automação</th><th className="p-3">Template</th><th className="p-3">Gatilho</th><th className="p-3">Status</th><th className="p-3">Próximas execuções</th><th className="p-3">Ações</th></tr>
              </thead>
              <tbody>
                {rules.map(rule => (
                  <tr key={rule.id} className="border-b border-[var(--admin-border)]">
                    <td className="p-3 font-semibold text-[var(--admin-text)]">{rule.label || labels[rule.type]}</td>
                    <td className="p-3 text-[var(--admin-muted)]">{rule.template}</td>
                    <td className="p-3 text-[var(--admin-muted)]">{delayLabel(rule.type, rule.delay)}</td>
                    <td className="p-3"><span className={`rounded-[6px] px-2 py-1 text-xs font-bold ${rule.enabled ? "bg-emerald-400/10 text-emerald-100" : "bg-slate-400/10 text-slate-200"}`}>{rule.enabled ? "ativa" : "pausada"}</span></td>
                    <td className="p-3 text-xs text-[var(--admin-muted)]">{(rule.nextExecutions || []).slice(0, 2).map(item => formatDate(item.scheduledAt)).join(", ") || "Sem agendamentos"}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button type="button" className="admin-icon-button" onClick={() => void toggleAutomation(rule)} title={rule.enabled ? "Pausar" : "Ativar"}><RefreshCw className="h-4 w-4" /></button>
                        <button type="button" className="admin-icon-button" onClick={() => void removeAutomation(rule)} title="Remover"><X className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!rules.length && <tr><td colSpan={6} className="p-6 text-center text-sm text-[var(--admin-muted)]">Nenhuma automação configurada.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="admin-card">
          <h3 className="text-lg font-semibold text-[var(--admin-text)]">Histórico</h3>
          <div className="mt-3 space-y-2">
            {executions.slice(0, 8).map(item => <div key={item.id} className="rounded-[8px] border border-[var(--admin-border)] p-3 text-sm text-[var(--admin-text)]"><strong>{item.status}</strong><span className="ml-2 text-[var(--admin-muted)]">{item.template} · {formatDate(item.executedAt || item.scheduledAt)}</span></div>)}
            {!executions.length && <p className="text-sm text-[var(--admin-muted)]">Sem histórico de execuções.</p>}
          </div>
        </section>
        <section className="admin-card">
          <h3 className="text-lg font-semibold text-[var(--admin-text)]">Logs</h3>
          <div className="mt-3 space-y-2">
            {logs.slice(0, 8).map(log => <div key={log.id} className="rounded-[8px] border border-[var(--admin-border)] p-3 text-sm text-[var(--admin-text)]"><strong>{log.action}</strong><span className="ml-2 text-[var(--admin-muted)]">{log.message} · {formatDate(log.created_at)}</span></div>)}
            {!logs.length && <p className="text-sm text-[var(--admin-muted)]">Sem logs de automações.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function AdminWhatsAppCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [queue, setQueue] = useState<CampaignQueueItem[]>([]);
  const [logs, setLogs] = useState<CampaignLog[]>([]);
  const [previewRecipients, setPreviewRecipients] = useState<CampaignRecipient[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    segment: "today",
    templateId: "",
    componentsText: "[]",
    dailyTenantLimit: "100",
    cooldownHours: "24"
  });

  const selectedTemplate = useMemo(() => templates.find(template => template.id === form.templateId) || templates[0] || null, [templates, form.templateId]);
  const selectedCampaign = useMemo(() => campaigns.find(item => item.id === selectedId) || campaigns[0] || null, [campaigns, selectedId]);

  async function loadCampaigns() {
    const response = await fetch("/api/admin/whatsapp-center/campaigns");
    const data = await response.json().catch(() => ({ campaigns: [] }));
    if (response.ok) {
      setCampaigns(data.campaigns || []);
      if (!selectedId && data.campaigns?.[0]?.id) setSelectedId(data.campaigns[0].id);
    }
  }

  async function loadTemplates() {
    const response = await fetch("/api/admin/whatsapp-center/templates");
    const data = await response.json().catch(() => ({ templates: [] }));
    if (response.ok) {
      setTemplates(data.templates || []);
      if (!form.templateId && data.templates?.[0]?.id) {
        setForm(current => ({ ...current, templateId: data.templates[0].id }));
      }
    }
  }

  async function loadQueueAndLogs() {
    const [queueResponse, logsResponse] = await Promise.all([
      fetch("/api/admin/whatsapp-center/campaigns/queue"),
      fetch("/api/admin/whatsapp-center/campaigns/logs")
    ]);
    const queueData = await queueResponse.json().catch(() => ({ queue: [] }));
    const logsData = await logsResponse.json().catch(() => ({ logs: [] }));
    if (queueResponse.ok) setQueue(queueData.queue || []);
    if (logsResponse.ok) setLogs(logsData.logs || []);
  }

  useEffect(() => {
    void loadTemplates();
    void loadCampaigns();
    void loadQueueAndLogs();
  }, []);

  function parseComponents() {
    const parsed = JSON.parse(form.componentsText || "[]");
    if (!Array.isArray(parsed)) throw new Error("Componentes devem ser uma lista JSON.");
    return parsed;
  }

  async function createCampaign() {
    if (!selectedTemplate) return;
    setBusy("create");
    setError("");
    let components: unknown[] = [];
    try {
      components = parseComponents();
    } catch (err) {
      setBusy("");
      setError(err instanceof Error ? err.message : "Revise os componentes.");
      return;
    }
    const response = await fetch("/api/admin/whatsapp-center/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        segment: form.segment,
        templateName: selectedTemplate.name,
        language: selectedTemplate.language,
        components,
        dailyTenantLimit: Number(form.dailyTenantLimit || 100),
        cooldownHours: Number(form.cooldownHours || 24)
      })
    });
    const data = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) {
      setError(data.error || "Falha ao criar Campanha CRM.");
      return;
    }
    setSelectedId(data.campaign?.id || "");
    setPreviewRecipients([]);
    setPreviewTotal(0);
    await loadCampaigns();
    await loadQueueAndLogs();
  }

  async function previewCampaign(id = selectedCampaign?.id || "") {
    if (!id) return;
    setBusy(`preview:${id}`);
    setError("");
    const response = await fetch(`/api/admin/whatsapp-center/campaigns/${id}/preview`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) {
      setError(data.error || "Falha ao gerar preview.");
      return;
    }
    setPreviewRecipients(data.recipients || []);
    setPreviewTotal(Number(data.total || 0));
    await loadCampaigns();
    await loadQueueAndLogs();
  }

  async function enqueueCampaign(id = selectedCampaign?.id || "") {
    if (!id) return;
    setBusy(`enqueue:${id}`);
    setError("");
    const response = await fetch(`/api/admin/whatsapp-center/campaigns/${id}/enqueue`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) {
      setError(data.error || "Falha ao enfileirar.");
      return;
    }
    await loadCampaigns();
    await loadQueueAndLogs();
  }

  async function cancelCampaign(id: string) {
    setBusy(`cancel:${id}`);
    setError("");
    const response = await fetch(`/api/admin/whatsapp-center/campaigns/${id}/cancel`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) {
      setError(data.error || "Falha ao cancelar.");
      return;
    }
    await loadCampaigns();
    await loadQueueAndLogs();
  }

  async function runQueue() {
    setBusy("run");
    setError("");
    const response = await fetch("/api/admin/whatsapp-center/campaigns/queue/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 20 })
    });
    const data = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) {
      setError(data.error || "Falha ao processar fila.");
      return;
    }
    await loadCampaigns();
    await loadQueueAndLogs();
  }

  function templatePreview(template: Template | null) {
    const body = template?.components?.find(component => String(component.type || "").toUpperCase() === "BODY");
    const header = template?.components?.find(component => String(component.type || "").toUpperCase() === "HEADER");
    return [header?.text, body?.text].filter(Boolean).join("\n\n") || "Template aprovado sem texto de preview.";
  }

  return (
    <div className="space-y-4">
      <section className="admin-card p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="mb-1 text-xl font-semibold text-[var(--admin-text)]">Campanhas CRM</h2>
            <p className="text-sm text-[var(--admin-muted)]">Envios promocionais por segmento, sempre com templates aprovados.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadQueueAndLogs()} className="admin-button-secondary">
              <RefreshCw className="h-4 w-4" /> Atualizar
            </button>
            <button type="button" onClick={() => void runQueue()} disabled={busy === "run"} className="admin-button-primary disabled:cursor-not-allowed disabled:opacity-60">
              <Play className="h-4 w-4" /> Rodar fila
            </button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-3 rounded-[8px] border border-[var(--admin-border)] bg-black/10 p-4">
            <h3 className="text-sm font-black uppercase text-[var(--admin-muted)]">Criar Campanha</h3>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--admin-muted)]">Nome</span>
              <input className="admin-input h-10 w-full" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="Ex.: Oferta VIP" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--admin-muted)]">Segmento</span>
              <select className="admin-input h-10 w-full" value={form.segment} onChange={event => setForm(current => ({ ...current, segment: event.target.value }))}>
                {campaignSegments.map(segment => <option key={segment.key} value={segment.key}>{segment.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--admin-muted)]">Template aprovado</span>
              <select className="admin-input h-10 w-full" value={selectedTemplate?.id || ""} onChange={event => setForm(current => ({ ...current, templateId: event.target.value }))}>
                {templates.map(template => <option key={template.id} value={template.id}>{template.name} · {template.language}</option>)}
              </select>
            </label>
            {!templates.length && <p className="rounded-[8px] border border-amber-400/40 bg-amber-400/10 p-3 text-xs font-semibold text-amber-100">Nenhum template aprovado sincronizado.</p>}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--admin-muted)]">Limite diario</span>
                <input className="admin-input h-10 w-full" type="number" min="1" max="1000" value={form.dailyTenantLimit} onChange={event => setForm(current => ({ ...current, dailyTenantLimit: event.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--admin-muted)]">Cooldown horas</span>
                <input className="admin-input h-10 w-full" type="number" min="1" max="720" value={form.cooldownHours} onChange={event => setForm(current => ({ ...current, cooldownHours: event.target.value }))} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--admin-muted)]">Componentes JSON</span>
              <textarea className="admin-input min-h-[110px] w-full resize-none font-mono text-xs" value={form.componentsText} onChange={event => setForm(current => ({ ...current, componentsText: event.target.value }))} />
            </label>
            <div className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-[var(--admin-muted)]">Preview do template</p>
              <p className="whitespace-pre-wrap text-sm text-[var(--admin-text)]">{templatePreview(selectedTemplate)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(selectedTemplate?.buttons || []).map(button => (
                  <span key={`${button.index}-${button.type}`} className="rounded-[8px] border border-[var(--admin-border)] px-3 py-1 text-xs text-[var(--admin-text)]">{button.text || button.type}</span>
                ))}
              </div>
            </div>
            {error && <p className="rounded-[8px] border border-rose-400/40 bg-rose-400/10 p-3 text-xs font-semibold text-rose-100">{error}</p>}
            <button type="button" onClick={() => void createCampaign()} disabled={!selectedTemplate || busy === "create"} className="admin-button-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60">
              <Megaphone className="h-4 w-4" /> Criar Campanha
            </button>
          </div>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-[8px] border border-[var(--admin-border)]">
              <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_0.8fr] gap-3 border-b border-[var(--admin-border)] bg-black/20 px-4 py-3 text-xs font-black uppercase text-[var(--admin-muted)]">
                <span>Nome</span><span>Segmento</span><span>Template</span><span>Status</span><span>Acoes</span>
              </div>
              {campaigns.map(item => (
                <div key={item.id} className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_0.8fr] items-center gap-3 border-b border-[var(--admin-border)] px-4 py-3 text-sm last:border-b-0">
                  <button type="button" onClick={() => setSelectedId(item.id)} className="min-w-0 text-left">
                    <span className="block truncate font-semibold text-[var(--admin-text)]">{item.name}</span>
                    <span className="text-xs text-[var(--admin-muted)]">{item.predicted_recipients} previsto · {item.queue?.total || 0} na fila</span>
                  </button>
                  <span className="text-[var(--admin-muted)]">{campaignSegmentLabel(item.segment)}</span>
                  <span className="truncate text-[var(--admin-muted)]">{item.template_name}</span>
                  <StatusPill status={campaignStatusLabel(item.status)} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void previewCampaign(item.id)} className="admin-icon-button" title="Preview" aria-label="Preview"><Eye className="h-4 w-4" /></button>
                    <button type="button" onClick={() => void enqueueCampaign(item.id)} disabled={item.status === "cancelled"} className="admin-icon-button disabled:cursor-not-allowed disabled:opacity-50" title="Enfileirar" aria-label="Enfileirar"><ListChecks className="h-4 w-4" /></button>
                    <button type="button" onClick={() => void cancelCampaign(item.id)} disabled={item.status === "completed" || item.status === "cancelled"} className="admin-icon-button disabled:cursor-not-allowed disabled:opacity-50" title="Cancelar" aria-label="Cancelar"><Ban className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
              {!campaigns.length && <div className="p-6 text-sm text-[var(--admin-muted)]">Nenhum item criado.</div>}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[8px] border border-[var(--admin-border)] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-[var(--admin-muted)]" />
                  <h3 className="text-sm font-black uppercase text-[var(--admin-muted)]">Preview destinatarios</h3>
                  <span className="ml-auto text-xs font-semibold text-[var(--admin-text)]">{previewTotal}</span>
                </div>
                <div className="max-h-[260px] space-y-2 overflow-y-auto">
                  {previewRecipients.map(recipient => (
                    <div key={`${recipient.customerId}-${recipient.phone}`} className="rounded-[8px] border border-[var(--admin-border)] px-3 py-2 text-sm">
                      <p className="font-semibold text-[var(--admin-text)]">{recipient.name}</p>
                      <p className="text-xs text-[var(--admin-muted)]">{recipient.phone} · {recipient.statusComercial || "-"}</p>
                    </div>
                  ))}
                  {!previewRecipients.length && <p className="text-sm text-[var(--admin-muted)]">Use o botao de preview em uma linha.</p>}
                </div>
              </div>

              <div className="rounded-[8px] border border-[var(--admin-border)] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-[var(--admin-muted)]" />
                  <h3 className="text-sm font-black uppercase text-[var(--admin-muted)]">Fila</h3>
                  <span className="ml-auto text-xs font-semibold text-[var(--admin-text)]">{queue.length}</span>
                </div>
                <div className="max-h-[260px] space-y-2 overflow-y-auto">
                  {queue.map(item => (
                    <div key={item.id} className="rounded-[8px] border border-[var(--admin-border)] px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold text-[var(--admin-text)]">{item.phone}</p>
                        <span className="text-xs text-[var(--admin-muted)]">{item.status}</span>
                      </div>
                      <p className="truncate text-xs text-[var(--admin-muted)]">{item.template_name || "-"} · tentativas {item.attempts}</p>
                    </div>
                  ))}
                  {!queue.length && <p className="text-sm text-[var(--admin-muted)]">Fila vazia.</p>}
                </div>
              </div>
            </div>

            <div className="rounded-[8px] border border-[var(--admin-border)] p-4">
              <h3 className="mb-3 text-sm font-black uppercase text-[var(--admin-muted)]">Logs</h3>
              <div className="max-h-[260px] space-y-2 overflow-y-auto">
                {logs.map(log => (
                  <div key={log.id} className="rounded-[8px] border border-[var(--admin-border)] px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[var(--admin-text)]">{log.action}</span>
                      <span className="text-xs text-[var(--admin-muted)]">{log.status}</span>
                      <span className="ml-auto text-xs text-[var(--admin-muted)]">{formatDate(log.created_at)}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--admin-muted)]">{log.message}</p>
                  </div>
                ))}
                {!logs.length && <p className="text-sm text-[var(--admin-muted)]">Sem logs.</p>}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const campaignSegments = [
  { key: "today", label: "Hoje" },
  { key: "last_7_days", label: "Ultimos 7 dias" },
  { key: "vip", label: "VIP" },
  { key: "recurring", label: "Recorrentes" },
  { key: "pix_pending", label: "PIX pendente" },
  { key: "pix_expired", label: "PIX vencido" },
  { key: "raffle", label: "Rifa" },
  { key: "fazendinha", label: "Fazendinha" },
  { key: "number_mode", label: "Modalidade numerica" },
  { key: "inactive_30_days", label: "Inativos 30 dias" }
];

function campaignSegmentLabel(value: string) {
  return campaignSegments.find(item => item.key === value)?.label || value;
}

function campaignStatusLabel(value: CampaignStatus) {
  const labels: Record<CampaignStatus, string> = {
    draft: "rascunho",
    ready: "pronta",
    queued: "enfileirada",
    sending: "em envio",
    completed: "concluida",
    cancelled: "cancelada"
  };
  return labels[value] || value;
}

function StatusPill({ status }: { status: string }) {
  return <span className="inline-flex w-fit items-center rounded-[8px] border border-[var(--admin-border)] px-2 py-1 text-xs font-semibold text-[var(--admin-text)]">{status}</span>;
}

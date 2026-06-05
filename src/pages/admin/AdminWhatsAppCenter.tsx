import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, FileText, MessageCircle, Search, Send, StickyNote, UserPlus, X } from "lucide-react";

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

export function AdminWhatsAppCenter() {
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
    <div className="grid min-h-[calc(100vh-150px)] gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
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
  );
}

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Filter, Kanban, MessageSquare, Plus, Send, Ticket as TicketIcon, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AdminDataTable, MetricCard } from "../../components/admin/AdminPremium";

type TicketStatus = "open" | "pending" | "in_progress" | "waiting_customer" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";
type TicketCategory = "financial" | "technical" | "sales" | "affiliate" | "other";

type SupportTicket = {
  id: string;
  tenant_id: string;
  ticket_number: string;
  customer_id: string;
  contact_id: string;
  source: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  assigned_user_id: string;
  created_at: string;
  updated_at: string;
  resolved_at: string;
  closed_at: string;
  sla_due_at: string;
  overdue?: boolean;
  messages?: Array<{ id: string; author_type: string; message: string; internal_note: boolean; created_at: string }>;
};

const statusLabels: Record<TicketStatus, string> = {
  open: "Aberto",
  pending: "Pendente",
  in_progress: "Em andamento",
  waiting_customer: "Aguardando cliente",
  resolved: "Resolvido",
  closed: "Fechado"
};

const statusColumns: TicketStatus[] = ["open", "pending", "in_progress", "waiting_customer", "resolved", "closed"];

const priorityLabels: Record<TicketPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente"
};

const categoryLabels: Record<TicketCategory, string> = {
  financial: "Financeiro",
  technical: "Técnico",
  sales: "Vendas",
  affiliate: "Afiliado",
  other: "Outros"
};

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function AdminTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [filters, setFilters] = useState({ status: "", priority: "", category: "", assignedUserId: "" });
  const [form, setForm] = useState({ subject: "", description: "", priority: "medium", category: "other", assignedUserId: "" });
  const [message, setMessage] = useState("");
  const [internalNote, setInternalNote] = useState(false);

  async function loadTickets() {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.category) params.set("category", filters.category);
    if (filters.assignedUserId) params.set("assignedUserId", filters.assignedUserId);
    const [ticketsResponse, dashboardResponse] = await Promise.all([
      fetch(`/api/admin/tickets?${params.toString()}`),
      fetch("/api/admin/tickets/dashboard")
    ]);
    const ticketsPayload = await ticketsResponse.json().catch(() => ({ tickets: [] }));
    const dashboardPayload = await dashboardResponse.json().catch(() => null);
    if (ticketsResponse.ok) setTickets(ticketsPayload.tickets || []);
    if (dashboardResponse.ok) setDashboard(dashboardPayload);
  }

  useEffect(() => {
    void loadTickets();
  }, [filters.status, filters.priority, filters.category, filters.assignedUserId]);

  async function createTicket() {
    if (!form.subject.trim() || !form.description.trim()) {
      toast.error("Assunto e descrição são obrigatórios");
      return;
    }
    const response = await fetch("/api/admin/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(payload.error || "Erro ao criar ticket");
      return;
    }
    toast.success("Ticket criado com SLA");
    setForm({ subject: "", description: "", priority: "medium", category: "other", assignedUserId: "" });
    setSelected(payload.ticket);
    await loadTickets();
  }

  async function updateTicket(ticket: SupportTicket, patch: Partial<SupportTicket>) {
    const response = await fetch(`/api/admin/tickets/${ticket.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(payload.error || "Erro ao atualizar ticket");
      return;
    }
    setSelected(payload.ticket);
    await loadTickets();
  }

  async function assignTicket(ticket: SupportTicket) {
    const assignedUserId = window.prompt("Responsável", ticket.assigned_user_id || "") || "";
    const response = await fetch(`/api/admin/tickets/${ticket.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedUserId })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.error || "Erro ao atribuir");
    toast.success("Ticket atribuído");
    setSelected(payload.ticket);
    await loadTickets();
  }

  async function resolveTicket(ticket: SupportTicket) {
    const response = await fetch(`/api/admin/tickets/${ticket.id}/resolve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Resolvido pelo painel" }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.error || "Erro ao resolver");
    setSelected(payload.ticket);
    await loadTickets();
  }

  async function closeTicket(ticket: SupportTicket) {
    const response = await fetch(`/api/admin/tickets/${ticket.id}/close`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Fechado pelo painel" }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.error || "Erro ao fechar");
    setSelected(payload.ticket);
    await loadTickets();
  }

  async function sendMessage() {
    if (!selected || !message.trim()) return;
    const response = await fetch(`/api/admin/tickets/${selected.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, internalNote, authorType: "agent" })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.error || "Erro ao enviar mensagem");
    setMessage("");
    setInternalNote(false);
    setSelected(payload.ticket);
    await loadTickets();
  }

  const byStatus = useMemo(() => Object.fromEntries(statusColumns.map(status => [status, tickets.filter(ticket => ticket.status === status)])) as Record<TicketStatus, SupportTicket[]>, [tickets]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-5">
        <MetricCard icon={TicketIcon} label="Abertos" value={dashboard?.open || 0} trend="tickets ativos" />
        <MetricCard icon={CheckCircle2} label="Resolvidos" value={dashboard?.resolved || 0} trend="SLA concluído" tone="success" />
        <MetricCard icon={AlertTriangle} label="Atrasados" value={dashboard?.overdue || 0} trend="SLA vencido" tone="danger" />
        <MetricCard icon={Clock3} label="1ª resposta" value={`${dashboard?.averageFirstResponseMinutes || 0} min`} trend="tempo médio" tone="warning" />
        <MetricCard icon={Clock3} label="Resolução" value={`${dashboard?.averageResolutionMinutes || 0} min`} trend="tempo médio" tone="accent" />
      </div>

      <section className="admin-card p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--admin-primary)]">Tickets e SLA Enterprise</p>
            <h2 className="mb-0 text-2xl font-black text-[var(--admin-text)]">Central de chamados</h2>
          </div>
          <div className="flex gap-2">
            <button type="button" className={view === "list" ? "admin-button-primary" : "admin-button-secondary"} onClick={() => setView("list")}><Filter className="h-4 w-4" /> Lista</button>
            <button type="button" className={view === "kanban" ? "admin-button-primary" : "admin-button-secondary"} onClick={() => setView("kanban")}><Kanban className="h-4 w-4" /> Kanban</button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 lg:grid-cols-4">
          <select className="admin-input" value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))}>
            <option value="">Todos status</option>
            {statusColumns.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
          <select className="admin-input" value={filters.priority} onChange={event => setFilters(current => ({ ...current, priority: event.target.value }))}>
            <option value="">Todas prioridades</option>
            {Object.entries(priorityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select className="admin-input" value={filters.category} onChange={event => setFilters(current => ({ ...current, category: event.target.value }))}>
            <option value="">Todas categorias</option>
            {Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <input className="admin-input" value={filters.assignedUserId} onChange={event => setFilters(current => ({ ...current, assignedUserId: event.target.value }))} placeholder="Responsável" />
        </div>

        <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_1.2fr_150px_160px_180px_auto]">
          <input className="admin-input" value={form.subject} onChange={event => setForm(current => ({ ...current, subject: event.target.value }))} placeholder="Assunto" />
          <input className="admin-input" value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="Descrição do chamado" />
          <select className="admin-input" value={form.priority} onChange={event => setForm(current => ({ ...current, priority: event.target.value }))}>
            {Object.entries(priorityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select className="admin-input" value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))}>
            {Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <input className="admin-input" value={form.assignedUserId} onChange={event => setForm(current => ({ ...current, assignedUserId: event.target.value }))} placeholder="Responsável" />
          <button type="button" className="admin-button-primary" onClick={() => void createTicket()}><Plus className="h-4 w-4" /> Criar</button>
        </div>

        {view === "kanban" ? (
          <div className="grid gap-3 xl:grid-cols-6">
            {statusColumns.map(status => (
              <div key={status} className="min-h-[360px] rounded-[8px] border border-[var(--admin-border)] bg-black/10 p-3" onDragOver={event => event.preventDefault()} onDrop={event => {
                const ticket = tickets.find(item => item.id === event.dataTransfer.getData("ticket-id"));
                if (ticket) void updateTicket(ticket, { status });
              }}>
                <p className="mb-3 text-sm font-black text-[var(--admin-text)]">{statusLabels[status]} <span className="text-[var(--admin-muted)]">({byStatus[status].length})</span></p>
                <div className="space-y-2">
                  {byStatus[status].map(ticket => <div key={ticket.id}><TicketCard ticket={ticket} onSelect={setSelected} /></div>)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AdminDataTable
            columns={["Ticket", "Status", "Prioridade", "Categoria", "SLA", "Responsável", "Ações"]}
            rows={tickets.map(ticket => [
              <button type="button" className="text-left" onClick={() => setSelected(ticket)}><strong>{ticket.ticket_number}</strong><p className="text-xs text-[var(--admin-muted)]">{ticket.subject}</p></button>,
              statusLabels[ticket.status],
              priorityLabels[ticket.priority],
              categoryLabels[ticket.category],
              <span className={ticket.overdue ? "font-bold text-rose-200" : ""}>{formatDate(ticket.sla_due_at)}</span>,
              ticket.assigned_user_id || "-",
              <div className="flex flex-wrap gap-2">
                <button type="button" className="admin-action-button" onClick={() => void assignTicket(ticket)}><UserPlus className="h-4 w-4" /></button>
                <button type="button" className="admin-action-button" onClick={() => void resolveTicket(ticket)}>Resolver</button>
                <button type="button" className="admin-action-button" onClick={() => void closeTicket(ticket)}>Fechar</button>
              </div>
            ])}
          />
        )}
      </section>

      {selected && (
        <section className="admin-card p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-[var(--admin-primary)]">{selected.ticket_number} · {selected.source}</p>
              <h2 className="mb-0 text-xl font-black text-[var(--admin-text)]">{selected.subject}</h2>
              <p className="text-sm text-[var(--admin-muted)]">SLA: {formatDate(selected.sla_due_at)} · {statusLabels[selected.status]}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="admin-button-secondary" onClick={() => void assignTicket(selected)}><UserPlus className="h-4 w-4" /> Atribuir</button>
              <button type="button" className="admin-button-primary" onClick={() => void resolveTicket(selected)}>Resolver</button>
              <button type="button" className="admin-button-secondary" onClick={() => void closeTicket(selected)}>Fechar</button>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="space-y-2">
              {(selected.messages || []).map(item => (
                <div key={item.id} className={`rounded-[8px] border p-3 text-sm ${item.internal_note ? "border-amber-300/30 bg-amber-300/10" : "border-[var(--admin-border)] bg-black/10"}`}>
                  <p className="mb-1 text-xs font-bold uppercase text-[var(--admin-muted)]">{item.author_type} · {formatDate(item.created_at)}{item.internal_note ? " · nota interna" : ""}</p>
                  <p className="whitespace-pre-wrap text-[var(--admin-text)]">{item.message}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <textarea className="admin-input min-h-[140px] w-full" value={message} onChange={event => setMessage(event.target.value)} placeholder="Responder ou registrar nota" />
              <label className="flex items-center gap-2 text-sm font-bold text-[var(--admin-text)]">
                <input type="checkbox" checked={internalNote} onChange={event => setInternalNote(event.target.checked)} />
                Nota interna
              </label>
              <button type="button" className="admin-button-primary w-full justify-center" onClick={() => void sendMessage()}><Send className="h-4 w-4" /> Enviar mensagem</button>
            </div>
          </div>
        </section>
      )}

      <section className="admin-card p-5">
        <h2 className="mb-3 text-lg font-black text-[var(--admin-text)]">Desempenho por agente</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {(dashboard?.byAgent || []).map((item: any) => (
            <div key={item.assignedUserId} className="rounded-[8px] border border-[var(--admin-border)] bg-black/10 p-3 text-sm">
              <p className="truncate font-black text-[var(--admin-text)]">{item.assignedUserId}</p>
              <p className="mt-2 text-[var(--admin-muted)]">Abertos: {item.open}</p>
              <p className="text-emerald-200">Resolvidos: {item.resolved}</p>
              <p className="text-rose-200">Atrasados: {item.overdue}</p>
            </div>
          ))}
          {!(dashboard?.byAgent || []).length && <p className="text-sm text-[var(--admin-muted)]">Nenhum agente com tickets ainda.</p>}
        </div>
      </section>
    </div>
  );
}

function TicketCard({ ticket, onSelect }: { ticket: SupportTicket; onSelect: (ticket: SupportTicket) => void }) {
  return (
    <button
      type="button"
      draggable
      onDragStart={event => event.dataTransfer.setData("ticket-id", ticket.id)}
      onClick={() => onSelect(ticket)}
      className="block w-full rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 text-left hover:border-[var(--admin-primary)]/50"
    >
      <p className="text-xs font-black text-[var(--admin-primary)]">{ticket.ticket_number}</p>
      <p className="mt-1 line-clamp-2 text-sm font-bold text-[var(--admin-text)]">{ticket.subject}</p>
      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-[var(--admin-muted)]">
        <span>{priorityLabels[ticket.priority]}</span>
        <span className={ticket.overdue ? "font-bold text-rose-200" : ""}>{formatDate(ticket.sla_due_at)}</span>
      </div>
      {ticket.overdue && <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-rose-200"><AlertTriangle className="h-3 w-3" /> SLA vencido</p>}
    </button>
  );
}

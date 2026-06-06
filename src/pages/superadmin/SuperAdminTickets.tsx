import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, Clock3, Ticket as TicketIcon, Users } from "lucide-react";
import { AdminDataTable, MetricCard } from "../../components/admin/AdminPremium";

type SuperTicket = {
  id: string;
  tenant_id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  assigned_user_id: string;
  sla_due_at: string;
  updated_at: string;
  overdue?: boolean;
  tenant?: { id: string; nome?: string; name?: string };
};

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function SuperAdminTickets() {
  const [tickets, setTickets] = useState<SuperTicket[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [status, setStatus] = useState("");

  async function load() {
    const [ticketsResponse, dashboardResponse] = await Promise.all([
      fetch("/api/superadmin/tickets"),
      fetch("/api/superadmin/tickets/dashboard")
    ]);
    const ticketsPayload = await ticketsResponse.json().catch(() => ({ tickets: [] }));
    const dashboardPayload = await dashboardResponse.json().catch(() => null);
    if (ticketsResponse.ok) setTickets(ticketsPayload.tickets || []);
    if (dashboardResponse.ok) setDashboard(dashboardPayload);
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => status ? tickets.filter(ticket => ticket.status === status) : tickets, [tickets, status]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-5">
        <MetricCard icon={TicketIcon} label="Abertos" value={dashboard?.open || 0} trend="todos tenants" />
        <MetricCard icon={CheckCircle2} label="Resolvidos" value={dashboard?.resolved || 0} trend="todos tenants" tone="success" />
        <MetricCard icon={AlertTriangle} label="Atrasados" value={dashboard?.overdue || 0} trend="SLA vencido" tone="danger" />
        <MetricCard icon={Clock3} label="1ª resposta" value={`${dashboard?.averageFirstResponseMinutes || 0} min`} trend="média global" tone="warning" />
        <MetricCard icon={Clock3} label="Resolução" value={`${dashboard?.averageResolutionMinutes || 0} min`} trend="média global" tone="accent" />
      </div>

      <section className="admin-card p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--admin-primary)]">SuperAdmin &gt; Tickets</p>
            <h2 className="mb-0 text-2xl font-black text-[var(--admin-text)]">SLA global por tenant</h2>
          </div>
          <select className="admin-input w-[220px]" value={status} onChange={event => setStatus(event.target.value)}>
            <option value="">Todos status</option>
            <option value="open">Abertos</option>
            <option value="pending">Pendentes</option>
            <option value="in_progress">Em andamento</option>
            <option value="waiting_customer">Aguardando cliente</option>
            <option value="resolved">Resolvidos</option>
            <option value="closed">Fechados</option>
          </select>
        </div>
        <AdminDataTable
          columns={["Tenant", "Ticket", "Status", "Prioridade", "SLA", "Responsável", "Atualizado"]}
          rows={filtered.map(ticket => [
            ticket.tenant?.nome || ticket.tenant?.name || ticket.tenant_id,
            <div><strong>{ticket.ticket_number}</strong><p className="text-xs text-[var(--admin-muted)]">{ticket.subject}</p></div>,
            ticket.status,
            ticket.priority,
            <span className={ticket.overdue ? "font-bold text-rose-200" : ""}>{formatDate(ticket.sla_due_at)}</span>,
            ticket.assigned_user_id || "-",
            formatDate(ticket.updated_at)
          ])}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="admin-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[var(--admin-primary)]" />
            <h2 className="mb-0 text-lg font-black text-[var(--admin-text)]">Desempenho por tenant</h2>
          </div>
          <div className="space-y-2">
            {(dashboard?.byTenant || []).map((item: any) => (
              <div key={item.tenantId} className="grid grid-cols-4 gap-3 rounded-[8px] border border-[var(--admin-border)] p-3 text-sm">
                <strong className="col-span-1 truncate text-[var(--admin-text)]">{item.tenantName}</strong>
                <span className="text-[var(--admin-muted)]">Abertos {item.open}</span>
                <span className="text-rose-200">Atrasados {item.overdue}</span>
                <span className="text-emerald-200">Resolvidos {item.resolved}</span>
              </div>
            ))}
            {!(dashboard?.byTenant || []).length && <p className="text-sm text-[var(--admin-muted)]">Nenhum ticket criado ainda.</p>}
          </div>
        </div>
        <div className="admin-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-5 w-5 text-[var(--admin-primary)]" />
            <h2 className="mb-0 text-lg font-black text-[var(--admin-text)]">Desempenho por agente</h2>
          </div>
          <div className="space-y-2">
            {(dashboard?.byAgent || []).map((item: any) => (
              <div key={item.assignedUserId} className="grid grid-cols-4 gap-3 rounded-[8px] border border-[var(--admin-border)] p-3 text-sm">
                <strong className="col-span-1 truncate text-[var(--admin-text)]">{item.assignedUserId}</strong>
                <span className="text-[var(--admin-muted)]">Abertos {item.open}</span>
                <span className="text-rose-200">Atrasados {item.overdue}</span>
                <span className="text-emerald-200">Resolvidos {item.resolved}</span>
              </div>
            ))}
            {!(dashboard?.byAgent || []).length && <p className="text-sm text-[var(--admin-muted)]">Nenhum agente com tickets ainda.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

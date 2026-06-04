import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BarChart3, Download, ExternalLink, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { AdminDataTable, AdminLoadingSkeleton, MetricCard } from "../../components/admin/AdminPremium";

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function SuperAdminTenantDetail() {
  const { tenantId = "" } = useParams();
  const [data, setData] = useState<any>(null);
  const [raffles, setRaffles] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [financeRes, rafflesRes, ordersRes] = await Promise.all([
        fetch(`/api/superadmin/tenants/${tenantId}/financeiro`),
        fetch(`/api/superadmin/tenants/${tenantId}/raffles`),
        fetch(`/api/superadmin/tenants/${tenantId}/orders`)
      ]);
      const finance = await financeRes.json();
      if (!financeRes.ok) throw new Error(finance.error || "Falha ao carregar financeiro");
      setData(finance);
      setRaffles(await rafflesRes.json());
      setOrders(await ordersRes.json());
    } catch (error) {
      toast.error("Falha no cliente", { description: error instanceof Error ? error.message : "Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [tenantId]);

  async function startSupport(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/superadmin/tenants/${tenantId}/impersonate/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(body.error || "Falha ao iniciar acesso assistido");
    window.location.href = body.redirectUrl;
  }

  if (loading || !data) return <AdminLoadingSkeleton />;
  const summary = data.report.summary;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/superadmin" className="text-sm text-[var(--admin-muted)]">← Voltar para clientes</Link>
          <h2 className="mt-1 text-2xl font-semibold text-[var(--admin-text)]">{data.tenant.nome}</h2>
        </div>
        <a className="admin-button-secondary" href={`/api/superadmin/tenants/${tenantId}/reports/revenue/export`}>
          <Download className="h-4 w-4" /> CSV financeiro
        </a>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Faturamento" value={money(summary.totalRevenue)} icon={BarChart3} tone="success" />
        <MetricCard label="Pedidos pagos" value={summary.paidOrders} icon={BarChart3} tone="primary" />
        <MetricCard label="Pendentes" value={summary.pendingOrders} icon={BarChart3} tone="warning" />
        <MetricCard label="Ticket médio" value={money(summary.averageTicket)} icon={BarChart3} tone="accent" />
      </div>

      <form onSubmit={startSupport} className="admin-card grid gap-3 p-5 md:grid-cols-[1fr_auto]">
        <label className="space-y-1 text-sm text-[var(--admin-muted)]">Motivo obrigatório para acesso assistido
          <input className="admin-input w-full" value={reason} onChange={event => setReason(event.target.value)} placeholder="Ex.: suporte solicitado pelo cliente para revisar pedidos" required />
        </label>
        <button className="admin-button-primary self-end" type="submit"><LifeBuoy className="h-4 w-4" /> Acessar como suporte</button>
      </form>

      <AdminDataTable
        columns={["Campanha", "Status", "Cotas", "Ações"]}
        rows={raffles.map(raffle => [
          raffle.title,
          raffle.status,
          `${raffle.soldTickets}/${raffle.totalTickets}`,
          <div key={raffle.id} className="flex gap-2">
            <a className="admin-button-secondary" href={`/raffle/${raffle.id}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Pública</a>
            <Link className="admin-button-secondary" to={`/admin/rifas`}>Editar rifa</Link>
          </div>
        ])}
      />

      <AdminDataTable
        columns={["Data", "Campanha", "Pedido", "Cliente", "Gateway", "Valor", "Status"]}
        rows={orders.slice(0, 40).map(order => [
          new Date(order.createdAt).toLocaleString("pt-BR"),
          order.campaign,
          order.orderId,
          order.customer,
          order.gateway,
          money(order.amount),
          order.status
        ])}
      />
    </div>
  );
}

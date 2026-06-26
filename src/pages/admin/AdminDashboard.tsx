import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BadgeDollarSign, Bell, Clock3, CreditCard, Database, FileBarChart, Link2, Mail, Megaphone, Plus, ReceiptText, Server, ShieldCheck, Ticket, TrendingUp, UserPlus } from "lucide-react";
import { AdminBadge, AdminButton, AdminCard, AdminEmptyState, AdminPage, AdminPageHeader, AdminProgress, AdminSection } from "../../components/ui/admin/AdminDesignSystem";
import { isPaidStatus, money, percent, useAdminConsolidatedData, type AdminPurchase } from "./adminDataConsolidation";

type SystemStatusPayload = { databaseConnected?: boolean; productionSafe?: boolean; persistenceMode?: string; warnings?: string[] };
type StatusRow = { label: string; status: "ok" | "warning" | "unknown"; detail?: string };

const quickActions = [
  { label: "Nova campanha", to: "/admin/campanhas", icon: Plus },
  { label: "Novo sorteio", to: "/admin/sorteios", icon: Megaphone },
  { label: "Gerar link", to: "/admin/afiliados", icon: Link2 },
  { label: "Novo usuario", to: "/admin/usuarios", icon: UserPlus },
  { label: "Relatorios", to: "/admin/relatorios", icon: FileBarChart }
];

function useSystemStatus() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SystemStatusPayload | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/system/status", { headers: { Accept: "application/json" } })
      .then(response => response.ok ? response.json() : null)
      .then(payload => { if (mounted) setStatus(payload && typeof payload === "object" ? payload : null); })
      .catch(() => { if (mounted) setStatus(null); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return { loading, status };
}
export function AdminDashboard() {
  const { loading, error, purchases, customers, affiliates, sales } = useAdminConsolidatedData();
  const system = useSystemStatus();
  const paidPurchases = useMemo(() => purchases.filter(purchase => isPaidStatus(purchase.status)), [purchases]);
  const recentOrders = useMemo(() => [...purchases].sort((a, b) => dateTime(b.createdAt || b.paidAt) - dateTime(a.createdAt || a.paidAt)).slice(0, 5), [purchases]);
  const maxDay = Math.max(1, ...sales.recentDailySales.map(day => day.amount));
  const maxCampaign = Math.max(1, ...sales.topCampaigns.map(campaign => campaign.amount));
  const statusRows = buildStatusRows(system.status, system.loading);

  return (
    <AdminPage className="rp-dashboard-page">
      <AdminPageHeader title="Dashboard" description="Visao geral da sua plataforma de rifas" actions={<><Link to="/admin/campanhas"><AdminButton>Nova campanha</AdminButton></Link><Link to="/admin/relatorios"><AdminButton variant="secondary">Relatorios</AdminButton></Link></>} />
      {error ? <AdminSection><p className="text-sm text-red-600">{error}</p></AdminSection> : null}

      <section className="rp-dashboard-kpis" aria-label="Indicadores principais">
        <DashboardKpi icon={<BadgeDollarSign className="h-4 w-4" />} label="Faturamento (mes)" value={loading ? "..." : money(sales.grossSales)} detail="Somente pedidos pagos" tone="blue" />
        <DashboardKpi icon={<ReceiptText className="h-4 w-4" />} label="Pedidos (mes)" value={loading ? "..." : sales.paidOrders.toLocaleString("pt-BR")} detail={`${sales.pendingOrders.toLocaleString("pt-BR")} pendente(s)`} tone="purple" />
        <DashboardKpi icon={<Ticket className="h-4 w-4" />} label="Numeros vendidos" value={loading ? "..." : paidPurchases.length.toLocaleString("pt-BR")} detail="Base em compras pagas" tone="blue" />
        <DashboardKpi icon={<TrendingUp className="h-4 w-4" />} label="Taxa de conversao" value={loading ? "..." : percent(sales.conversionRate)} detail="Pago sobre total de pedidos" tone="orange" />
        <DashboardKpi icon={<Clock3 className="h-4 w-4" />} label="Ticket medio" value={loading ? "..." : money(sales.averageTicket)} detail="Media de pedidos pagos" tone="red" />
      </section>

      <section className="rp-dashboard-main-grid">
        <AdminSection title="Faturamento" actions={<span className="rp-dashboard-filter">Ultimos 7 dias</span>}>
          <strong className="rp-dashboard-chart-value">{money(sales.grossSales)}</strong>
          {sales.recentDailySales.some(day => day.amount > 0) ? <div className="rp-dashboard-revenue-chart">{sales.recentDailySales.map(day => <RevenueBar key={day.key} label={day.label} value={day.amount} max={maxDay} />)}</div> : <AdminEmptyState title="Sem faturamento no periodo" description="Os dados aparecem aqui quando houver pedidos pagos." />}
        </AdminSection>

        <AdminSection title="Vendas por campanha">
          {sales.topCampaigns.length ? <div className="rp-dashboard-campaign-sales"><div className="rp-dashboard-donut" aria-hidden="true" /><div className="rp-dashboard-campaign-list">{sales.topCampaigns.slice(0, 5).map((campaign, index) => <CampaignLegend key={campaign.key} index={index} name={campaign.name} amount={campaign.amount} orders={campaign.orders} />)}</div></div> : <AdminEmptyState title="Nenhuma campanha com venda paga" description="As campanhas aparecem neste grafico apos a primeira venda confirmada." />}
        </AdminSection>

        <AdminSection title="Status do sistema"><div className="rp-dashboard-status-list">{statusRows.map(row => <SystemStatusRow key={row.label} row={row} />)}</div></AdminSection>
      </section>
      <section className="rp-dashboard-bottom-grid">
        <AdminSection title="Campanhas ativas">
          {sales.topCampaigns.length ? (
            <div className="rp-dashboard-table-wrap"><table className="rp-dashboard-table"><thead><tr><th>Campanha</th><th>Arrecadado</th><th>Pedidos</th><th>Meta</th><th>Progresso</th><th>Acoes</th></tr></thead><tbody>{sales.topCampaigns.map((campaign, index) => {
              const progress = Math.min(100, (campaign.amount / maxCampaign) * 100);
              return <tr key={campaign.key}><td><strong>{campaign.name}</strong><small>Posicao #{index + 1}</small></td><td>{money(campaign.amount)}</td><td>{campaign.orders.toLocaleString("pt-BR")}</td><td>{money(maxCampaign)}</td><td><div className="rp-dashboard-progress-cell"><AdminProgress value={progress} /><span>{Math.round(progress)}%</span></div></td><td><Link className="rp-dashboard-link" to="/admin/campanhas">Abrir</Link></td></tr>;
            })}</tbody></table></div>
          ) : <AdminEmptyState title="Sem campanhas para listar" description="Nenhuma campanha possui venda paga no periodo." />}
        </AdminSection>

        <div className="rp-dashboard-side-stack">
          <AdminSection title="Ultimos pedidos" actions={<Link className="rp-dashboard-link" to="/admin/pedidos">Ver todos</Link>}>
            {recentOrders.length ? <div className="rp-dashboard-orders">{recentOrders.map(order => <RecentOrder key={order.id} order={order} />)}</div> : <AdminEmptyState title="Nenhum pedido encontrado" description="Os ultimos pedidos aparecem aqui quando houver compras." />}
          </AdminSection>
          <AdminSection title="Atalhos rapidos">
            <div className="rp-dashboard-shortcuts">{quickActions.map(action => { const Icon = action.icon; return <Link key={action.to} to={action.to}><span><Icon className="h-5 w-5" /></span>{action.label}</Link>; })}</div>
            <div className="rp-dashboard-mini-summary"><span>Clientes unicos <strong>{customers.length.toLocaleString("pt-BR")}</strong></span><span>Afiliados ativos <strong>{affiliates.length.toLocaleString("pt-BR")}</strong></span></div>
          </AdminSection>
        </div>
      </section>
    </AdminPage>
  );
}

function DashboardKpi({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: ReactNode; detail: ReactNode; tone: "blue" | "purple" | "orange" | "red" }) {
  return <AdminCard className="rp-dashboard-kpi"><span className={`rp-dashboard-kpi-icon tone-${tone}`}>{icon}</span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></AdminCard>;
}

function RevenueBar({ label, value, max }: { key?: string; label: string; value: number; max: number }) {
  const height = Math.max(8, (value / max) * 100);
  return <div className="rp-dashboard-bar"><span>{money(value)}</span><i style={{ height: `${height}%` }} /><small>{label}</small></div>;
}

function CampaignLegend({ index, name, amount, orders }: { key?: string; index: number; name: string; amount: number; orders: number }) {
  return <div className="rp-dashboard-legend"><i className={`tone-${["blue", "purple", "orange", "green", "slate"][index] || "slate"}`} /><span><strong>{name}</strong><small>{money(amount)} ({orders} pedido(s))</small></span></div>;
}

function SystemStatusRow({ row }: { key?: string; row: StatusRow }) {
  const Icon = row.label.includes("Banco") ? Database : row.label.includes("Fila") ? Mail : row.label.includes("Storage") ? CreditCard : row.label.includes("Webhook") ? Bell : row.label.includes("Gateway") ? ShieldCheck : Server;
  const tone = row.status === "ok" ? "success" : row.status === "warning" ? "warning" : "slate";
  const label = row.status === "ok" ? "Operacional" : row.status === "warning" ? "Atencao" : "Nao validado";
  return <div className="rp-dashboard-status-row"><span><Icon className="h-4 w-4" />{row.label}</span><AdminBadge tone={tone}>{label}</AdminBadge>{row.detail ? <small>{row.detail}</small> : null}</div>;
}

function RecentOrder({ order }: { key?: string; order: AdminPurchase }) {
  const paid = isPaidStatus(order.status);
  return <div className="rp-dashboard-order"><span><strong>#{order.orderId}</strong><small>{order.customer.name || "Cliente"}</small></span><span>{money(order.amount)}</span><AdminBadge tone={paid ? "success" : "warning"}>{paid ? "Aprovado" : "Pendente"}</AdminBadge><small>{dateLabel(order.createdAt || order.paidAt)}</small></div>;
}
function buildStatusRows(status: SystemStatusPayload | null, loading: boolean): StatusRow[] {
  const labels = ["API RifaPro", "Gateway Asaas (PIX)", "Webhook", "Banco de dados", "Fila de e-mails", "Storage"];
  if (loading) return labels.map(label => ({ label, status: "unknown" }));
  if (!status) return labels.map(label => ({ label, status: "unknown", detail: "Endpoint sem resposta nesta sessao" }));
  const warning = status.warnings?.[0] || "";
  return [
    { label: "API RifaPro", status: "ok" },
    { label: "Gateway Asaas (PIX)", status: "unknown", detail: "Status nao exposto por este endpoint" },
    { label: "Webhook", status: status.productionSafe === false ? "warning" : "ok", detail: status.productionSafe === false ? warning : undefined },
    { label: "Banco de dados", status: status.databaseConnected === false ? "warning" : "ok", detail: status.persistenceMode },
    { label: "Fila de e-mails", status: "unknown", detail: "Status nao exposto por este endpoint" },
    { label: "Storage", status: "unknown", detail: "Status nao exposto por este endpoint" }
  ];
}

function dateTime(value: string) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function dateLabel(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

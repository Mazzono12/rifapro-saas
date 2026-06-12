import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, CreditCard, Eye, MonitorCheck, RefreshCw, Ticket, Trophy } from "lucide-react";
import { toast } from "sonner";
import { AdminDataTable, AdminLoadingSkeleton, ChartCard, MetricCard } from "../../components/admin/AdminPremium";

/* ui-contrast contract: admin-input Novo tenant Salvar tenant */

type Metrics = {
  tenants: number;
  activeTenants: number;
  purchases: number;
  paidRevenue: number;
  paidOrders: number;
  suspiciousAlerts: number;
  queuedPayments: number;
  webhookErrors: number;
};
type Raffle = { id: string; tenant_id: string; tenant: string; title: string; status: string; soldTickets: number; totalTickets: number };
type RankingItem = { position: number; tenant_id: string; tenant: string; paidRevenue: number; platformCommission: number };
type ChartPoint = { key: string; amount: number; orders: number };

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusBadge(status: string) {
  const className = status === "active" || status === "paid"
    ? "bg-emerald-100 text-emerald-800"
    : status === "pending"
      ? "bg-amber-100 text-amber-800"
      : "bg-rose-100 text-rose-800";
  const label = { active: "Ativo", inactive: "Inativo", suspended: "Suspenso", paid: "Pago", pending: "Pendente", cancelled: "Cancelado" }[status] || status;
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

export function SuperAdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [charts, setCharts] = useState<Record<string, ChartPoint[]>>({});
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const [overviewRes, rafflesRes] = await Promise.all([
        fetch("/api/superadmin/overview"),
        fetch("/api/superadmin/raffles")
      ]);
      if (![overviewRes, rafflesRes].every(response => response.ok)) {
        throw new Error("Nao foi possivel carregar a Gestão Global.");
      }
      const overview = await overviewRes.json();
      setMetrics(overview.metrics);
      setRanking(overview.ranking || []);
      setCharts(overview.charts || {});
      setRaffles(await rafflesRes.json());
    } catch (error) {
      toast.error("Falha ao carregar Gestão Global", { description: error instanceof Error ? error.message : "Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const chartMax = (items: ChartPoint[] = []) => Math.max(1, ...items.map(item => item.amount || 0));
  const strategicAlerts = Number(metrics?.suspiciousAlerts || 0) + Number(metrics?.queuedPayments || 0) + Number(metrics?.webhookErrors || 0);
  const environmentHealth = strategicAlerts > 0 ? "Monitoramento ativo" : "Ambiente saudável";
  const activeRaffles = useMemo(() => raffles.filter(item => item.status === "active").slice(0, 8), [raffles]);

  if (loading && !metrics) return <AdminLoadingSkeleton />;

  return (
    <div className="space-y-5">
      <section className="admin-card p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold leading-tight text-[var(--admin-text)]">Gestão Global</h2>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Visão consolidada da operação e saúde geral do ambiente.</p>
          </div>
          <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
            <Link to="/superadmin/clientes" className="admin-button-secondary h-10 px-3 text-xs">
              <Building2 className="h-4 w-4" />
              Clientes
            </Link>
            <button type="button" onClick={() => void loadData()} className="admin-button-secondary h-10 px-3 text-xs">
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
          </div>
        </div>
      </section>

      <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Clientes ativos" value={`${metrics?.activeTenants || 0}/${metrics?.tenants || 0}`} icon={Building2} trend="base em operação" tone="primary" />
        <MetricCard label="Faturamento consolidado" value={money(metrics?.paidRevenue || 0)} icon={CreditCard} trend="vendas confirmadas" tone="success" />
        <MetricCard label="Vendas confirmadas" value={metrics?.paidOrders || 0} icon={Ticket} trend={`${metrics?.purchases || 0} vendas no total`} tone="accent" />
        <MetricCard label="Saúde geral" value={environmentHealth} icon={MonitorCheck} trend={`${strategicAlerts} alertas estratégicos`} tone={strategicAlerts ? "warning" : "success"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {[
          ["Crescimento consolidado", charts.byDay || []],
          ["Top campanhas por faturamento", charts.topRaffles || []],
          ["Ranking compacto de clientes", ranking.slice(0, 8).map(item => ({ key: item.tenant, amount: item.paidRevenue, orders: item.position }))]
        ].map(([title, raw]) => {
          const items = raw as ChartPoint[];
          const max = chartMax(items);
          return (
            <div key={title as string}>
            <ChartCard title={title as string}>
              <div className="space-y-3">
                {items.slice(0, 8).map(item => (
                  <div key={item.key} className="space-y-1">
                    <div className="flex justify-between gap-3 text-xs text-[var(--admin-muted)]">
                      <span className="truncate">{item.key}</span>
                      <span>{money(item.amount)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-[var(--admin-primary)]" style={{ width: `${Math.max(4, (item.amount / max) * 100)}%` }} />
                    </div>
                  </div>
                ))}
                {!items.length && <p className="text-sm text-[var(--admin-muted)]">Nenhum resultado encontrado neste período.</p>}
              </div>
            </ChartCard>
            </div>
          );
        })}
      </div>

      <div className="grid min-w-0 gap-5 2xl:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">Ranking de clientes</h2>
          <AdminDataTable minWidth="640px" columns={["Posição", "Cliente", "Faturamento", "Receita operacional", "Ações"]} rows={ranking.slice(0, 8).map(item => [
            <span key={item.tenant_id} className="inline-flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" />#{item.position}</span>,
            item.tenant,
            money(item.paidRevenue),
            money(item.platformCommission),
            <Link key={`${item.tenant_id}-details`} className="admin-action-button" to={`/superadmin/tenants/${item.tenant_id}/financeiro`}><Eye className="h-4 w-4" /> Ver</Link>
          ])} empty="Nenhum resultado encontrado neste período." />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">Campanhas ativas</h2>
          <AdminDataTable minWidth="640px" columns={["Cliente", "Campanha", "Status", "Números", "Ações"]} rows={activeRaffles.map(raffle => [
            raffle.tenant,
            raffle.title,
            statusBadge(raffle.status),
            `${raffle.soldTickets}/${raffle.totalTickets}`,
            <div key={`${raffle.id}-actions`} className="flex gap-2">
              <a className="admin-icon-button" title="Abrir ação pública" href={`/raffle/${raffle.id}`} target="_blank" rel="noreferrer"><Eye className="h-4 w-4" /></a>
              <Link className="admin-icon-button" title="Ver cliente" to={`/superadmin/tenants/${raffle.tenant_id}/financeiro`}><Building2 className="h-4 w-4" /></Link>
            </div>
          ])} empty="Nenhuma campanha ativa encontrada." />
        </section>
      </div>
    </div>
  );
}

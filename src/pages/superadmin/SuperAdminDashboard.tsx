import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Eye,
  FileText,
  Globe2,
  MonitorCheck,
  RefreshCw,
  Ticket,
  Trophy
} from "lucide-react";
import { toast } from "sonner";
import { AdminLoadingSkeleton } from "../../components/admin/AdminPremium";

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

type Raffle = {
  id: string;
  tenant_id: string;
  tenant: string;
  title: string;
  status: string;
  soldTickets: number;
  totalTickets: number;
};

type RankingItem = {
  position: number;
  tenant_id: string;
  tenant: string;
  paidRevenue: number;
  platformCommission: number;
};

type ChartPoint = { key: string; amount: number; orders: number };

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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
      const rafflesPayload = await rafflesRes.json();
      setMetrics(overview.metrics || null);
      setRanking(Array.isArray(overview.ranking) ? overview.ranking : []);
      setCharts(overview.charts || {});
      setRaffles(Array.isArray(rafflesPayload) ? rafflesPayload : []);
    } catch (error) {
      toast.error("Falha ao carregar Gestão Global", { description: error instanceof Error ? error.message : "Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const activeRaffles = useMemo(() => raffles.filter(item => item.status === "active"), [raffles]);
  const strategicAlerts = Number(metrics?.suspiciousAlerts || 0) + Number(metrics?.queuedPayments || 0) + Number(metrics?.webhookErrors || 0);
  const revenueByDay = charts.byDay || [];
  const maxRevenue = Math.max(1, ...revenueByDay.map(item => Number(item.amount || 0)));
  const topTenants = ranking.slice(0, 6);

  if (loading && !metrics) return <AdminLoadingSkeleton />;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-text)]">Gestão Global</h1>
          <p className="text-sm text-[var(--admin-muted)]">Resumo executivo dos tenants, receita e saúde da plataforma.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/superadmin/clientes" className="admin-button-secondary h-9 px-3 text-sm">
            Clientes
          </Link>
          <button type="button" onClick={() => void loadData()} className="admin-button h-9 px-3 text-sm">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
      </div>

      <div className="w-full overflow-x-auto pb-1">
        <div className="admin-tabs inline-flex">
          <button className="admin-tab is-active" type="button">Overview</button>
          <Link className="admin-tab" to="/superadmin/clientes">Tenants</Link>
          <Link className="admin-tab" to="/superadmin/relatorios">Relatórios</Link>
          <Link className="admin-tab" to="/superadmin/auditoria">Auditoria</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="Tenants ativos" value={`${metrics?.activeTenants || 0}/${metrics?.tenants || 0}`} detail="clientes em operação" icon={Building2} />
        <DashboardCard title="Receita consolidada" value={currency.format(metrics?.paidRevenue || 0)} detail={`${metrics?.paidOrders || 0} pedidos pagos`} icon={CreditCard} />
        <DashboardCard title="Pedidos da plataforma" value={metrics?.purchases || 0} detail="compras registradas" icon={Ticket} />
        <DashboardCard title="Saúde operacional" value={strategicAlerts ? "Atenção" : "Saudável"} detail={`${strategicAlerts} alerta(s) aberto(s)`} icon={strategicAlerts ? AlertTriangle : CheckCircle2} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <section className="admin-card p-6 lg:col-span-4">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-[var(--admin-text)]">Overview</h2>
            <p className="text-sm text-[var(--admin-muted)]">Receita consolidada por período.</p>
          </div>
          <div className="flex h-72 items-end gap-3 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-4">
            {revenueByDay.length ? revenueByDay.slice(-7).map(item => (
              <div key={item.key} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2">
                <div className="flex flex-1 items-end">
                  <div
                    className="w-full rounded-md bg-[var(--admin-primary)]"
                    style={{ height: `${Math.max(6, (Number(item.amount || 0) / maxRevenue) * 100)}%` }}
                    title={`${item.key}: ${currency.format(item.amount || 0)}`}
                  />
                </div>
                <span className="truncate text-center text-xs text-[var(--admin-muted)]">{item.key}</span>
              </div>
            )) : (
              <SmallEmptyState text="Nenhum indicador de receita disponível." />
            )}
          </div>
        </section>

        <section className="admin-card p-6 lg:col-span-3">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--admin-text)]">Ranking de tenants</h2>
              <p className="text-sm text-[var(--admin-muted)]">Clientes com maior receita.</p>
            </div>
            <Link to="/superadmin/relatorios" className="admin-link inline-flex items-center gap-1 text-sm font-medium">
              Ver relatórios <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-4">
            {topTenants.length ? topTenants.map(item => (
              <article key={item.tenant_id} className="flex items-center gap-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--admin-secondary)] text-sm font-semibold text-[var(--admin-text)]">
                  #{item.position}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--admin-text)]">{item.tenant}</p>
                  <p className="truncate text-xs text-[var(--admin-muted)]">Comissão: {currency.format(item.platformCommission || 0)}</p>
                </div>
                <p className="text-sm font-medium text-[var(--admin-text)]">{currency.format(item.paidRevenue || 0)}</p>
              </article>
            )) : (
              <SmallEmptyState text="Nenhum tenant ranqueado ainda." />
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <section className="admin-card p-6 lg:col-span-4">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-[var(--admin-text)]">Ações rápidas</h2>
            <p className="text-sm text-[var(--admin-muted)]">Atalhos de operação global.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <QuickAction to="/superadmin/clientes" icon={Building2} label="Tenants" />
            <QuickAction to="/superadmin/dominios" icon={Globe2} label="Domínios" />
            <QuickAction to="/superadmin/relatorios" icon={FileText} label="Relatórios" />
            <QuickAction to="/superadmin/auditoria" icon={MonitorCheck} label="Auditoria" />
          </div>
        </section>

        <section className="admin-card p-6 lg:col-span-3">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--admin-text)]">Alertas da plataforma</h2>
              <p className="text-sm text-[var(--admin-muted)]">Monitoramento técnico e financeiro.</p>
            </div>
            <AlertTriangle className="h-4 w-4 text-[var(--admin-muted)]" />
          </div>
          <div className="space-y-2">
            <AlertRow label="Alertas suspeitos" value={metrics?.suspiciousAlerts || 0} />
            <AlertRow label="Pagamentos em fila" value={metrics?.queuedPayments || 0} />
            <AlertRow label="Erros de webhook" value={metrics?.webhookErrors || 0} />
          </div>
        </section>
      </div>

      <section className="admin-card p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--admin-text)]">Campanhas ativas</h2>
            <p className="text-sm text-[var(--admin-muted)]">Campanhas em operação nos tenants.</p>
          </div>
          <Link to="/superadmin/clientes" className="admin-link inline-flex items-center gap-1 text-sm font-medium">
            Ver tenants <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {activeRaffles.length ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {activeRaffles.slice(0, 9).map(raffle => (
              <div key={raffle.id} className="admin-list-row rounded-md border border-[var(--admin-border)] px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--admin-text)]">{raffle.title}</p>
                  <p className="truncate text-xs text-[var(--admin-muted)]">{raffle.tenant} · {raffle.soldTickets}/{raffle.totalTickets}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <a className="admin-icon-button" title="Abrir campanha" href={`/raffle/${raffle.id}`} target="_blank" rel="noreferrer">
                    <Eye className="h-4 w-4" />
                  </a>
                  <Link className="admin-icon-button" title="Ver tenant" to={`/superadmin/tenants/${raffle.tenant_id}/financeiro`}>
                    <Building2 className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <SmallEmptyState text="Nenhuma campanha ativa encontrada." />
        )}
      </section>
    </div>
  );
}

function DashboardCard({ icon: Icon, title, value, detail }: { icon: any; title: string; value: string | number; detail: string }) {
  return (
    <section className="admin-card p-6">
      <div className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="text-sm font-medium text-[var(--admin-text)]">{title}</h3>
        <Icon className="h-4 w-4 text-[var(--admin-muted)]" />
      </div>
      <div className="text-2xl font-bold tracking-tight text-[var(--admin-text)]">{value}</div>
      <p className="text-xs text-[var(--admin-muted)]">{detail}</p>
    </section>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link to={to} className="admin-quick-action flex min-h-[72px] items-center gap-3 rounded-md border border-[var(--admin-border)] p-3 transition">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--admin-secondary)] text-[var(--admin-text)]">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-medium text-[var(--admin-text)]">{label}</span>
    </Link>
  );
}

function AlertRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-3">
      <span className="text-sm text-[var(--admin-text)]">{label}</span>
      <span className={`admin-status-badge ${value > 0 ? "is-warning" : "is-success"}`}>{value}</span>
    </div>
  );
}

function SmallEmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-4 text-sm text-[var(--admin-muted)]">
      {text}
    </div>
  );
}

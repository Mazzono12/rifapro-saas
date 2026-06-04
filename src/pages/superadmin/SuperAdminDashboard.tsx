import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, CreditCard, Eye, LifeBuoy, LogIn, MonitorCheck, Palette, Pencil, Plus, RefreshCw, SlidersHorizontal, Ticket, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { AdminDataTable, AdminLoadingSkeleton, MetricCard, ChartCard } from "../../components/admin/AdminPremium";

type TenantStatus = "trial" | "active" | "suspended" | "overdue" | "maintenance" | "blocked" | "canceled" | "inactive";
type Tenant = {
  id: string;
  nome: string;
  slug: string;
  dominio_customizado: string;
  status: TenantStatus;
  cor_primaria: string;
  plano: string;
  percentual_plataforma: number;
  raffleCount: number;
  purchaseCount: number;
  paidRevenue: number;
  platformCommission: number;
  pendingPix: number;
  activeRaffles: number;
  webhookErrors: number;
  suspiciousAlerts: number;
  queuedPayments: number;
};
type Metrics = {
  tenants: number;
  activeTenants: number;
  raffles: number;
  purchases: number;
  paidRevenue: number;
  platformCommission: number;
  pendingPix: number;
  inactiveTenants: number;
  revenueToday: number;
  revenueLast7Days: number;
  revenueCurrentMonth: number;
  revenueCurrentYear: number;
  paidOrders: number;
  pendingOrders: number;
  averageTicket: number;
  conversionRate: number;
  activeRaffles: number;
  webhookErrors: number;
  suspiciousAlerts: number;
  queuedPayments: number;
};
type Raffle = { id: string; tenant_id: string; tenant: string; title: string; status: string; soldTickets: number; totalTickets: number; price: number };
type Sale = { id: string; tenant: string; product: string; channel: string; customer: string; amount: number; status: string; createdAt: string };
type PixPayment = { id: string; tenant: string; customer: string; gateway: string; amount: number; status: string; createdAt: string };
type Commission = { tenant_id: string; tenant: string; percentual: number; paidRevenue: number; platformCommission: number };
type Plan = { id: string; nome: string; limite_rifas: number; limite_vendas_mes: number; dominio_proprio: boolean; percentual_comissao: number };
type RankingItem = { position: number; tenant_id: string; tenant: string; paidRevenue: number; platformCommission: number };
type ChartPoint = { key: string; amount: number; orders: number };
type TenantForm = {
  id?: string;
  nome: string;
  slug: string;
  dominio_customizado: string;
  plano: string;
  percentual_plataforma: number;
  cor_primaria: string;
};

const emptyForm: TenantForm = {
  nome: "",
  slug: "",
  dominio_customizado: "",
  plano: "basico",
  percentual_plataforma: 0,
  cor_primaria: "#06b6d4"
};

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function paymentMethodLabel(value: string) {
  const normalized = String(value || "").toLowerCase();
  const labels: Record<string, string> = {
    asaas: "PIX Asaas",
    pay2m: "PIX Pay2M",
    pagbank: "PIX PagBank",
    mercadopago: "PIX Mercado Pago",
    mercado_pago: "PIX Mercado Pago",
    cora: "PIX Cora",
    primepag: "PIX Primepag",
    pix: "PIX"
  };
  return labels[normalized] || value || "Meio de pagamento";
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
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<PixPayment[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [charts, setCharts] = useState<Record<string, ChartPoint[]>>({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<TenantForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [impersonatingTenant, setImpersonatingTenant] = useState<Tenant | null>(null);
  const [supportReason, setSupportReason] = useState("");
  const [accessingTenantId, setAccessingTenantId] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [overviewRes, rafflesRes, salesRes, commissionsRes, paymentsRes] = await Promise.all([
        fetch("/api/superadmin/overview"),
        fetch("/api/superadmin/raffles"),
        fetch("/api/superadmin/sales"),
        fetch("/api/superadmin/commissions"),
        fetch("/api/superadmin/payments/pix")
      ]);
      if (![overviewRes, rafflesRes, salesRes, commissionsRes, paymentsRes].every(response => response.ok)) {
        throw new Error("Nao foi possivel carregar os dados da Gestão Global.");
      }
      const overview = await overviewRes.json();
      const commissionData = await commissionsRes.json();
      setMetrics(overview.metrics);
      setTenants(overview.tenants);
      setPlans(overview.plans || []);
      setRanking(overview.ranking || []);
      setCharts(overview.charts || {});
      setRaffles(await rafflesRes.json());
      setSales(await salesRes.json());
      setCommissions(commissionData.byTenant);
      setPayments(await paymentsRes.json());
    } catch (error) {
      toast.error("Falha ao carregar Gestão Global", { description: error instanceof Error ? error.message : "Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function submitTenant(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const url = form.id ? `/api/superadmin/tenants/${form.id}` : "/api/superadmin/tenants";
      const response = await fetch(url, {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Falha ao salvar cliente.");
      toast.success(form.id ? "Cliente atualizado" : "Cliente criado");
      setForm(null);
      await loadData();
    } catch (error) {
      toast.error("Nao foi possivel salvar", { description: error instanceof Error ? error.message : "Tente novamente." });
    } finally {
      setSaving(false);
    }
  }

  async function toggleSuspension(tenant: Tenant) {
    const status: TenantStatus = tenant.status === "suspended" ? "active" : "suspended";
    const response = await fetch(`/api/superadmin/tenants/${tenant.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (!response.ok) {
      toast.error("Nao foi possivel alterar o status.");
      return;
    }
    toast.success(status === "suspended" ? "Cliente suspenso" : "Cliente reativado");
    await loadData();
  }

  async function startSupport(event: FormEvent) {
    event.preventDefault();
    if (!impersonatingTenant) return;
    const response = await fetch(`/api/superadmin/tenants/${impersonatingTenant.id}/impersonate/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: supportReason })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error || "Nao foi possivel iniciar o acesso assistido.");
      return;
    }
    window.location.href = body.redirectUrl;
  }

  async function enterTenantEnvironment(tenant: Tenant) {
    setAccessingTenantId(tenant.id);
    try {
      const response = await fetch(`/api/superadmin/tenants/${tenant.id}/impersonate/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: `Entrada no ambiente do cliente ${tenant.nome} via Gestão Global` })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(body.error || "Não foi possível entrar no ambiente do cliente.");
        return;
      }
      window.location.href = body.redirectUrl;
    } finally {
      setAccessingTenantId("");
    }
  }

  const recentSales = useMemo(() => sales.slice(0, 12), [sales]);
  const chartMax = (items: ChartPoint[] = []) => Math.max(1, ...items.map(item => item.amount || 0));
  const strategicAlerts = Number(metrics?.suspiciousAlerts || 0) + Number(metrics?.queuedPayments || 0) + Number(metrics?.webhookErrors || 0);
  const environmentHealth = strategicAlerts > 0 ? "Monitoramento ativo" : "Ambiente saudável";
  if (loading && !metrics) return <AdminLoadingSkeleton />;

  return (
    <div className="space-y-5">
      <section className="admin-card p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold leading-tight text-[var(--admin-text)]">Gestão Global</h2>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Resumo consolidado</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[380px]">
            <button type="button" onClick={() => setForm({ ...emptyForm })} className="admin-button-primary">
              <Plus className="h-4 w-4" />
              Novo cliente
            </button>
            <button type="button" onClick={() => void loadData()} className="admin-button-secondary">
              <RefreshCw className="h-4 w-4" />
              Atualizar visão
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Clientes ativos" value={`${metrics?.activeTenants || 0}/${metrics?.tenants || 0}`} icon={Building2} trend="base em operação" tone="primary" />
        <MetricCard label="Faturamento consolidado" value={money(metrics?.paidRevenue || 0)} icon={CreditCard} trend="vendas confirmadas" tone="success" />
        <MetricCard label="Vendas Confirmadas" value={metrics?.paidOrders || 0} icon={Ticket} trend={`${metrics?.purchases || 0} vendas no total`} tone="accent" />
        <MetricCard label="Saúde Geral" value={environmentHealth} icon={MonitorCheck} trend={`${strategicAlerts} alertas estratégicos`} tone={strategicAlerts ? "warning" : "success"} />
      </div>

      <section id="clientes" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">Contas</h2>
          </div>
          <button type="button" onClick={() => void loadData()} className="admin-button-secondary" title="Atualizar ambientes">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tenants.length ? tenants.map(tenant => (
            <div key={tenant.id} className="admin-card flex min-h-[172px] flex-col justify-between p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] text-sm font-black text-white" style={{ backgroundColor: tenant.cor_primaria || "#06b6d4" }}>
                  {tenant.nome.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-[var(--admin-text)]">{tenant.nome}</h3>
                  <p className="truncate text-xs text-[var(--admin-muted)]">Plano {tenant.plano}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {statusBadge(tenant.status)}
                    <span className="inline-flex rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-[var(--admin-muted)]">{tenant.plano}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-[var(--admin-muted)]">
                <span><strong className="block text-sm text-[var(--admin-text)]">{tenant.raffleCount}</strong>Campanhas</span>
                <span><strong className="block text-sm text-[var(--admin-text)]">{tenant.purchaseCount}</strong>Vendas</span>
                <span><strong className="block text-sm text-[var(--admin-text)]">{money(tenant.paidRevenue)}</strong>Faturamento</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="admin-button-primary flex-1 justify-center" disabled={accessingTenantId === tenant.id} onClick={() => void enterTenantEnvironment(tenant)}>
                  <LogIn className="h-4 w-4" />
                  {accessingTenantId === tenant.id ? "Entrando..." : "Entrar no ambiente"}
                </button>
                <Link className="admin-icon-button" title="Financeiro do cliente" to={`/superadmin/tenants/${tenant.id}/financeiro`}><Eye className="h-4 w-4" /></Link>
              </div>
            </div>
          )) : (
            <div className="admin-card p-5 text-sm text-[var(--admin-muted)] md:col-span-2 xl:col-span-3">
              Nenhum registro encontrado.
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        {[
          ["Crescimento consolidado", charts.byDay || []],
          ["Performance por meio de pagamento", charts.byGateway || []],
          ["Top campanhas por faturamento", charts.topRaffles || []]
        ].map(([title, raw]) => {
          const items = raw as ChartPoint[];
          const max = chartMax(items);
          const isPaymentPerformance = title === "Performance por meio de pagamento";
          return (
            <div key={title as string}>
              <ChartCard title={title as string}>
                <div className="space-y-3">
                  {items.slice(0, 8).map(item => (
                    <div key={item.key} className="space-y-1">
                      <div className="flex justify-between gap-3 text-xs text-[var(--admin-muted)]">
                        <span className="truncate">{isPaymentPerformance ? paymentMethodLabel(item.key) : item.key}</span>
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">Ranking de clientes</h2>
        <AdminDataTable columns={["Posição", "Cliente", "Faturamento", "Receita operacional"]} rows={ranking.map(item => [
          <span key={item.tenant_id} className="inline-flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" />#{item.position}</span>,
          item.tenant,
          money(item.paidRevenue),
          money(item.platformCommission)
        ])} empty="Nenhum resultado encontrado neste período." />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">Clientes</h2>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void loadData()} className="admin-button-secondary" title="Atualizar">
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
            <button type="button" onClick={() => setForm({ ...emptyForm })} className="admin-button-primary">
              <Plus className="h-4 w-4" />
              Novo cliente
            </button>
          </div>
        </div>
        <AdminDataTable
          columns={["Cliente", "Status", "Plano", "Campanhas", "Vendas", "Faturamento", "Receita operacional", "Ações"]}
          rows={tenants.map(tenant => [
            <div key={tenant.id}><p className="font-semibold">{tenant.nome}</p><p className="text-xs text-[var(--admin-muted)]">Ambiente profissional</p></div>,
            statusBadge(tenant.status),
            tenant.plano,
            tenant.raffleCount,
            tenant.purchaseCount,
            money(tenant.paidRevenue),
            money(tenant.platformCommission),
            <div key={`${tenant.id}-actions`} className="flex gap-2">
              <Link className="admin-icon-button" title="Ver financeiro" to={`/superadmin/tenants/${tenant.id}/financeiro`}><Eye className="h-4 w-4" /></Link>
              <Link className="admin-icon-button" title="Aparência" to={`/superadmin/tenants/${tenant.id}/aparencia`}><Palette className="h-4 w-4" /></Link>
              <Link className="admin-icon-button" title="Plano e Recursos" to={`/superadmin/tenants/${tenant.id}/plano`}><SlidersHorizontal className="h-4 w-4" /></Link>
              <button type="button" className="admin-icon-button" title="Entrar no ambiente" disabled={accessingTenantId === tenant.id} onClick={() => void enterTenantEnvironment(tenant)}><LogIn className="h-4 w-4" /></button>
              <button type="button" className="admin-icon-button" title="Acessar como suporte" onClick={() => { setImpersonatingTenant(tenant); setSupportReason(""); }}><LifeBuoy className="h-4 w-4" /></button>
              <button type="button" className="admin-icon-button" title="Editar Cliente" onClick={() => setForm({ ...tenant })}><Pencil className="h-4 w-4" /></button>
              <button type="button" className="admin-button-secondary" onClick={() => void toggleSuspension(tenant)}>
                {tenant.status === "suspended" ? "Reativar" : "Suspender"}
              </button>
            </div>
          ])}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">Campanhas ativas</h2>
          <AdminDataTable columns={["Cliente", "Campanha", "Status", "Números", "Ações"]} rows={raffles.map(raffle => [
            raffle.tenant,
            raffle.title,
            statusBadge(raffle.status),
            `${raffle.soldTickets}/${raffle.totalTickets}`,
            <div key={`${raffle.id}-actions`} className="flex gap-2">
              <a className="admin-icon-button" title="Abrir ação pública" href={`/raffle/${raffle.id}`} target="_blank" rel="noreferrer"><Eye className="h-4 w-4" /></a>
              <Link className="admin-icon-button" title="Ver cliente" to={`/superadmin/tenants/${raffle.tenant_id}/financeiro`}><Building2 className="h-4 w-4" /></Link>
            </div>
          ])} />
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">Receita operacional</h2>
          <AdminDataTable columns={["Cliente", "Percentual", "Faturamento", "Receita"]} rows={commissions.map(item => [
            item.tenant,
            `${item.percentual}%`,
            money(item.paidRevenue),
            money(item.platformCommission)
          ])} />
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">Vendas consolidadas</h2>
        <AdminDataTable columns={["Data", "Cliente", "Produto", "Comprador", "Canal", "Valor", "Status"]} rows={recentSales.map(sale => [
          dateTime(sale.createdAt), sale.tenant, sale.product, sale.customer, sale.channel, money(sale.amount), statusBadge(sale.status)
        ])} empty="Nenhum resultado encontrado neste período." />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">Confirmações de pagamento</h2>
        <AdminDataTable columns={["Data", "Cliente", "Comprador", "Meio", "Valor", "Status"]} rows={payments.map(payment => [
          dateTime(payment.createdAt), payment.tenant, payment.customer, paymentMethodLabel(payment.gateway), money(payment.amount), statusBadge(payment.status)
        ])} empty="Nenhum resultado encontrado neste período." />
      </section>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
          <form onSubmit={submitTenant} className="admin-card w-full max-w-2xl space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">{form.id ? "Editar cliente" : "Novo cliente"}</h2>
              <button type="button" onClick={() => setForm(null)} className="admin-icon-button" aria-label="Fechar"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-[var(--admin-muted)]">Nome
                <input className="admin-input w-full" value={form.nome} onChange={event => setForm({ ...form, nome: event.target.value })} required />
              </label>
              <label className="space-y-1 text-sm text-[var(--admin-muted)]">Domínio personalizado
                <input className="admin-input w-full" value={form.dominio_customizado} onChange={event => setForm({ ...form, dominio_customizado: event.target.value })} />
              </label>
              <label className="space-y-1 text-sm text-[var(--admin-muted)]">Plano
                <select className="admin-input w-full" value={form.plano} onChange={event => {
                  const plan = plans.find(item => item.id === event.target.value);
                  setForm({ ...form, plano: event.target.value, percentual_plataforma: plan?.percentual_comissao ?? form.percentual_plataforma });
                }}>
                  {(plans.length ? plans : [{ id: "basico", nome: "Basico", percentual_comissao: 10 } as Plan]).map(plan => (
                    <option key={plan.id} value={plan.id}>{plan.nome}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm text-[var(--admin-muted)]">Percentual operacional
                <input className="admin-input w-full" type="number" min="0" max="100" step="0.01" value={form.percentual_plataforma} onChange={event => setForm({ ...form, percentual_plataforma: Number(event.target.value) })} />
              </label>
              <label className="space-y-1 text-sm text-[var(--admin-muted)]">Cor primária
                <div className="flex items-center gap-2">
                  <input className="h-11 w-12 cursor-pointer rounded border border-[var(--admin-border)] bg-transparent p-1" type="color" value={form.cor_primaria} onChange={event => setForm({ ...form, cor_primaria: event.target.value })} />
                  <input className="admin-input w-full" value={form.cor_primaria} onChange={event => setForm({ ...form, cor_primaria: event.target.value })} />
                </div>
              </label>
            </div>
            <details className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--admin-text)]">Identificação comercial</summary>
              <label className="mt-4 block space-y-1 text-sm text-[var(--admin-muted)]">Endereço comercial
                <input className="admin-input w-full" value={form.slug} onChange={event => setForm({ ...form, slug: event.target.value })} required />
              </label>
            </details>
            <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] pt-4">
              <button type="button" onClick={() => setForm(null)} className="admin-button-secondary">Cancelar</button>
              <button type="submit" disabled={saving} className="admin-button-primary">{saving ? "Salvando..." : "Salvar cliente"}</button>
            </div>
          </form>
        </div>
      )}
      {impersonatingTenant && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4">
          <form onSubmit={startSupport} className="admin-card w-full max-w-xl space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">Acesso assistido seguro</h2>
              <button type="button" className="admin-icon-button" onClick={() => setImpersonatingTenant(null)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-[var(--admin-muted)]">Você acessará o painel de {impersonatingTenant.nome}. O motivo, horário e encerramento serão registrados para acompanhamento interno.</p>
            <label className="space-y-1 text-sm text-[var(--admin-muted)]">Motivo obrigatório
              <textarea className="admin-input min-h-28 w-full" value={supportReason} onChange={event => setSupportReason(event.target.value)} required />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="admin-button-secondary" onClick={() => setImpersonatingTenant(null)}>Cancelar</button>
              <button type="submit" className="admin-button-primary">Iniciar acesso assistido</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

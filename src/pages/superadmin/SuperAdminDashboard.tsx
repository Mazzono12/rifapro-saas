import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, Building2, CreditCard, DollarSign, Download, Eye, LifeBuoy, LogIn, Palette, Pencil, Plus, RefreshCw, ShieldAlert, SlidersHorizontal, Ticket, Trophy, X } from "lucide-react";
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
type Raffle = { id: string; tenant: string; title: string; status: string; soldTickets: number; totalTickets: number; price: number };
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
        throw new Error("Nao foi possivel carregar os dados globais.");
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
      toast.error("Falha ao carregar superadmin", { description: error instanceof Error ? error.message : "Tente novamente." });
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
      if (!response.ok) throw new Error(result.error || "Falha ao salvar tenant.");
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
    toast.success(status === "suspended" ? "Tenant suspenso" : "Tenant reativado");
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
        body: JSON.stringify({ reason: `Entrada no ambiente do inquilino ${tenant.nome} via Superadmin` })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(body.error || "Nao foi possivel entrar no ambiente do inquilino.");
        return;
      }
      window.location.href = body.redirectUrl;
    } finally {
      setAccessingTenantId("");
    }
  }

  const recentSales = useMemo(() => sales.slice(0, 12), [sales]);
  const chartMax = (items: ChartPoint[] = []) => Math.max(1, ...items.map(item => item.amount || 0));

  if (loading && !metrics) return <AdminLoadingSkeleton />;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Tenants ativos" value={`${metrics?.activeTenants || 0}/${metrics?.tenants || 0}`} icon={Building2} tone="primary" />
        <MetricCard label="Rifas ativas" value={`${metrics?.activeRaffles || 0}/${metrics?.raffles || 0}`} icon={Ticket} tone="accent" />
        <MetricCard label="Total vendido" value={money(metrics?.paidRevenue || 0)} icon={CreditCard} tone="success" />
        <MetricCard label="Comissao plataforma" value={money(metrics?.platformCommission || 0)} icon={DollarSign} tone="success" />
        <MetricCard label="PIX pendentes" value={metrics?.pendingPix || 0} icon={ShieldAlert} tone="warning" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Faturamento hoje" value={money(metrics?.revenueToday || 0)} icon={DollarSign} tone="success" />
        <MetricCard label="Últimos 7 dias" value={money(metrics?.revenueLast7Days || 0)} icon={DollarSign} tone="primary" />
        <MetricCard label="Mês atual" value={money(metrics?.revenueCurrentMonth || 0)} icon={DollarSign} tone="accent" />
        <MetricCard label="Ano atual" value={money(metrics?.revenueCurrentYear || 0)} icon={DollarSign} tone="success" />
        <MetricCard label="Ticket médio" value={money(metrics?.averageTicket || 0)} icon={CreditCard} tone="primary" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Erros de webhook" value={metrics?.webhookErrors || 0} icon={AlertTriangle} tone="warning" />
        <MetricCard label="Alertas antifraude" value={metrics?.suspiciousAlerts || 0} icon={ShieldAlert} tone="warning" />
        <MetricCard label="Conversão global" value={`${metrics?.conversionRate || 0}%`} icon={Activity} tone="primary" />
      </div>

      <div className="flex flex-wrap gap-2">
        <a className="admin-button-secondary" href="/api/superadmin/reports/revenue/export"><Download className="h-4 w-4" /> Exportar CSV global</a>
        <Link className="admin-button-secondary" to="/superadmin/dominios">Gerenciar domínios</Link>
        <Link className="admin-button-secondary" to="/superadmin/auditoria">Auditoria segura</Link>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">Ambientes dos inquilinos</h2>
            <p className="text-sm text-[var(--admin-muted)]">Entre no painel operacional de cada tenant com sessao auditada e isolamento por inquilino.</p>
          </div>
          <button type="button" onClick={() => void loadData()} className="admin-button-secondary" title="Atualizar ambientes">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tenants.map(tenant => (
            <div key={tenant.id} className="admin-card flex min-h-[172px] flex-col justify-between p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] text-sm font-black text-white" style={{ backgroundColor: tenant.cor_primaria || "#06b6d4" }}>
                  {tenant.nome.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-[var(--admin-text)]">{tenant.nome}</h3>
                  <p className="truncate text-xs text-[var(--admin-muted)]">{tenant.slug} · {tenant.id}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {statusBadge(tenant.status)}
                    <span className="inline-flex rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-[var(--admin-muted)]">{tenant.plano}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-[var(--admin-muted)]">
                <span><strong className="block text-sm text-[var(--admin-text)]">{tenant.raffleCount}</strong>Rifas</span>
                <span><strong className="block text-sm text-[var(--admin-text)]">{tenant.purchaseCount}</strong>Vendas</span>
                <span><strong className="block text-sm text-[var(--admin-text)]">{money(tenant.paidRevenue)}</strong>Receita</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="admin-button-primary flex-1 justify-center" disabled={accessingTenantId === tenant.id} onClick={() => void enterTenantEnvironment(tenant)}>
                  <LogIn className="h-4 w-4" />
                  {accessingTenantId === tenant.id ? "Entrando..." : "Entrar no ambiente"}
                </button>
                <Link className="admin-icon-button" title="Financeiro do inquilino" to={`/superadmin/tenants/${tenant.id}/financeiro`}><Eye className="h-4 w-4" /></Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        {[
          ["Faturamento por dia", charts.byDay || []],
          ["Faturamento por gateway", charts.byGateway || []],
          ["Top rifas por receita", charts.topRaffles || []]
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
                  {!items.length && <p className="text-sm text-[var(--admin-muted)]">Sem dados no período.</p>}
                </div>
              </ChartCard>
            </div>
          );
        })}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">Ranking de tenants por vendas</h2>
        <AdminDataTable columns={["Posicao", "Tenant", "Total vendido", "Comissao"]} rows={ranking.map(item => [
          <span key={item.tenant_id} className="inline-flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" />#{item.position}</span>,
          item.tenant,
          money(item.paidRevenue),
          money(item.platformCommission)
        ])} empty="Nenhuma venda paga registrada." />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">Clientes e tenants</h2>
            <p className="text-sm text-[var(--admin-muted)]">Controle de acesso e operacao por cliente.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void loadData()} className="admin-button-secondary" title="Atualizar">
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
            <button type="button" onClick={() => setForm({ ...emptyForm })} className="admin-button-primary">
              <Plus className="h-4 w-4" />
              Novo tenant
            </button>
          </div>
        </div>
        <AdminDataTable
          columns={["Cliente", "Status", "Plano", "Rifas", "Vendas", "Receita paga", "Comissao", "Acoes"]}
          rows={tenants.map(tenant => [
            <div key={tenant.id}><p className="font-semibold">{tenant.nome}</p><p className="text-xs text-[var(--admin-muted)]">{tenant.slug}</p></div>,
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
              <button type="button" className="admin-icon-button" title="Editar tenant" onClick={() => setForm({ ...tenant })}><Pencil className="h-4 w-4" /></button>
              <button type="button" className="admin-button-secondary" onClick={() => void toggleSuspension(tenant)}>
                {tenant.status === "suspended" ? "Reativar" : "Suspender"}
              </button>
            </div>
          ])}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">Todas as rifas</h2>
          <AdminDataTable columns={["Tenant", "Rifa", "Status", "Cotas"]} rows={raffles.map(raffle => [
            raffle.tenant,
            raffle.title,
            statusBadge(raffle.status),
            `${raffle.soldTickets}/${raffle.totalTickets}`
          ])} />
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">Comissoes da plataforma</h2>
          <AdminDataTable columns={["Tenant", "Percentual", "Receita paga", "Comissao"]} rows={commissions.map(item => [
            item.tenant,
            `${item.percentual}%`,
            money(item.paidRevenue),
            money(item.platformCommission)
          ])} />
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">Vendas globais</h2>
        <AdminDataTable columns={["Data", "Tenant", "Produto", "Cliente", "Canal", "Valor", "Status"]} rows={recentSales.map(sale => [
          dateTime(sale.createdAt), sale.tenant, sale.product, sale.customer, sale.channel, money(sale.amount), statusBadge(sale.status)
        ])} empty="Nenhuma venda registrada." />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">Pagamentos PIX</h2>
        <AdminDataTable columns={["Data", "Tenant", "Cliente", "Gateway", "Valor", "Status"]} rows={payments.map(payment => [
          dateTime(payment.createdAt), payment.tenant, payment.customer, payment.gateway, money(payment.amount), statusBadge(payment.status)
        ])} empty="Nenhum pagamento PIX registrado." />
      </section>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
          <form onSubmit={submitTenant} className="admin-card w-full max-w-2xl space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">{form.id ? "Editar tenant" : "Novo tenant"}</h2>
              <button type="button" onClick={() => setForm(null)} className="admin-icon-button" aria-label="Fechar"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-[var(--admin-muted)]">Nome
                <input className="admin-input w-full" value={form.nome} onChange={event => setForm({ ...form, nome: event.target.value })} required />
              </label>
              <label className="space-y-1 text-sm text-[var(--admin-muted)]">Slug
                <input className="admin-input w-full" value={form.slug} onChange={event => setForm({ ...form, slug: event.target.value })} required />
              </label>
              <label className="space-y-1 text-sm text-[var(--admin-muted)]">Dominio customizado
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
              <label className="space-y-1 text-sm text-[var(--admin-muted)]">Percentual da plataforma
                <input className="admin-input w-full" type="number" min="0" max="100" step="0.01" value={form.percentual_plataforma} onChange={event => setForm({ ...form, percentual_plataforma: Number(event.target.value) })} />
              </label>
              <label className="space-y-1 text-sm text-[var(--admin-muted)]">Cor primaria
                <div className="flex items-center gap-2">
                  <input className="h-11 w-12 cursor-pointer rounded border border-[var(--admin-border)] bg-transparent p-1" type="color" value={form.cor_primaria} onChange={event => setForm({ ...form, cor_primaria: event.target.value })} />
                  <input className="admin-input w-full" value={form.cor_primaria} onChange={event => setForm({ ...form, cor_primaria: event.target.value })} />
                </div>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] pt-4">
              <button type="button" onClick={() => setForm(null)} className="admin-button-secondary">Cancelar</button>
              <button type="submit" disabled={saving} className="admin-button-primary">{saving ? "Salvando..." : "Salvar tenant"}</button>
            </div>
          </form>
        </div>
      )}
      {impersonatingTenant && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4">
          <form onSubmit={startSupport} className="admin-card w-full max-w-xl space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">Acesso assistido com auditoria segura</h2>
              <button type="button" className="admin-icon-button" onClick={() => setImpersonatingTenant(null)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-[var(--admin-muted)]">Você acessará o painel de {impersonatingTenant.nome}. O motivo, horário, IP e encerramento serão registrados para auditoria interna.</p>
            <label className="space-y-1 text-sm text-[var(--admin-muted)]">Motivo obrigatório
              <textarea className="admin-input min-h-28 w-full" value={supportReason} onChange={event => setSupportReason(event.target.value)} required />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="admin-button-secondary" onClick={() => setImpersonatingTenant(null)}>Cancelar</button>
              <button type="submit" className="admin-button-primary">Entrar como suporte</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

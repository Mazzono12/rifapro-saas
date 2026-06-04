import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, CreditCard, Eye, LogIn, Palette, Pencil, Plus, RefreshCw, SlidersHorizontal, Ticket, X } from "lucide-react";
import { toast } from "sonner";
import { AdminDataTable, AdminLoadingSkeleton, MetricCard } from "../../components/admin/AdminPremium";
import { formatPlanName } from "../../lib/planLabels";

type TenantStatus = "trial" | "active" | "suspended" | "overdue" | "maintenance" | "blocked" | "canceled" | "inactive";
type Tenant = {
  id: string;
  nome: string;
  slug: string;
  dominio_customizado: string;
  status: TenantStatus;
  cor_primaria: string;
  plano: string;
  plan?: { id: string; nome: string };
  percentual_plataforma: number;
  raffleCount: number;
  purchaseCount: number;
  paidRevenue: number;
  platformCommission: number;
};
type Plan = { id: string; nome: string; percentual_comissao: number };
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
  plano: "starter",
  percentual_plataforma: 0,
  cor_primaria: "#06b6d4"
};

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusBadge(status: string) {
  const className = status === "active"
    ? "bg-emerald-100 text-emerald-800"
    : status === "trial" || status === "maintenance"
      ? "bg-amber-100 text-amber-800"
      : "bg-rose-100 text-rose-800";
  const label = {
    active: "Ativo",
    trial: "Teste",
    inactive: "Inativo",
    suspended: "Suspenso",
    overdue: "Em atraso",
    maintenance: "Manutencao",
    blocked: "Bloqueado",
    canceled: "Cancelado"
  }[status] || status;
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

export function SuperAdminClients() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<TenantForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [supportTenant, setSupportTenant] = useState<Tenant | null>(null);
  const [supportReason, setSupportReason] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const response = await fetch("/api/superadmin/overview");
      const overview = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(overview.error || "Nao foi possivel carregar clientes.");
      setTenants(Array.isArray(overview.tenants) ? overview.tenants : []);
      setPlans(Array.isArray(overview.plans) ? overview.plans : []);
    } catch (error) {
      toast.error("Falha ao carregar clientes", { description: error instanceof Error ? error.message : "Tente novamente." });
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
    if (!supportTenant) return;
    const response = await fetch(`/api/superadmin/tenants/${supportTenant.id}/impersonate/start`, {
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

  const summary = useMemo(() => {
    const active = tenants.filter(item => item.status === "active").length;
    const suspended = tenants.filter(item => item.status === "suspended" || item.status === "blocked").length;
    const revenue = tenants.reduce((sum, item) => sum + Number(item.paidRevenue || 0), 0);
    const sales = tenants.reduce((sum, item) => sum + Number(item.purchaseCount || 0), 0);
    return { active, suspended, revenue, sales };
  }, [tenants]);

  if (loading) return <AdminLoadingSkeleton />;

  return (
    <div className="space-y-5">
      <section className="admin-card p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold leading-tight text-[var(--admin-text)]">Clientes</h2>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Gestao individual de contas, planos, dominios e acesso assistido.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadData()} className="admin-button-secondary h-10 px-3 text-sm">
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
            <button type="button" onClick={() => setForm({ ...emptyForm })} className="admin-button h-10 px-3 text-sm">
              <Plus className="h-4 w-4" />
              Novo cliente
            </button>
          </div>
        </div>
      </section>

      <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Clientes ativos" value={`${summary.active}/${tenants.length}`} icon={Building2} trend="contas em operacao" />
        <MetricCard label="Faturamento" value={money(summary.revenue)} icon={CreditCard} trend="total por cliente" tone="success" />
        <MetricCard label="Vendas" value={summary.sales} icon={Ticket} trend="pedidos nas contas" tone="accent" />
        <MetricCard label="Atenção" value={summary.suspended} icon={Building2} trend="suspensos ou bloqueados" tone={summary.suspended ? "warning" : "success"} />
      </div>

      <section className="admin-card overflow-hidden p-0">
        <div className="border-b border-[var(--admin-border)] p-4">
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">Lista de clientes</h2>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Gerencie contas, acesso, aparência e planos em um só lugar.</p>
        </div>
        <AdminDataTable
          minWidth="980px"
          columns={["Cliente", "Status", "Plano", "Domínio", "Campanhas", "Vendas", "Faturamento", "Ações"]}
          rows={tenants.map(tenant => [
            <div key={tenant.id} className="min-w-48">
              <p className="font-semibold">{tenant.nome}</p>
              <p className="text-xs text-[var(--admin-muted)]">Conta em gestao individual</p>
            </div>,
            statusBadge(tenant.status),
            formatPlanName(tenant.plan || tenant.plano),
            tenant.dominio_customizado || "Sem domínio",
            tenant.raffleCount,
            tenant.purchaseCount,
            money(tenant.paidRevenue),
            <ClientActions
              key={`${tenant.id}-actions`}
              tenant={tenant}
              onEdit={() => setForm({ ...tenant })}
              onSupport={() => { setSupportTenant(tenant); setSupportReason(""); }}
              onToggle={() => void toggleSuspension(tenant)}
            />
          ])}
        />
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
                  {(plans.length ? plans : [{ id: "starter", nome: "Básico", percentual_comissao: 10 }]).map(plan => (
                    <option key={plan.id} value={plan.id}>{formatPlanName(plan)}</option>
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

      {supportTenant && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4">
          <form onSubmit={startSupport} className="admin-card w-full max-w-xl space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">Acesso assistido seguro</h2>
              <button type="button" className="admin-icon-button" onClick={() => setSupportTenant(null)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-[var(--admin-muted)]">Você acessará o painel de {supportTenant.nome}. O motivo, horário e encerramento serão registrados para acompanhamento interno.</p>
            <label className="space-y-1 text-sm text-[var(--admin-muted)]">Motivo obrigatório
              <textarea className="admin-input min-h-28 w-full" value={supportReason} onChange={event => setSupportReason(event.target.value)} required />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="admin-button-secondary" onClick={() => setSupportTenant(null)}>Cancelar</button>
              <button type="submit" className="admin-button-primary">Iniciar acesso assistido</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ClientActions({
  tenant,
  onEdit,
  onSupport,
  onToggle
}: {
  key?: string;
  tenant: Tenant;
  onEdit: () => void;
  onSupport: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="flex min-w-[248px] flex-wrap items-center gap-2">
      <Link className="admin-action-button" title="Gerenciar cliente" to={`/superadmin/tenants/${tenant.id}/financeiro`}>
        <Eye className="h-4 w-4" /> Ver
      </Link>
      <button type="button" className="admin-action-button" title="Entrar no ambiente" onClick={onSupport}>
        <LogIn className="h-4 w-4" /> Entrar
      </button>
      <button type="button" className="admin-action-button" title="Editar cliente" onClick={onEdit}>
        <Pencil className="h-4 w-4" /> Editar
      </button>
      <Link className="admin-icon-button" title="Aparência" to={`/superadmin/tenants/${tenant.id}/aparencia`}><Palette className="h-4 w-4" /></Link>
      <Link className="admin-icon-button" title="Plano e Recursos" to={`/superadmin/tenants/${tenant.id}/plano`}><SlidersHorizontal className="h-4 w-4" /></Link>
      <button type="button" className="admin-action-button" onClick={onToggle}>
        {tenant.status === "suspended" ? "Reativar" : "Suspender"}
      </button>
    </div>
  );
}

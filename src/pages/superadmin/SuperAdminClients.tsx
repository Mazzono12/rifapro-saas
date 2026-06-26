import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, CreditCard, Eye, LogIn, Pencil, Plus, RefreshCw, Ticket, X } from "lucide-react";
import { toast } from "sonner";
import { AdminDataTable, AdminLoadingSkeleton, MetricCard } from "../../components/admin/AdminPremium";

type TenantStatus = "trial" | "active" | "suspended" | "overdue" | "maintenance" | "blocked" | "canceled" | "inactive";
type Tenant = {
  id: string;
  nome: string;
  slug: string;
  dominio_customizado: string;
  status: TenantStatus;
  cor_primaria: string;
  percentual_plataforma: number;
  raffleCount: number;
  purchaseCount: number;
  paidRevenue: number;
  platformCommission: number;
};
type SuperadminUser = { id: string; nome: string; email: string; role: string; tenant_id: string | null; ativo: boolean };
type TenantForm = {
  id?: string;
  nome: string;
  slug: string;
  dominio_customizado: string;
  status: TenantStatus;
  percentual_plataforma: number;
  cor_primaria: string;
  initialAdmin?: {
    nome: string;
    email: string;
    password: string;
  };
};

const emptyForm: TenantForm = {
  nome: "",
  slug: "",
  dominio_customizado: "",
  status: "active",
  percentual_plataforma: 10,
  cor_primaria: "#06b6d4",
  initialAdmin: {
    nome: "",
    email: "",
    password: ""
  }
};

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const values = new Uint32Array(10);
  window.crypto.getRandomValues(values);
  return `CIFHER${Array.from(values).map(value => alphabet[value % alphabet.length]).join("")}!`;
}

function statusBadge(status: string) {
  const className = status === "active"
    ? "bg-emerald-100 text-emerald-800"
    : status === "trial" || status === "maintenance"
      ? "bg-slate-100 text-slate-600"
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
  const [users, setUsers] = useState<SuperadminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<TenantForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [supportTenant, setSupportTenant] = useState<Tenant | null>(null);
  const [supportReason, setSupportReason] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [initialAdminTenant, setInitialAdminTenant] = useState<Tenant | null>(null);
  const [initialAdminForm, setInitialAdminForm] = useState({ nome: "", email: "", password: "" });

  async function loadData() {
    setLoading(true);
    try {
      const [response, usersResponse] = await Promise.all([
        fetch("/api/superadmin/overview"),
        fetch("/api/superadmin/users")
      ]);
      const overview = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(overview.error || "Nao foi possivel carregar clientes.");
      setTenants(Array.isArray(overview.tenants) ? overview.tenants : []);
      setUsers(usersResponse.ok ? await usersResponse.json() : []);
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
    if (!form.id) {
      const admin = form.initialAdmin;
      if (!admin?.nome.trim() || !admin.email.trim() || !admin.password.trim()) {
        toast.error("Administrador inicial obrigatorio", { description: "Informe nome, email e senha temporaria para criar o tenant." });
        return;
      }
      if (admin.password.trim().length < 8) {
        toast.error("Senha temporaria invalida", { description: "Use pelo menos 8 caracteres." });
        return;
      }
    }
    setSaving(true);
    try {
      const url = form.id ? `/api/superadmin/tenants/${form.id}` : "/api/superadmin/tenants";
      const initialAdmin = !form.id && form.initialAdmin?.email.trim()
        ? {
          nome: form.initialAdmin.nome.trim(),
          email: form.initialAdmin.email.trim().toLowerCase(),
          password: form.initialAdmin.password.trim() || undefined
        }
        : undefined;
      const payload = {
        nome: form.nome,
        slug: form.slug,
        dominio_customizado: form.dominio_customizado,
        status: form.status,
        percentual_plataforma: form.percentual_plataforma,
        cor_primaria: form.cor_primaria,
        ...(initialAdmin ? { admin: initialAdmin } : {})
      };
      const response = await fetch(url, {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Falha ao salvar cliente.");
      if (!form.id && result.admin?.temporaryPassword) setTemporaryPassword(result.admin.temporaryPassword);
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

  async function createInitialAdmin(event: FormEvent) {
    event.preventDefault();
    if (!initialAdminTenant) return;
    if (!initialAdminForm.nome.trim() || !initialAdminForm.email.trim() || !initialAdminForm.password.trim()) {
      toast.error("Informe nome, email e senha temporaria.");
      return;
    }
    if (initialAdminForm.password.trim().length < 8) {
      toast.error("Senha temporaria deve ter pelo menos 8 caracteres.");
      return;
    }
    const response = await fetch(`/api/superadmin/tenants/${initialAdminTenant.id}/admins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: initialAdminForm.nome,
        email: initialAdminForm.email,
        password: initialAdminForm.password,
        role: "tenant_admin"
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error || "Nao foi possivel criar administrador inicial.");
      return;
    }
    setTemporaryPassword(body.temporaryPassword || initialAdminForm.password);
    setInitialAdminTenant(null);
    setInitialAdminForm({ nome: "", email: "", password: "" });
    toast.success("Administrador inicial criado");
    await loadData();
  }

  const summary = useMemo(() => {
    const active = tenants.filter(item => item.status === "active").length;
    const suspended = tenants.filter(item => item.status === "suspended" || item.status === "blocked").length;
    const revenue = tenants.reduce((sum, item) => sum + Number(item.paidRevenue || 0), 0);
    const sales = tenants.reduce((sum, item) => sum + Number(item.purchaseCount || 0), 0);
    return { active, suspended, revenue, sales };
  }, [tenants]);

  const adminCountByTenant = useMemo(() => {
    return users.reduce<Record<string, number>>((acc, user) => {
      if (user.tenant_id && (user.role === "tenant_admin" || user.role === "admin")) {
        acc[user.tenant_id] = (acc[user.tenant_id] || 0) + 1;
      }
      return acc;
    }, {});
  }, [users]);

  if (loading) return <AdminLoadingSkeleton />;

  return (
    <div className="space-y-5">
      <section className="admin-card p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold leading-tight text-[var(--admin-text)]">Clientes</h2>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Gestao individual de contas, dominios, taxa percentual e acesso assistido.</p>
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
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Gerencie contas, acesso, aparência e taxa da plataforma em um só lugar.</p>
        </div>
        <AdminDataTable
          minWidth="980px"
          columns={["Cliente", "Status", "Taxa", "Domínio", "Campanhas", "Vendas", "Faturamento", "Ações"]}
          rows={tenants.map(tenant => [
            <div key={tenant.id} className="min-w-48">
              <p className="font-semibold">{tenant.nome}</p>
              <p className="text-xs text-[var(--admin-muted)]">Conta em gestao individual</p>
            </div>,
            statusBadge(tenant.status),
            `${Number(tenant.percentual_plataforma ?? 10)}%`,
            tenant.dominio_customizado || "Sem domínio",
            tenant.raffleCount,
            tenant.purchaseCount,
            money(tenant.paidRevenue),
            <ClientActions
              key={`${tenant.id}-actions`}
              tenant={tenant}
              onEdit={() => setForm({ ...tenant, initialAdmin: undefined })}
              onSupport={() => { setSupportTenant(tenant); setSupportReason(""); }}
              onToggle={() => void toggleSuspension(tenant)}
              needsInitialAdmin={!adminCountByTenant[tenant.id]}
              onCreateInitialAdmin={() => {
                setInitialAdminTenant(tenant);
                setInitialAdminForm({ nome: "", email: "", password: generateTemporaryPassword() });
              }}
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
              <label className="space-y-1 text-sm text-[var(--admin-muted)]">Status
                <select className="admin-input w-full" value={form.status} onChange={event => setForm({ ...form, status: event.target.value as TenantStatus })}>
                  <option value="active">Ativo</option>
                  <option value="trial">Teste</option>
                  <option value="suspended">Suspenso</option>
                  <option value="overdue">Em atraso</option>
                  <option value="maintenance">Manutenção</option>
                  <option value="blocked">Bloqueado</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>
              <label className="space-y-1 text-sm text-[var(--admin-muted)]">Taxa da plataforma (%)
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
            {!form.id && (
              <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--admin-text)]">Administrador inicial</h3>
                  <p className="mt-1 text-sm text-[var(--admin-muted)]">Este será o login inicial do cliente para acessar o painel administrativo do tenant. A senha pode ser redefinida depois pelo Super Admin.</p>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1 text-sm text-[var(--admin-muted)]">Nome do administrador
                    <input className="admin-input w-full" value={form.initialAdmin?.nome || ""} onChange={event => setForm({ ...form, initialAdmin: { ...(form.initialAdmin || { email: "", password: "" }), nome: event.target.value } })} />
                  </label>
                  <label className="space-y-1 text-sm text-[var(--admin-muted)]">Email de login
                    <input className="admin-input w-full" type="email" value={form.initialAdmin?.email || ""} onChange={event => setForm({ ...form, initialAdmin: { ...(form.initialAdmin || { nome: "", password: "" }), email: event.target.value } })} />
                  </label>
                  <label className="space-y-1 text-sm text-[var(--admin-muted)]">Senha temporária
                    <input className="admin-input w-full" type="text" value={form.initialAdmin?.password || ""} onChange={event => setForm({ ...form, initialAdmin: { ...(form.initialAdmin || { nome: "", email: "" }), password: event.target.value } })} placeholder="Deixe em branco para gerar automaticamente" />
                  </label>
                  <div className="flex items-end">
                    <button type="button" className="admin-button-secondary h-11 px-3 text-sm" onClick={() => setForm({ ...form, initialAdmin: { ...(form.initialAdmin || { nome: "", email: "" }), password: generateTemporaryPassword() } })}>
                      Gerar senha automaticamente
                    </button>
                  </div>
                </div>
              </section>
            )}
            <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] pt-4">
              <button type="button" onClick={() => setForm(null)} className="admin-button-secondary">Cancelar</button>
              <button type="submit" disabled={saving} className="admin-button-primary">{saving ? "Salvando..." : "Salvar cliente"}</button>
            </div>
          </form>
        </div>
      )}

      {temporaryPassword && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4">
          <div className="admin-card w-full max-w-xl space-y-4 p-5">
            <div>
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">Senha temporária do administrador</h2>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">Copie esta senha agora, ela não será exibida novamente.</p>
            </div>
            <input className="admin-input w-full font-mono" readOnly value={temporaryPassword} />
            <div className="flex justify-end">
              <button type="button" className="admin-button-primary" onClick={() => setTemporaryPassword("")}>Entendi</button>
            </div>
          </div>
        </div>
      )}

      {initialAdminTenant && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4">
          <form onSubmit={createInitialAdmin} className="admin-card w-full max-w-xl space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--admin-text)]">Criar Administrador Inicial</h2>
                <p className="mt-1 text-sm text-[var(--admin-muted)]">Tenant: {initialAdminTenant.nome}</p>
              </div>
              <button type="button" className="admin-icon-button" onClick={() => setInitialAdminTenant(null)}><X className="h-4 w-4" /></button>
            </div>
            <label className="space-y-1 text-sm text-[var(--admin-muted)]">Nome do administrador
              <input className="admin-input w-full" value={initialAdminForm.nome} onChange={event => setInitialAdminForm({ ...initialAdminForm, nome: event.target.value })} required />
            </label>
            <label className="space-y-1 text-sm text-[var(--admin-muted)]">Email de login
              <input className="admin-input w-full" type="email" value={initialAdminForm.email} onChange={event => setInitialAdminForm({ ...initialAdminForm, email: event.target.value })} required />
            </label>
            <label className="space-y-1 text-sm text-[var(--admin-muted)]">Senha temporária
              <input className="admin-input w-full" type="text" value={initialAdminForm.password} onChange={event => setInitialAdminForm({ ...initialAdminForm, password: event.target.value })} required />
            </label>
            <button type="button" className="admin-button-secondary h-10 px-3 text-sm" onClick={() => setInitialAdminForm({ ...initialAdminForm, password: generateTemporaryPassword() })}>
              Gerar senha automática
            </button>
            <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] pt-4">
              <button type="button" className="admin-button-secondary" onClick={() => setInitialAdminTenant(null)}>Cancelar</button>
              <button type="submit" className="admin-button-primary">Criar administrador</button>
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
  onToggle,
  needsInitialAdmin,
  onCreateInitialAdmin
}: {
  key?: string;
  tenant: Tenant;
  onEdit: () => void;
  onSupport: () => void;
  onToggle: () => void;
  needsInitialAdmin: boolean;
  onCreateInitialAdmin: () => void;
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
      <button type="button" className="admin-action-button" onClick={onToggle}>
        {tenant.status === "suspended" ? "Reativar" : "Suspender"}
      </button>
      {needsInitialAdmin && (
        <button type="button" className="admin-action-button border-slate-200 text-slate-600" onClick={onCreateInitialAdmin}>
          Criar Administrador Inicial
        </button>
      )}
    </div>
  );
}






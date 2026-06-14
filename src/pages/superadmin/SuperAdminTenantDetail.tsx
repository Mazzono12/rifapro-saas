import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, Download, ExternalLink, KeyRound, LifeBuoy, Mail, Pencil, Power, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AdminDataTable, AdminLoadingSkeleton, MetricCard } from "../../components/admin/AdminPremium";

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type TenantAdmin = {
  id: string;
  nome: string;
  email: string;
  role: string;
  rawRole?: string;
  tenant_id: string;
  ativo: boolean;
  criado_em?: string;
  ultimo_acesso?: string | null;
};

type AdminFormState = {
  id?: string;
  nome: string;
  email: string;
  password: string;
};

export function SuperAdminTenantDetail() {
  const { tenantId = "" } = useParams();
  const [data, setData] = useState<any>(null);
  const [raffles, setRaffles] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [admins, setAdmins] = useState<TenantAdmin[]>([]);
  const [adminForm, setAdminForm] = useState<AdminFormState | null>(null);
  const [resetAdmin, setResetAdmin] = useState<TenantAdmin | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [financeRes, rafflesRes, ordersRes, adminsRes] = await Promise.all([
        fetch(`/api/superadmin/tenants/${tenantId}/financeiro`),
        fetch(`/api/superadmin/tenants/${tenantId}/raffles`),
        fetch(`/api/superadmin/tenants/${tenantId}/orders`),
        fetch(`/api/superadmin/tenants/${tenantId}/admins`)
      ]);
      const finance = await financeRes.json();
      if (!financeRes.ok) throw new Error(finance.error || "Falha ao carregar financeiro");
      setData(finance);
      setRaffles(await rafflesRes.json());
      setOrders(await ordersRes.json());
      setAdmins(adminsRes.ok ? await adminsRes.json() : []);
    } catch (error) {
      toast.error("Falha no cliente", { description: error instanceof Error ? error.message : "Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [tenantId]);

  async function beginSupport() {
    if (reason.trim().length < 8) {
      toast.error("Informe um motivo com pelo menos 8 caracteres para o acesso assistido.");
      return;
    }
    const response = await fetch(`/api/superadmin/tenants/${tenantId}/impersonate/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error || "Falha ao iniciar acesso assistido");
      return;
    }
    window.location.href = body.redirectUrl;
  }

  async function startSupport(event: FormEvent) {
    event.preventDefault();
    await beginSupport();
  }

  async function saveAdmin(event: FormEvent) {
    event.preventDefault();
    if (!adminForm) return;
    const editing = Boolean(adminForm.id);
    const response = await fetch(editing ? `/api/superadmin/tenants/${tenantId}/admins/${adminForm.id}` : `/api/superadmin/tenants/${tenantId}/admins`, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: adminForm.nome,
        email: adminForm.email,
        password: editing ? undefined : adminForm.password || undefined,
        role: "tenant_admin"
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error || "Falha ao salvar administrador");
      return;
    }
    if (body.temporaryPassword) setTemporaryPassword(body.temporaryPassword);
    toast.success(editing ? "Administrador atualizado" : "Administrador criado");
    setAdminForm(null);
    await load();
  }

  async function toggleAdmin(admin: TenantAdmin) {
    const response = await fetch(`/api/superadmin/tenants/${tenantId}/admins/${admin.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !admin.ativo })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error || "Falha ao alterar status do administrador");
      return;
    }
    toast.success(admin.ativo ? "Administrador desativado" : "Administrador ativado");
    await load();
  }

  async function submitPasswordReset(event: FormEvent) {
    event.preventDefault();
    if (!resetAdmin) return;
    const response = await fetch(`/api/superadmin/tenants/${tenantId}/admins/${resetAdmin.id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPassword || undefined })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error || "Falha ao redefinir senha");
      return;
    }
    setTemporaryPassword(body.temporaryPassword || "");
    setResetAdmin(null);
    setResetPassword("");
    toast.success("Senha temporaria gerada");
    await load();
  }

  if (loading || !data) return <AdminLoadingSkeleton />;
  const summary = data.report.summary;
  const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "Sem registro";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/superadmin/clientes" className="admin-action-button">
            <ArrowLeft className="h-4 w-4" /> Clientes
          </Link>
          <h2 className="mt-1 text-2xl font-semibold text-[var(--admin-text)]">{data.tenant.nome}</h2>
        </div>
        <a className="admin-button-secondary h-10 px-3 text-sm" href={`/api/superadmin/tenants/${tenantId}/reports/revenue/export`}>
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
        <button className="admin-button self-end" type="submit"><LifeBuoy className="h-4 w-4" /> Acessar</button>
      </form>

      <section className="admin-card overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] p-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">Administradores do Tenant</h2>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Crie, edite, redefina senha e gerencie acesso apenas deste tenant.</p>
          </div>
          <button type="button" className="admin-button h-10 px-3 text-sm" onClick={() => { setTemporaryPassword(""); setAdminForm({ nome: "", email: "", password: "" }); }}>
            <UserPlus className="h-4 w-4" /> Criar administrador
          </button>
        </div>
        <AdminDataTable
          minWidth="920px"
          columns={["Nome", "Email", "Role", "Status", "Tenant", "Último acesso", "Ações"]}
          rows={admins.map(admin => [
            admin.nome,
            admin.email,
            admin.role,
            <span key={`${admin.id}-status`} className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${admin.ativo ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
              {admin.ativo ? "Ativo" : "Inativo"}
            </span>,
            admin.tenant_id,
            formatDate(admin.ultimo_acesso),
            <div key={`${admin.id}-actions`} className="flex min-w-[360px] flex-wrap gap-2">
              <button type="button" className="admin-action-button" onClick={() => { setTemporaryPassword(""); setAdminForm({ id: admin.id, nome: admin.nome, email: admin.email, password: "" }); }}>
                <Mail className="h-4 w-4" /> Alterar email
              </button>
              <button type="button" className="admin-action-button" onClick={() => { setResetAdmin(admin); setResetPassword(""); setTemporaryPassword(""); }}>
                <KeyRound className="h-4 w-4" /> Redefinir senha
              </button>
              <button type="button" className="admin-action-button" onClick={() => void toggleAdmin(admin)}>
                <Power className="h-4 w-4" /> {admin.ativo ? "Desativar" : "Ativar"}
              </button>
              <button type="button" className="admin-action-button" onClick={() => void beginSupport()}>
                <LifeBuoy className="h-4 w-4" /> Entrar como tenant
              </button>
            </div>
          ])}
          empty="Nenhum administrador cadastrado para este tenant."
        />
      </section>

      <AdminDataTable
        columns={["Campanha", "Status", "Cotas", "Ações"]}
        rows={raffles.map(raffle => [
          raffle.title,
          raffle.status,
          `${raffle.soldTickets}/${raffle.totalTickets}`,
          <div key={raffle.id} className="flex flex-wrap gap-2">
            <a className="admin-action-button" href={`/raffle/${raffle.id}`} target="_blank" rel="noreferrer" title="Abrir página pública"><ExternalLink className="h-4 w-4" /> Pública</a>
            <Link className="admin-action-button" to="/admin/rifas" title="Editar no painel operacional"><Pencil className="h-4 w-4" /> Editar</Link>
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

      {adminForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4">
          <form onSubmit={saveAdmin} className="admin-card w-full max-w-xl space-y-4 p-5">
            <div>
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">{adminForm.id ? "Editar administrador" : "Criar administrador"}</h2>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">Este usuário ficará vinculado somente ao tenant {data.tenant.nome}.</p>
            </div>
            <label className="space-y-1 text-sm text-[var(--admin-muted)]">Nome
              <input className="admin-input w-full" value={adminForm.nome} onChange={event => setAdminForm({ ...adminForm, nome: event.target.value })} required />
            </label>
            <label className="space-y-1 text-sm text-[var(--admin-muted)]">Email
              <input className="admin-input w-full" type="email" value={adminForm.email} onChange={event => setAdminForm({ ...adminForm, email: event.target.value })} required />
            </label>
            {!adminForm.id && (
              <label className="space-y-1 text-sm text-[var(--admin-muted)]">Senha temporária opcional
                <input className="admin-input w-full" type="text" value={adminForm.password} onChange={event => setAdminForm({ ...adminForm, password: event.target.value })} placeholder="Deixe em branco para gerar automaticamente" />
              </label>
            )}
            <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] pt-4">
              <button type="button" className="admin-button-secondary" onClick={() => setAdminForm(null)}>Cancelar</button>
              <button type="submit" className="admin-button-primary">{adminForm.id ? "Salvar alterações" : "Criar administrador"}</button>
            </div>
          </form>
        </div>
      )}

      {resetAdmin && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4">
          <form onSubmit={submitPasswordReset} className="admin-card w-full max-w-xl space-y-4 p-5">
            <div>
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">Redefinir senha</h2>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">A senha atual nunca é exibida. Uma nova senha temporária será gerada ou definida abaixo.</p>
            </div>
            <label className="space-y-1 text-sm text-[var(--admin-muted)]">Nova senha temporária opcional
              <input className="admin-input w-full" type="text" value={resetPassword} onChange={event => setResetPassword(event.target.value)} placeholder="Deixe em branco para gerar automaticamente" />
            </label>
            <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] pt-4">
              <button type="button" className="admin-button-secondary" onClick={() => setResetAdmin(null)}>Cancelar</button>
              <button type="submit" className="admin-button-primary">Redefinir senha</button>
            </div>
          </form>
        </div>
      )}

      {temporaryPassword && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4">
          <div className="admin-card w-full max-w-xl space-y-4 p-5">
            <div>
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">Senha temporária gerada</h2>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">Mostre esta senha ao administrador por um canal seguro. A senha atual nunca foi exibida.</p>
            </div>
            <input className="admin-input w-full font-mono" readOnly value={temporaryPassword} />
            <div className="flex justify-end">
              <button type="button" className="admin-button-primary" onClick={() => setTemporaryPassword("")}>Entendi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

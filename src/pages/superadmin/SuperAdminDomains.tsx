import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminDataTable, AdminLoadingSkeleton } from "../../components/admin/AdminPremium";

type Tenant = { id: string; nome: string; slug: string };
type DomainRecord = {
  id: string;
  tenant_id: string;
  tenant: string;
  domain: string;
  type: "subdomain" | "custom_domain";
  status: string;
  dns_target: string;
  ssl_status: string;
  is_primary: boolean;
  dns_instructions: string;
};

export function SuperAdminDomains() {
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ tenant_id: "", domain: "", type: "custom_domain" as "subdomain" | "custom_domain" });

  async function load() {
    setLoading(true);
    try {
      const [domainsRes, tenantsRes] = await Promise.all([fetch("/api/superadmin/domains"), fetch("/api/superadmin/tenants")]);
      const domainsData = await domainsRes.json();
      const tenantsData = await tenantsRes.json();
      if (!domainsRes.ok || !tenantsRes.ok) throw new Error("Falha ao carregar dominios");
      setDomains(domainsData);
      setTenants(tenantsData);
      setForm(current => ({ ...current, tenant_id: current.tenant_id || tenantsData[0]?.id || "" }));
    } catch (error) {
      toast.error("Nao foi possivel carregar dominios", { description: error instanceof Error ? error.message : "Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function createDomain(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/superadmin/tenants/${form.tenant_id}/domains`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(data.error || "Falha ao criar dominio");
    toast.success("Domínio criado");
    setForm({ tenant_id: form.tenant_id, domain: "", type: "custom_domain" });
    await load();
  }

  async function action(path: string, method = "POST") {
    const response = await fetch(path, { method });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(data.error || "Falha na ação");
    toast.success("Domínio atualizado");
    await load();
  }

  if (loading) return <AdminLoadingSkeleton />;

  return (
    <div className="space-y-5">
      <form onSubmit={createDomain} className="admin-card grid gap-3 p-5 lg:grid-cols-[260px_1fr_220px_auto]">
        <select className="admin-input self-end" value={form.tenant_id} onChange={event => setForm({ ...form, tenant_id: event.target.value })}>
          {tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.nome}</option>)}
        </select>
        <input className="admin-input self-end" value={form.domain} onChange={event => setForm({ ...form, domain: event.target.value })} placeholder="sorteioscliente.com.br" required />
        <select className="admin-input self-end" value={form.type} onChange={event => setForm({ ...form, type: event.target.value as DomainRecord["type"] })}>
          <option value="custom_domain">Domínio próprio</option>
          <option value="subdomain">Subdomínio</option>
        </select>
        <button className="admin-button self-end" type="submit"><Plus className="h-4 w-4" /> Adicionar</button>
      </form>

      <AdminDataTable
        columns={["Cliente", "Domínio", "Status", "DNS/SSL", "Principal", "Ações"]}
        rows={domains.map(domain => [
          domain.tenant,
          <div key={domain.id}><p className="font-semibold">{domain.domain}</p><p className="text-xs text-[var(--admin-muted)]">{domain.type}</p></div>,
          domain.status,
          <div key={`${domain.id}-dns`}><p>{domain.dns_target}</p><p className="text-xs text-[var(--admin-muted)]">{domain.ssl_status}</p></div>,
          domain.is_primary ? "Sim" : "Não",
          <div key={`${domain.id}-actions`} className="flex flex-wrap gap-2">
            <button className="admin-action-button" onClick={() => void action(`/api/superadmin/domains/${domain.id}/verify`)}><CheckCircle2 className="h-4 w-4" /> Verificar</button>
            <button className="admin-action-button" onClick={() => void action(`/api/superadmin/domains/${domain.id}/primary`, "PUT")}><Star className="h-4 w-4" /> Principal</button>
            <button className="admin-icon-button" title="Remover domínio" aria-label="Remover domínio" onClick={() => void action(`/api/superadmin/domains/${domain.id}`, "DELETE")}><Trash2 className="h-4 w-4" /></button>
          </div>
        ])}
      />
    </div>
  );
}

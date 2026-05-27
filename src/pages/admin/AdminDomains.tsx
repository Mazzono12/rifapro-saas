import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Globe2, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminDataTable, AdminLoadingSkeleton } from "../../components/admin/AdminPremium";

type DomainRecord = {
  id: string;
  domain: string;
  type: "subdomain" | "custom_domain";
  status: string;
  dns_target: string;
  ssl_status: string;
  is_primary: boolean;
  verification_token: string;
  dns_instructions: string;
};

export function AdminDomains() {
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ domain: "", type: "custom_domain" as "subdomain" | "custom_domain" });

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/domains");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao carregar dominios");
      setDomains(data);
    } catch (error) {
      toast.error("Nao foi possivel carregar dominios", { description: error instanceof Error ? error.message : "Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function createDomain(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(data.error || "Falha ao criar dominio");
    toast.success("Dominio cadastrado");
    setForm({ domain: "", type: "custom_domain" });
    await load();
  }

  async function action(path: string, method = "POST") {
    const response = await fetch(path, { method });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(data.error || "Falha na acao");
    toast.success("Dominio atualizado");
    await load();
  }

  if (loading) return <AdminLoadingSkeleton />;

  return (
    <div className="space-y-5">
      <form onSubmit={createDomain} className="admin-card grid gap-3 p-5 md:grid-cols-[1fr_220px_auto]">
        <label className="space-y-1 text-sm text-[var(--admin-muted)]">Domínio ou subdomínio
          <input className="admin-input w-full" value={form.domain} onChange={event => setForm({ ...form, domain: event.target.value })} placeholder="sorteioscliente.com.br" required />
        </label>
        <label className="space-y-1 text-sm text-[var(--admin-muted)]">Tipo
          <select className="admin-input w-full" value={form.type} onChange={event => setForm({ ...form, type: event.target.value as DomainRecord["type"] })}>
            <option value="custom_domain">Domínio próprio</option>
            <option value="subdomain">Subdomínio</option>
          </select>
        </label>
        <button className="admin-button-primary self-end" type="submit"><Plus className="h-4 w-4" /> Adicionar</button>
      </form>

      <section className="admin-card p-5">
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">Instruções DNS</h2>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">Subdomínios usam CNAME. Domínios próprios podem usar CNAME ou A record conforme a infraestrutura. SSL fica preparado como pendente até a emissão real ser integrada.</p>
      </section>

      <AdminDataTable
        columns={["Domínio", "Status", "DNS", "SSL", "Principal", "Ações"]}
        rows={domains.map(domain => [
          <div key={domain.id}><p className="font-semibold">{domain.domain}</p><p className="text-xs text-[var(--admin-muted)]">{domain.type}</p></div>,
          domain.status,
          <div key={`${domain.id}-dns`}><p>{domain.dns_target}</p><p className="text-xs text-[var(--admin-muted)]">{domain.dns_instructions}</p></div>,
          domain.ssl_status,
          domain.is_primary ? "Sim" : "Não",
          <div key={`${domain.id}-actions`} className="flex flex-wrap gap-2">
            <button className="admin-button-secondary" onClick={() => void action(`/api/admin/domains/${domain.id}/verify`)}><CheckCircle2 className="h-4 w-4" /> Verificar</button>
            <button className="admin-button-secondary" onClick={() => void action(`/api/admin/domains/${domain.id}/primary`, "PUT")}><Star className="h-4 w-4" /> Principal</button>
            <button className="admin-icon-button" onClick={() => void action(`/api/admin/domains/${domain.id}`, "DELETE")}><Trash2 className="h-4 w-4" /></button>
          </div>
        ])}
        empty="Nenhum domínio configurado."
      />
    </div>
  );
}

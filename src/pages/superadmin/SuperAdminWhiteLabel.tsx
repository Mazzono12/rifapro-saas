import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Globe2, RefreshCw, ShieldOff } from "lucide-react";
import { toast } from "sonner";

type WhiteLabelTenant = {
  tenant: { id: string; nome: string; slug: string; status: string };
  branding: { display_name?: string; header_name?: string; logo_url?: string };
  domain?: { id: string; domain: string; status: string; ssl_status: string } | null;
  seo?: { meta_title?: string };
  landing?: { headline?: string };
};

export function SuperAdminWhiteLabel() {
  const [rows, setRows] = useState<WhiteLabelTenant[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/superadmin/white-label");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Falha ao carregar White Label");
    setRows(Array.isArray(payload.tenants) ? payload.tenants : []);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(error => {
      setLoading(false);
      toast.error(error.message);
    });
  }, []);

  const totals = useMemo(() => ({
    tenants: rows.length,
    active: rows.filter(row => row.domain?.status === "active").length,
    pending: rows.filter(row => row.domain?.status === "pending").length,
    ssl: rows.filter(row => row.domain?.ssl_status === "active").length
  }), [rows]);

  async function action(domainId: string | undefined, actionName: "activate" | "deactivate" | "revalidate") {
    if (!domainId) return toast.error("Tenant sem domínio cadastrado");
    const response = await fetch(`/api/superadmin/white-label/domains/${domainId}/${actionName}`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) return toast.error(payload.error || "Falha ao atualizar domínio");
    toast.success("Domínio atualizado");
    await load();
  }

  if (loading) return <div className="admin-card p-6 text-[var(--admin-muted)]">Carregando White Label...</div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="admin-card p-4"><p className="text-sm text-[var(--admin-muted)]">Tenants</p><p className="mt-2 text-2xl font-semibold text-[var(--admin-text)]">{totals.tenants}</p></div>
        <div className="admin-card p-4"><p className="text-sm text-[var(--admin-muted)]">Domínios ativos</p><p className="mt-2 text-2xl font-semibold text-[var(--admin-text)]">{totals.active}</p></div>
        <div className="admin-card p-4"><p className="text-sm text-[var(--admin-muted)]">Pendentes</p><p className="mt-2 text-2xl font-semibold text-[var(--admin-text)]">{totals.pending}</p></div>
        <div className="admin-card p-4"><p className="text-sm text-[var(--admin-muted)]">SSL ativo</p><p className="mt-2 text-2xl font-semibold text-[var(--admin-text)]">{totals.ssl}</p></div>
      </div>

      <section className="admin-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] p-4">
          <div>
            <h2 className="mb-1 text-lg font-semibold text-[var(--admin-text)]">White Label</h2>
            <p className="text-sm text-[var(--admin-muted)]">Marcas independentes por tenant</p>
          </div>
          <button type="button" onClick={() => void load()} className="admin-icon-button" aria-label="Atualizar" title="Atualizar"><RefreshCw className="h-4 w-4" /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="text-[var(--admin-muted)]">
              <tr>
                <th className="p-3">Tenant</th>
                <th className="p-3">Marca</th>
                <th className="p-3">Domínio</th>
                <th className="p-3">SSL</th>
                <th className="p-3">Status</th>
                <th className="p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.tenant.id} className="border-t border-[var(--admin-border)] text-[var(--admin-text)]">
                  <td className="p-3"><p className="font-semibold">{row.tenant.nome}</p><p className="text-xs text-[var(--admin-muted)]">{row.tenant.slug}</p></td>
                  <td className="p-3">{row.branding.display_name || row.branding.header_name || row.tenant.nome}</td>
                  <td className="p-3"><div className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-[var(--admin-muted)]" />{row.domain?.domain || "Sem domínio"}</div></td>
                  <td className="p-3">{row.domain?.ssl_status || "pending"}</td>
                  <td className="p-3">{row.domain?.status || row.tenant.status}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void action(row.domain?.id, "activate")} className="admin-action-button"><CheckCircle2 className="h-4 w-4" /> Ativar</button>
                      <button type="button" onClick={() => void action(row.domain?.id, "deactivate")} className="admin-action-button"><ShieldOff className="h-4 w-4" /> Desativar</button>
                      <button type="button" onClick={() => void action(row.domain?.id, "revalidate")} className="admin-action-button"><RefreshCw className="h-4 w-4" /> Revalidar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

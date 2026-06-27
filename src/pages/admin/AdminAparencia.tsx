import { useEffect, useState } from "react";
import { Building2, Image, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { BrandingSettingsForm } from "../../components/branding/BrandingSettingsForm";
import { useTenantBranding } from "../../context/tenant-branding/TenantBrandingContext";

export function AdminAparencia() {
  const { refresh } = useTenantBranding();
  const [branding, setBranding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/branding", { headers: { Accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Nao foi possivel carregar a marca do tenant");
      setBranding(data);
    } catch (error) {
      toast.error("Falha ao carregar aparencia", {
        description: error instanceof Error ? error.message : "Tente novamente."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!branding) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...branding, home_branding: { ...(branding.home_branding || {}), showName: false }, metadata: { ...(branding.metadata || {}), homeBranding: { ...((branding.metadata || {}).homeBranding || {}), showName: false } } })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Nao foi possivel salvar a aparencia");
      setBranding(data);
      await refresh(true);
      toast.success("Marca do tenant salva");
    } catch (error) {
      toast.error("Falha ao salvar aparencia", {
        description: error instanceof Error ? error.message : "Verifique os campos e tente novamente."
      });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/branding/reset", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Nao foi possivel remover a marca");
      setBranding(data);
      await refresh(true);
      toast.success("Marca padrao restaurada");
    } catch (error) {
      toast.error("Falha ao resetar aparencia", {
        description: error instanceof Error ? error.message : "Tente novamente."
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 fade-in">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--admin-primary)]">
            <Building2 className="h-4 w-4" />
            Branding global
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--admin-text)]">Aparencia</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--admin-muted)]">
            Configure nome da empresa e logo oficial do tenant. A marca salva aqui alimenta Admin, login, paginas publicas, campanha, checkout, pedido/PIX, recuperacao de pedido e area de afiliados.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void load()} className="admin-button-secondary">
            <RefreshCw className="h-4 w-4" /> Recarregar
          </button>
          <button type="button" onClick={() => void save()} disabled={saving || !branding} className="admin-button">
            <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </header>

      <section className="rounded-[8px] border border-[#e5e7eb] bg-white p-4 text-[#111827] shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border border-[#dbeafe] bg-[#eff6ff]">
            <Image className="h-5 w-5 text-[#2563eb]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#111827]">Identidade centralizada do tenant</h2>
            <p className="mt-1 text-sm text-[#64748b]">
              A pagina reaproveita os campos oficiais `company_name`, `header_name`, `display_name` e `logo_url`. Uploads usam a galeria segura em `/api/admin/branding/logo`.
            </p>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-[8px] border border-[#e5e7eb] bg-white p-6 text-sm text-[#64748b] shadow-sm">
          Carregando identidade visual...
        </div>
      ) : branding ? (
        <BrandingSettingsForm
          value={branding}
          onChange={setBranding}
          onSave={() => void save()}
          onReset={() => void reset()}
          onUploadComplete={() => void refresh(true)}
          logoEndpoint="/api/admin/branding/logo"
          faviconEndpoint="/api/admin/branding/favicon"
        />
      ) : (
        <div className="rounded-[8px] border border-[#e5e7eb] bg-white p-6 text-sm text-[#64748b] shadow-sm">
          Nao foi possivel carregar a configuracao de marca.
        </div>
      )}
    </div>
  );
}

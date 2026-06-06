import type { Key, ReactNode } from "react";
import { useEffect, useState } from "react";
import { CheckCircle2, Globe2, Image, Landmark, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useTenantBranding } from "../../context/tenant-branding/TenantBrandingContext";

type WhiteLabelPayload = {
  branding: Record<string, any>;
  domains: Array<Record<string, any>>;
  seo: Record<string, any>;
  landing: Record<string, any>;
  legal: Record<string, any>;
};

const tabs = [
  { key: "branding", label: "Identidade Visual", icon: Image },
  { key: "domain", label: "Domínio", icon: Globe2 },
  { key: "seo", label: "SEO", icon: Search },
  { key: "landing", label: "Landing Page", icon: Landmark },
  { key: "legal", label: "Páginas Legais", icon: ShieldCheck }
] as const;

const colorFields = [
  ["primary_color", "Cor principal"],
  ["secondary_color", "Cor secundaria"],
  ["accent_color", "Cor de destaque"],
  ["success_color", "Sucesso"],
  ["warning_color", "Aviso"],
  ["error_color", "Erro"]
];

function Field({ label, children }: { key?: Key; label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-sm font-semibold text-[var(--admin-muted)]">{label}{children}</label>;
}

export function AdminWhiteLabel() {
  const { refresh } = useTenantBranding();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["key"]>("branding");
  const [data, setData] = useState<WhiteLabelPayload | null>(null);
  const [domainForm, setDomainForm] = useState({ domain: "", subdomain: "" });

  async function load() {
    const response = await fetch("/api/admin/white-label");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Falha ao carregar marca");
    setData(payload);
  }

  useEffect(() => {
    load().catch(error => toast.error(error.message));
  }, []);

  async function save(section: "branding" | "seo" | "landing" | "legal") {
    if (!data) return;
    const response = await fetch(`/api/admin/white-label/${section}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data[section])
    });
    const payload = await response.json();
    if (!response.ok) return toast.error(payload.error || "Falha ao salvar");
    setData({ ...data, [section]: payload });
    if (section === "branding") await refresh();
    toast.success("Alterações salvas");
  }

  async function addDomain() {
    const domain = domainForm.domain || domainForm.subdomain;
    if (!domain.trim()) return toast.error("Informe um domínio");
    const response = await fetch("/api/admin/white-label/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, subdomain: domainForm.subdomain, type: domainForm.subdomain ? "subdomain" : "custom_domain" })
    });
    const payload = await response.json();
    if (!response.ok) return toast.error(payload.error || "Falha ao salvar domínio");
    setDomainForm({ domain: "", subdomain: "" });
    await load();
    toast.success("Domínio enviado para validação");
  }

  const update = (section: keyof WhiteLabelPayload, key: string, value: string) => {
    if (!data) return;
    setData({ ...data, [section]: { ...data[section], [key]: value } });
  };

  if (!data) return <div className="admin-card p-6 text-[var(--admin-muted)]">Carregando marca...</div>;

  return (
    <div className="space-y-4">
      <div className="admin-card p-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={activeTab === tab.key ? "admin-button" : "admin-button-secondary"}>
                <Icon className="h-4 w-4" /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "branding" && (
        <section className="admin-card p-4">
          <h2 className="mb-4 text-lg font-semibold text-[var(--admin-text)]">Identidade Visual</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Razão ou empresa"><input className="admin-input" value={data.branding.company_name || ""} onChange={event => update("branding", "company_name", event.target.value)} /></Field>
            <Field label="Nome exibido"><input className="admin-input" value={data.branding.display_name || data.branding.header_name || ""} onChange={event => update("branding", "display_name", event.target.value)} /></Field>
            <Field label="Logo"><input className="admin-input" value={data.branding.logo_url || ""} onChange={event => update("branding", "logo_url", event.target.value)} /></Field>
            <Field label="Favicon"><input className="admin-input" value={data.branding.favicon_url || ""} onChange={event => update("branding", "favicon_url", event.target.value)} /></Field>
            <Field label="Fundo do login"><input className="admin-input" value={data.branding.login_background_url || ""} onChange={event => update("branding", "login_background_url", event.target.value)} /></Field>
            {colorFields.map(([key, label]) => (
              <Field key={key} label={label}><input className="admin-input h-11" type="color" value={data.branding[key] || "#00d66b"} onChange={event => update("branding", key, event.target.value)} /></Field>
            ))}
            <label className="md:col-span-2 grid gap-2 text-sm font-semibold text-[var(--admin-muted)]">CSS personalizado<textarea className="admin-input min-h-[140px]" value={data.branding.custom_css || ""} onChange={event => update("branding", "custom_css", event.target.value)} /></label>
          </div>
          <button type="button" onClick={() => void save("branding")} className="admin-button mt-4"><CheckCircle2 className="h-4 w-4" /> Salvar identidade</button>
        </section>
      )}

      {activeTab === "domain" && (
        <section className="admin-card p-4">
          <h2 className="mb-4 text-lg font-semibold text-[var(--admin-text)]">Domínio</h2>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input className="admin-input" value={domainForm.domain} onChange={event => setDomainForm({ ...domainForm, domain: event.target.value })} placeholder="seudominio.com.br" />
            <input className="admin-input" value={domainForm.subdomain} onChange={event => setDomainForm({ ...domainForm, subdomain: event.target.value })} placeholder="app.suaempresa.com.br" />
            <button type="button" onClick={() => void addDomain()} className="admin-button">Adicionar</button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-[var(--admin-muted)]"><tr><th className="p-3">Domínio</th><th className="p-3">DNS</th><th className="p-3">SSL</th><th className="p-3">Status</th></tr></thead>
              <tbody>{data.domains.map(domain => <tr key={domain.id} className="border-t border-[var(--admin-border)]"><td className="p-3">{domain.domain}</td><td className="p-3">{domain.dns_target}</td><td className="p-3">{domain.ssl_status}</td><td className="p-3">{domain.status}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "seo" && (
        <section className="admin-card p-4">
          <h2 className="mb-4 text-lg font-semibold text-[var(--admin-text)]">SEO</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {["meta_title", "meta_description", "meta_keywords", "og_title", "og_description", "og_image", "twitter_title", "twitter_description", "twitter_image"].map(key => (
              <Field key={key} label={key.replace(/_/g, " ")}><input className="admin-input" value={data.seo[key] || ""} onChange={event => update("seo", key, event.target.value)} /></Field>
            ))}
          </div>
          <button type="button" onClick={() => void save("seo")} className="admin-button mt-4"><CheckCircle2 className="h-4 w-4" /> Salvar SEO</button>
        </section>
      )}

      {activeTab === "landing" && (
        <section className="admin-card p-4">
          <h2 className="mb-4 text-lg font-semibold text-[var(--admin-text)]">Landing Page</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {["headline", "subheadline", "whatsapp", "instagram", "facebook", "youtube", "telegram", "banner_image"].map(key => (
              <Field key={key} label={key.replace(/_/g, " ")}><input className="admin-input" value={data.landing[key] || ""} onChange={event => update("landing", key, event.target.value)} /></Field>
            ))}
            <label className="md:col-span-2 grid gap-2 text-sm font-semibold text-[var(--admin-muted)]">Sobre a empresa<textarea className="admin-input min-h-[150px]" value={data.landing.about_company || ""} onChange={event => update("landing", "about_company", event.target.value)} /></label>
          </div>
          <button type="button" onClick={() => void save("landing")} className="admin-button mt-4"><CheckCircle2 className="h-4 w-4" /> Salvar landing</button>
        </section>
      )}

      {activeTab === "legal" && (
        <section className="admin-card p-4">
          <h2 className="mb-4 text-lg font-semibold text-[var(--admin-text)]">Páginas Legais</h2>
          <div className="grid gap-3">
            {["privacy_policy", "terms_of_service", "lgpd_policy"].map(key => (
              <label key={key} className="grid gap-2 text-sm font-semibold text-[var(--admin-muted)]">{key.replace(/_/g, " ")}<textarea className="admin-input min-h-[170px]" value={data.legal[key] || ""} onChange={event => update("legal", key, event.target.value)} /></label>
            ))}
          </div>
          <button type="button" onClick={() => void save("legal")} className="admin-button mt-4"><CheckCircle2 className="h-4 w-4" /> Salvar páginas</button>
        </section>
      )}
    </div>
  );
}

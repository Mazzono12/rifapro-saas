import { BrandingPreview } from "./BrandingPreview";
import { ColorPicker } from "./ColorPicker";
import { LogoUploader } from "./LogoUploader";
import { sanitizeBrandingImageUrl } from "../../utils/tenantBranding";

export function BrandingSettingsForm({
  value,
  onChange,
  onSave,
  onReset,
  onUploadComplete,
  logoEndpoint,
  faviconEndpoint
}: {
  value: any;
  onChange: (value: any) => void;
  onSave: () => void;
  onReset: () => void;
  onUploadComplete?: () => void;
  logoEndpoint: string;
  faviconEndpoint: string;
}) {
  const set = (field: string, nextValue: any) => onChange({ ...value, [field]: nextValue });
  const normalizePublicLink = (nextValue: string) => {
    const trimmed = nextValue.trim();
    if (!trimmed || trimmed.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
    return "https://" + trimmed;
  };
  const rawHomeBranding = value.home_branding || value.homeBranding || value.metadata?.homeBranding || {};
  const homeBranding = { ...rawHomeBranding, showName: false };
  const mergeUploadedBranding = (uploaded: any) => {
    const nextLogoUrl = uploaded.logo_url || value.logo_url || "";
    const nextLoginLogoUrl = uploaded.login_logo_url || value.login_logo_url || nextLogoUrl;
    const nextFaviconUrl = uploaded.favicon_url || value.favicon_url || "";
    const uploadedHomeBranding = uploaded.home_branding || uploaded.homeBranding || uploaded.metadata?.homeBranding || {};
    onChange({
      ...uploaded,
      logo_url: nextLogoUrl,
      login_logo_url: nextLoginLogoUrl,
      favicon_url: nextFaviconUrl,
      logo_mime_type: uploaded.logo_mime_type || value.logo_mime_type || "",
      header_name: value.header_name || "",
      display_name: value.display_name || "",
      company_name: value.company_name || "",
      home_branding: {
        ...uploadedHomeBranding,
        ...homeBranding,
        showName: false
      },
      metadata: {
        ...(uploaded.metadata || {}),
        homeBranding: {
          ...uploadedHomeBranding,
          ...homeBranding,
          showName: false
        }
      }
    });
    onUploadComplete?.();
  };
  const setBrandName = (nextValue: string) => {
    onChange({
      ...value,
      header_name: nextValue,
      display_name: nextValue,
      company_name: nextValue,
      home_branding: {
        ...homeBranding,
        showName: false
      },
      metadata: {
        ...(value.metadata || {}),
        homeBranding: {
          ...homeBranding,
          showName: false
        }
      }
    });
  };
  const setHomeBranding = (field: string, nextValue: any) => {
    const normalizedValue = typeof nextValue === "string" ? normalizePublicLink(nextValue) : nextValue;
    const nextHomeBranding = {
      ...homeBranding,
      [field]: normalizedValue,
      ...(field === "officialGroup" ? { group: normalizedValue } : {}),
      brandLayout: "inline",
      logoPosition: "left",
      showName: false
    };
    onChange({
      ...value,
      home_branding: nextHomeBranding,
      metadata: {
        ...(value.metadata || {}),
        homeBranding: nextHomeBranding
      }
    });
  };
  const logoUrlIsInvalid = Boolean(value.logo_url) && !sanitizeBrandingImageUrl(value.logo_url);
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="admin-card grid gap-4 p-5">
        <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">Nome no cabeçalho (opcional)<input value={value.header_name || ""} onChange={event => setBrandName(event.target.value)} className="admin-input" placeholder="Deixe vazio para usar apenas a logo" /></label>
        <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">Frase institucional<input value={value.slogan || ""} onChange={event => set("slogan", event.target.value)} className="admin-input" placeholder="Tecnologia premium para gestao avancada" /></label>
        <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">WhatsApp suporte<input value={value.support_whatsapp || ""} onChange={event => set("support_whatsapp", event.target.value)} className="admin-input" /></label>
        <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">Texto do rodape<textarea value={value.footer_text || ""} onChange={event => set("footer_text", event.target.value)} className="admin-input min-h-24" /></label>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">
            <span>Logo principal</span>
            <input value={value.logo_url || ""} onChange={event => set("logo_url", event.target.value)} className="admin-input" placeholder="https://cdn.suaempresa.com/logo.png" />
            <div className="flex flex-wrap items-center gap-2">
              <LogoUploader endpoint={logoEndpoint} onUploaded={mergeUploadedBranding} label="Subir logo da galeria" />
              <button type="button" onClick={() => onChange({ ...value, logo_url: "", login_logo_url: "" })} className="admin-button-secondary">Remover/trocar logo</button>
            </div>
            {logoUrlIsInvalid && <span className="text-xs font-semibold text-slate-600">Use uma URL http/https de imagem ou um arquivo enviado em /uploads.</span>}
          </div>
          <div className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">
            <span>Favicon</span>
            <input value={value.favicon_url || ""} onChange={event => set("favicon_url", event.target.value)} className="admin-input" placeholder="https://cdn.suaempresa.com/favicon.png" />
            <LogoUploader endpoint={faviconEndpoint} onUploaded={mergeUploadedBranding} label="Subir favicon da galeria" />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <ColorPicker label="Cor primaria" value={value.primary_color || "#00d66b"} onChange={next => set("primary_color", next)} />
          <ColorPicker label="Cor secundaria" value={value.secondary_color || "#0f2d1d"} onChange={next => set("secondary_color", next)} />
          <ColorPicker label="Cor CTA" value={value.cta_color || "#00d66b"} onChange={next => set("cta_color", next)} />
        </div>
        <div className="mt-2 grid gap-4 rounded-[8px] border border-[var(--admin-border)] bg-slate-50 p-4">
          <div>
            <p className="text-sm font-semibold text-[var(--admin-text)]">Branding Home</p>
            <p className="mt-1 text-xs text-[var(--admin-muted)]">Configure a marca e os canais exibidos dentro da Home Premium V1.</p>
          </div>
          <div className="rounded-[8px] border border-[var(--admin-border)] bg-white p-3 text-sm font-semibold text-[var(--admin-muted)]">
            A Home exibe apenas a logo cadastrada. O nome da empresa nao aparece ao lado da marca.
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">Link do WhatsApp da Home<input value={homeBranding.whatsapp || ""} onChange={event => setHomeBranding("whatsapp", event.target.value)} className="admin-input" placeholder="https://wa.me/5599999999999" /></label>
            <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">Link do Instagram da Home<input value={homeBranding.instagram || ""} onChange={event => setHomeBranding("instagram", event.target.value)} className="admin-input" placeholder="https://instagram.com/suaempresa" /></label>
            <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">Link do Grupo Oficial do WhatsApp<input value={homeBranding.officialGroup || homeBranding.group || ""} onChange={event => setHomeBranding("officialGroup", event.target.value)} className="admin-input" placeholder="https://chat.whatsapp.com/seu-grupo" /></label>
          </div>
        </div>
        <div className="mt-2 grid gap-4 rounded-[8px] border border-[var(--admin-border)] bg-slate-50 p-4">
          <div>
            <p className="text-sm font-semibold text-[var(--admin-text)]">Login premium</p>
            <p className="mt-1 text-xs text-[var(--admin-muted)]">Personalize a primeira impressão do painel profissional.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">Logo do login<input value={value.login_logo_url || ""} onChange={event => set("login_logo_url", event.target.value)} className="admin-input" placeholder="URL da logo" /></label>
            <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">Imagem de fundo<input value={value.login_background_url || ""} onChange={event => set("login_background_url", event.target.value)} className="admin-input" placeholder="URL da imagem" /></label>
          </div>
          <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">Titulo<input value={value.login_title || ""} onChange={event => set("login_title", event.target.value)} className="admin-input" placeholder="Titulo do login" /></label>
          <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">Subtitulo<input value={value.login_subtitle || ""} onChange={event => set("login_subtitle", event.target.value)} className="admin-input" placeholder="Acesse seu ambiente exclusivo com segurança, controle e alta performance." /></label>
          <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">Texto de apoio<textarea value={value.login_support_text || ""} onChange={event => set("login_support_text", event.target.value)} className="admin-input min-h-24" placeholder="Tecnologia premium para gestão inteligente, operação avançada e crescimento profissional." /></label>
          <div className="grid gap-3 md:grid-cols-2">
            <ColorPicker label="Cor principal do login" value={value.login_primary_color || value.primary_color || "#00d66b"} onChange={next => set("login_primary_color", next)} />
            <ColorPicker label="Cor de destaque do login" value={value.login_accent_color || value.cta_color || "#f5c451"} onChange={next => set("login_accent_color", next)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">Texto do botão<input value={value.login_button_text || ""} onChange={event => set("login_button_text", event.target.value)} className="admin-input" placeholder="Entrar com segurança" /></label>
            <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">Rodapé do login<input value={value.login_footer_text || ""} onChange={event => set("login_footer_text", event.target.value)} className="admin-input" placeholder="Ambiente protegido • Acesso autorizado" /></label>
          </div>
        </div>
        <label className="grid gap-2 text-sm font-semibold text-[var(--admin-text)]">Modo visual
          <select value={value.theme_mode || "vimeu_dark"} onChange={event => set("theme_mode", event.target.value)} className="admin-input">
            <option value="vimeu_dark">Vimeu Dark</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onSave} disabled={logoUrlIsInvalid} className="admin-button disabled:cursor-not-allowed disabled:opacity-50">Salvar marca</button>
          <button type="button" onClick={onReset} className="admin-button-secondary">Resetar padrão</button>
        </div>
        <p className="text-xs font-semibold text-[var(--admin-muted)]">Logo compatível com PNG, JPG, WEBP, SVG e GIF animado.</p>
      </div>
      <BrandingPreview branding={value} />
    </div>
  );
}


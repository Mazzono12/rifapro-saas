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
  const homeBranding = value.home_branding || value.homeBranding || value.metadata?.homeBranding || {};
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
        showName: (value.header_name || value.display_name || value.company_name || "").trim() ? homeBranding.showName !== false : false
      },
      metadata: {
        ...(uploaded.metadata || {}),
        homeBranding: {
          ...uploadedHomeBranding,
          ...homeBranding,
          showName: (value.header_name || value.display_name || value.company_name || "").trim() ? homeBranding.showName !== false : false
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
        showName: nextValue.trim() ? homeBranding.showName !== false : false
      },
      metadata: {
        ...(value.metadata || {}),
        homeBranding: {
          ...homeBranding,
          showName: nextValue.trim() ? homeBranding.showName !== false : false
        }
      }
    });
  };
  const setHomeBranding = (field: string, nextValue: any) => {
    const nextHomeBranding = {
      ...homeBranding,
      [field]: nextValue,
      brandLayout: "inline",
      logoPosition: "left"
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
      <div className="premium-card grid gap-4 p-5">
        <label className="grid gap-2 text-sm font-semibold text-slate-300">Nome no cabeçalho (opcional)<input value={value.header_name || ""} onChange={event => setBrandName(event.target.value)} className="admin-input" placeholder="Deixe vazio para usar apenas a logo" /></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-300">Frase institucional<input value={value.slogan || ""} onChange={event => set("slogan", event.target.value)} className="admin-input" placeholder="Tecnologia premium para gestao avancada" /></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-300">WhatsApp suporte<input value={value.support_whatsapp || ""} onChange={event => set("support_whatsapp", event.target.value)} className="admin-input" /></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-300">Texto do rodape<textarea value={value.footer_text || ""} onChange={event => set("footer_text", event.target.value)} className="admin-input min-h-24" /></label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-slate-300">
            Logo principal por URL
            <input value={value.logo_url || ""} onChange={event => set("logo_url", event.target.value)} className="admin-input" placeholder="https://cdn.suaempresa.com/logo.png" />
            {logoUrlIsInvalid && <span className="text-xs font-semibold text-slate-600">Use uma URL http/https de imagem ou um arquivo enviado em /uploads.</span>}
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-300">Favicon por URL<input value={value.favicon_url || ""} onChange={event => set("favicon_url", event.target.value)} className="admin-input" placeholder="https://cdn.suaempresa.com/favicon.png" /></label>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <ColorPicker label="Cor primaria" value={value.primary_color || "#00d66b"} onChange={next => set("primary_color", next)} />
          <ColorPicker label="Cor secundaria" value={value.secondary_color || "#0f2d1d"} onChange={next => set("secondary_color", next)} />
          <ColorPicker label="Cor CTA" value={value.cta_color || "#00d66b"} onChange={next => set("cta_color", next)} />
        </div>
        <div className="mt-2 grid gap-4 rounded-2xl border border-slate-200 bg-slate-100 p-4">
          <div>
            <p className="text-sm font-black text-white">Branding Home</p>
            <p className="mt-1 text-xs text-slate-400">Configure a marca e os canais exibidos dentro da Home Premium V1.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-bold ${homeBranding.showName !== false ? "border-slate-200 bg-slate-100 text-white" : "border-white/10 bg-black/20 text-slate-300"}`}>
              <input
                type="checkbox"
                checked={homeBranding.showName !== false}
                onChange={event => setHomeBranding("showName", event.target.checked)}
              />
              Exibir nome junto da logo
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-100 p-3 text-sm font-bold text-white">
              Logo e nome sempre alinhados à esquerda na Home.
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold text-slate-300">WhatsApp da Home<input value={homeBranding.whatsapp || ""} onChange={event => setHomeBranding("whatsapp", event.target.value)} className="admin-input" placeholder="https://wa.me/..." /></label>
            <label className="grid gap-2 text-sm font-semibold text-slate-300">Instagram da Home<input value={homeBranding.instagram || ""} onChange={event => setHomeBranding("instagram", event.target.value)} className="admin-input" placeholder="https://instagram.com/..." /></label>
            <label className="grid gap-2 text-sm font-semibold text-slate-300">Grupo Oficial<input value={homeBranding.officialGroup || ""} onChange={event => setHomeBranding("officialGroup", event.target.value)} className="admin-input" placeholder="https://chat.whatsapp.com/..." /></label>
          </div>
        </div>
        <div className="mt-2 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div>
            <p className="text-sm font-black text-white">Login premium</p>
            <p className="mt-1 text-xs text-slate-400">Personalize a primeira impressão do painel profissional.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-300">Logo do login<input value={value.login_logo_url || ""} onChange={event => set("login_logo_url", event.target.value)} className="admin-input" placeholder="URL da logo" /></label>
            <label className="grid gap-2 text-sm font-semibold text-slate-300">Imagem de fundo<input value={value.login_background_url || ""} onChange={event => set("login_background_url", event.target.value)} className="admin-input" placeholder="URL da imagem" /></label>
          </div>
          <label className="grid gap-2 text-sm font-semibold text-slate-300">Titulo<input value={value.login_title || ""} onChange={event => set("login_title", event.target.value)} className="admin-input" placeholder="Titulo do login" /></label>
          <label className="grid gap-2 text-sm font-semibold text-slate-300">Subtitulo<input value={value.login_subtitle || ""} onChange={event => set("login_subtitle", event.target.value)} className="admin-input" placeholder="Acesse seu ambiente exclusivo com segurança, controle e alta performance." /></label>
          <label className="grid gap-2 text-sm font-semibold text-slate-300">Texto de apoio<textarea value={value.login_support_text || ""} onChange={event => set("login_support_text", event.target.value)} className="admin-input min-h-24" placeholder="Tecnologia premium para gestão inteligente, operação avançada e crescimento profissional." /></label>
          <div className="grid gap-3 md:grid-cols-2">
            <ColorPicker label="Cor principal do login" value={value.login_primary_color || value.primary_color || "#00d66b"} onChange={next => set("login_primary_color", next)} />
            <ColorPicker label="Cor de destaque do login" value={value.login_accent_color || value.cta_color || "#f5c451"} onChange={next => set("login_accent_color", next)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-300">Texto do botão<input value={value.login_button_text || ""} onChange={event => set("login_button_text", event.target.value)} className="admin-input" placeholder="Entrar com segurança" /></label>
            <label className="grid gap-2 text-sm font-semibold text-slate-300">Rodapé do login<input value={value.login_footer_text || ""} onChange={event => set("login_footer_text", event.target.value)} className="admin-input" placeholder="Ambiente protegido • Acesso autorizado" /></label>
          </div>
        </div>
        <label className="grid gap-2 text-sm font-semibold text-slate-300">Modo visual
          <select value={value.theme_mode || "vimeu_dark"} onChange={event => set("theme_mode", event.target.value)} className="admin-input">
            <option value="vimeu_dark">Vimeu Dark</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-3">
          <LogoUploader endpoint={logoEndpoint} onUploaded={mergeUploadedBranding} label="Enviar logo/GIF" />
          <LogoUploader endpoint={faviconEndpoint} onUploaded={mergeUploadedBranding} label="Enviar favicon/GIF" />
          <button type="button" onClick={() => onChange({ ...value, logo_url: "", login_logo_url: "" })} className="premium-button-ghost min-h-12 rounded-xl px-5 py-3 text-sm font-bold">Remover/trocar logo</button>
          <button type="button" onClick={onSave} disabled={logoUrlIsInvalid} className="premium-button rounded-xl px-5 py-3 disabled:cursor-not-allowed disabled:opacity-50">Salvar marca</button>
          <button type="button" onClick={onReset} className="premium-button-ghost min-h-12 rounded-xl px-5 py-3 text-sm font-bold">Resetar padrão</button>
        </div>
        <p className="text-xs font-semibold text-slate-400">Logo compatível com PNG, JPG, WEBP, SVG e GIF animado.</p>
      </div>
      <BrandingPreview branding={value} />
    </div>
  );
}


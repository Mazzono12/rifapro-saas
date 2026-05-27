import { BrandingPreview } from "./BrandingPreview";
import { ColorPicker } from "./ColorPicker";
import { LogoUploader } from "./LogoUploader";

export function BrandingSettingsForm({
  value,
  onChange,
  onSave,
  onReset,
  logoEndpoint,
  faviconEndpoint
}: {
  value: any;
  onChange: (value: any) => void;
  onSave: () => void;
  onReset: () => void;
  logoEndpoint: string;
  faviconEndpoint: string;
}) {
  const set = (field: string, nextValue: any) => onChange({ ...value, [field]: nextValue });
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="premium-card grid gap-4 p-5">
        <label className="grid gap-2 text-sm font-semibold text-slate-300">Nome do cabeçalho<input value={value.header_name || ""} onChange={event => set("header_name", event.target.value)} className="admin-input" /></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-300">Slogan<input value={value.slogan || ""} onChange={event => set("slogan", event.target.value)} className="admin-input" /></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-300">WhatsApp suporte<input value={value.support_whatsapp || ""} onChange={event => set("support_whatsapp", event.target.value)} className="admin-input" /></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-300">Texto do rodape<textarea value={value.footer_text || ""} onChange={event => set("footer_text", event.target.value)} className="admin-input min-h-24" /></label>
        <div className="grid gap-3 md:grid-cols-3">
          <ColorPicker label="Cor primaria" value={value.primary_color || "#00d66b"} onChange={next => set("primary_color", next)} />
          <ColorPicker label="Cor secundaria" value={value.secondary_color || "#0f2d1d"} onChange={next => set("secondary_color", next)} />
          <ColorPicker label="Cor CTA" value={value.cta_color || "#00d66b"} onChange={next => set("cta_color", next)} />
        </div>
        <label className="grid gap-2 text-sm font-semibold text-slate-300">Modo visual
          <select value={value.theme_mode || "premium"} onChange={event => set("theme_mode", event.target.value)} className="admin-input">
            <option value="premium">Premium</option>
            <option value="dark">Escuro</option>
            <option value="light">Claro</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-3">
          <LogoUploader endpoint={logoEndpoint} onUploaded={onChange} />
          <LogoUploader endpoint={faviconEndpoint} onUploaded={onChange} />
          <button type="button" onClick={onSave} className="neon-button rounded-xl px-5 py-3">Salvar aparência</button>
          <button type="button" onClick={onReset} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-200">Resetar padrão</button>
        </div>
      </div>
      <BrandingPreview branding={value} />
    </div>
  );
}

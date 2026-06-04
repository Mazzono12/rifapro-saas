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
        <label className="grid gap-2 text-sm font-semibold text-slate-300">Nome no cabeçalho<input value={value.header_name || ""} onChange={event => set("header_name", event.target.value)} className="admin-input" placeholder="CIFHER Prime" /></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-300">Frase institucional<input value={value.slogan || ""} onChange={event => set("slogan", event.target.value)} className="admin-input" placeholder="Tecnologia premium para gestao avancada" /></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-300">WhatsApp suporte<input value={value.support_whatsapp || ""} onChange={event => set("support_whatsapp", event.target.value)} className="admin-input" /></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-300">Texto do rodape<textarea value={value.footer_text || ""} onChange={event => set("footer_text", event.target.value)} className="admin-input min-h-24" /></label>
        <div className="grid gap-3 md:grid-cols-3">
          <ColorPicker label="Cor primaria" value={value.primary_color || "#00d66b"} onChange={next => set("primary_color", next)} />
          <ColorPicker label="Cor secundaria" value={value.secondary_color || "#0f2d1d"} onChange={next => set("secondary_color", next)} />
          <ColorPicker label="Cor CTA" value={value.cta_color || "#00d66b"} onChange={next => set("cta_color", next)} />
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
          <label className="grid gap-2 text-sm font-semibold text-slate-300">Titulo<input value={value.login_title || ""} onChange={event => set("login_title", event.target.value)} className="admin-input" placeholder="CIFHER Prime" /></label>
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
          <LogoUploader endpoint={logoEndpoint} onUploaded={onChange} />
          <LogoUploader endpoint={faviconEndpoint} onUploaded={onChange} />
          <button type="button" onClick={onSave} className="premium-button rounded-xl px-5 py-3">Salvar marca</button>
          <button type="button" onClick={onReset} className="premium-button-ghost min-h-12 rounded-xl px-5 py-3 text-sm font-bold">Resetar padrão</button>
        </div>
      </div>
      <BrandingPreview branding={value} />
    </div>
  );
}

import { TenantLogo } from "./TenantLogo";
import { getReadableTextColor, getContrastRatio } from "../../lib/contrast";

export function BrandingPreview({ branding }: { branding: any }) {
  const ctaColor = branding.cta_color || "#00d66b";
  const ctaTextColor = getReadableTextColor(ctaColor);
  const ctaContrast = getContrastRatio(ctaTextColor, ctaColor);
  const loginPrimary = branding.login_primary_color || branding.primary_color || "#00d66b";
  const loginAccent = branding.login_accent_color || branding.cta_color || "#f5c451";
  const loginLogo = branding.login_logo_url || branding.logo_url;
  const brandName = String(branding.display_name || branding.header_name || branding.company_name || "").trim();
  const showName = branding.home_branding?.showName !== false && Boolean(brandName);
  return (
    <div className="grid gap-4">
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/50">
      <div className="flex items-center gap-3 border-b border-white/10 p-4" style={{ ["--tenant-primary" as string]: branding.primary_color || "#00d66b" }}>
        {branding.logo_url ? (
          <span className="tenant-logo-slot tenant-logo-slot-image branding-preview-logo">
            <img src={branding.logo_url} alt={brandName || "Logo da marca"} className="tenant-logo-img" />
          </span>
        ) : <TenantLogo />}
        {showName && <div>
          <p className="text-lg font-black text-white">{brandName}</p>
          <p className="text-xs font-semibold text-slate-400">{branding.slogan || "Sorteios premium"}</p>
        </div>}
      </div>
      <div className="p-4">
        <button type="button" className="rounded-2xl px-5 py-3 text-sm font-black" style={{ background: ctaColor, color: ctaTextColor }}>
          Participar agora
        </button>
        {ctaContrast < 4.5 && <p className="mt-3 rounded-xl border border-amber-200/25 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100">Contraste ajustado automaticamente para manter o CTA legivel.</p>}
        <p className="mt-4 text-sm text-slate-400">{branding.footer_text || "Rodape da empresa"}</p>
      </div>
    </div>
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/60">
      <div
        className="p-4"
        style={{
          background: branding.login_background_url
            ? `linear-gradient(135deg, rgba(2,6,12,0.88), rgba(2,8,6,0.72)), url("${branding.login_background_url}") center/cover`
            : `radial-gradient(circle at 15% 10%, ${loginPrimary}33, transparent 36%), radial-gradient(circle at 90% 0%, ${loginAccent}2e, transparent 30%), #030604`
        }}
      >
        <div className="rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-3">
            <div className="auth-brand-logo-slot is-preview">
              {loginLogo ? <img src={loginLogo} alt={branding.login_title || branding.header_name} className="auth-brand-logo-img" /> : <span className="font-black" style={{ color: loginAccent }}>C</span>}
            </div>
            <div>
              <p className="text-sm font-black text-white">{branding.login_title || "CIFHER Prime"}</p>
              <p className="text-xs text-slate-400">Acesso protegido</p>
            </div>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: loginAccent }}>Ambiente exclusivo</p>
          <p className="mt-2 text-sm font-semibold text-white">{branding.login_subtitle || "Acesse seu ambiente exclusivo com segurança, controle e alta performance."}</p>
          <button type="button" className="mt-4 w-full rounded-xl px-4 py-3 text-xs font-black text-black" style={{ background: `linear-gradient(135deg, ${loginAccent}, ${loginPrimary})` }}>
            {branding.login_button_text || "Entrar com segurança"}
          </button>
          <p className="mt-3 text-center text-[11px] font-semibold text-slate-500">{branding.login_footer_text || "Ambiente protegido • Acesso autorizado"}</p>
        </div>
      </div>
    </div>
    </div>
  );
}

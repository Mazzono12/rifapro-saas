import { TenantLogo } from "./TenantLogo";
import { getReadableTextColor, getContrastRatio } from "../../lib/contrast";
import { resolveTenantCompanyName, resolveTenantLogoUrl, sanitizeBrandingImageUrl } from "../../utils/tenantBranding";

export function BrandingPreview({ branding }: { branding: any }) {
  const ctaColor = branding.cta_color || "#2563eb";
  const ctaTextColor = getReadableTextColor(ctaColor);
  const ctaContrast = getContrastRatio(ctaTextColor, ctaColor);
  const loginPrimary = branding.login_primary_color || branding.primary_color || "#2563eb";
  const logoUrl = resolveTenantLogoUrl(branding);
  const loginLogo = sanitizeBrandingImageUrl(branding.login_logo_url) || logoUrl;
  const brandName = resolveTenantCompanyName(branding);
  const showName = false;

  return (
    <div className="grid gap-4">
      <div className="overflow-hidden rounded-[8px] border border-[var(--admin-border)] bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-[var(--admin-border)] p-4" style={{ ["--tenant-primary" as string]: branding.primary_color || "#2563eb" }}>
          {logoUrl ? (
            <span className="tenant-logo-slot tenant-logo-slot-image branding-preview-logo">
              <img src={logoUrl} alt={brandName || "Logo da marca"} className="tenant-logo-img" />
            </span>
          ) : <TenantLogo />}
          {showName && <div>
            <p className="text-lg font-semibold text-[var(--admin-text)]">{brandName}</p>
            <p className="text-xs font-medium text-[var(--admin-muted)]">{branding.slogan || "Sorteios premium"}</p>
          </div>}
        </div>
        <div className="p-4">
          <button type="button" className="rounded-[8px] px-5 py-3 text-sm font-semibold" style={{ background: ctaColor, color: ctaTextColor }}>
            Participar agora
          </button>
          {ctaContrast < 4.5 && <p className="mt-3 rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">Contraste ajustado automaticamente para manter o CTA legivel.</p>}
          <p className="mt-4 text-sm text-[var(--admin-muted)]">{branding.footer_text || "Rodape da empresa"}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[8px] border border-[var(--admin-border)] bg-white shadow-sm">
        <div
          className="p-4"
          style={{
            background: branding.login_background_url
              ? `linear-gradient(135deg, rgba(248,250,252,0.94), rgba(241,245,249,0.9)), url("${branding.login_background_url}") center/cover`
              : "linear-gradient(135deg, #ffffff, #f8fafc)"
          }}
        >
          <div className="rounded-[8px] border border-[var(--admin-border)] bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="auth-brand-logo-slot is-preview">
                {loginLogo ? <img src={loginLogo} alt={branding.login_title || brandName} className="auth-brand-logo-img" /> : <span className="font-semibold" style={{ color: loginPrimary }}>R</span>}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--admin-text)]">{branding.login_title || brandName || "RifaPro"}</p>
                <p className="text-xs text-[var(--admin-muted)]">Acesso protegido</p>
              </div>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: loginPrimary }}>Ambiente exclusivo</p>
            <p className="mt-2 text-sm font-medium text-[var(--admin-text)]">{branding.login_subtitle || "Acesse seu ambiente exclusivo com segurança, controle e alta performance."}</p>
            <button type="button" className="mt-4 w-full rounded-[8px] px-4 py-3 text-xs font-semibold text-white" style={{ background: loginPrimary }}>
              {branding.login_button_text || "Entrar com segurança"}
            </button>
            <p className="mt-3 text-center text-[11px] font-medium text-[var(--admin-muted)]">{branding.login_footer_text || "Ambiente protegido - Acesso autorizado"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
import { TenantLogo } from "./TenantLogo";
import { getReadableTextColor, getContrastRatio } from "../../lib/contrast";

export function BrandingPreview({ branding }: { branding: any }) {
  const ctaColor = branding.cta_color || "#00d66b";
  const ctaTextColor = getReadableTextColor(ctaColor);
  const ctaContrast = getContrastRatio(ctaTextColor, ctaColor);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/50">
      <div className="flex items-center gap-3 border-b border-white/10 p-4" style={{ ["--tenant-primary" as string]: branding.primary_color || "#00d66b" }}>
        {branding.logo_url ? <img src={branding.logo_url} alt={branding.header_name} className="h-11 w-11 rounded-xl object-contain" loading="lazy" /> : <TenantLogo />}
        <div>
          <p className="text-lg font-black text-white">{branding.header_name || "RifaPro"}</p>
          <p className="text-xs font-semibold text-slate-400">{branding.slogan || "Sorteios premium"}</p>
        </div>
      </div>
      <div className="p-4">
        <button type="button" className="rounded-2xl px-5 py-3 text-sm font-black" style={{ background: ctaColor, color: ctaTextColor }}>
          Participar agora
        </button>
        {ctaContrast < 4.5 && <p className="mt-3 rounded-xl border border-amber-200/25 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100">Contraste ajustado automaticamente para manter o CTA legivel.</p>}
        <p className="mt-4 text-sm text-slate-400">{branding.footer_text || "Rodape do tenant"}</p>
      </div>
    </div>
  );
}

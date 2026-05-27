import { TenantLogo } from "./TenantLogo";

export function BrandingPreview({ branding }: { branding: any }) {
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
        <button type="button" className="rounded-2xl px-5 py-3 text-sm font-black text-black" style={{ background: branding.cta_color || "#00d66b" }}>
          Participar agora
        </button>
        <p className="mt-4 text-sm text-slate-400">{branding.footer_text || "Rodape do tenant"}</p>
      </div>
    </div>
  );
}

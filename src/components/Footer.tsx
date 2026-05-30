import { Mail, Building2, ExternalLink } from "lucide-react";
import { useGlobalSettings } from "../hooks/useRaffles";
import { useTenantBranding } from "../context/tenant-branding/TenantBrandingContext";
import { ResponsiveMediaFrame } from "./ResponsiveMediaFrame";

export function Footer() {
  const { data: settings } = useGlobalSettings();
  const { branding } = useTenantBranding();
  const footer = settings?.footer;
  if (!footer) return null;

  return (
    <footer className="premium-site-footer relative z-10 mt-10 border-t border-[var(--theme-border)] bg-[var(--theme-surface-strong)]/80 backdrop-blur-2xl">
      <div className="container mx-auto grid gap-8 px-4 py-10 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            {branding.logo_url || footer.ownerLogoUrl ? (
              <ResponsiveMediaFrame src={branding.logo_url || footer.ownerLogoUrl} type="image" alt={branding.header_name || footer.ownerName} preferredFit="contain" aspectMode="square" className="h-11 w-11 rounded-xl border border-white/10" />
            ) : (
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
                <Building2 className="h-5 w-5 text-[var(--theme-primary)]" />
              </div>
            )}
            <div>
              <p className="font-display text-lg font-bold text-white">{branding.header_name || footer.companyName}</p>
              <p className="text-xs font-mono text-slate-500">CNPJ {footer.cnpj}</p>
            </div>
          </div>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-slate-400">{branding.footer_text || footer.mission}</p>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-widest text-slate-500">Central</h3>
          <p className="text-sm text-slate-400"><strong className="text-white">FAQ:</strong> {footer.faq}</p>
          <p className="text-sm text-slate-400"><strong className="text-white">Termos:</strong> {footer.terms}</p>
          <a href="/transparencia" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--theme-primary)] hover:text-white">
            Transparência dos sorteios
          </a>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-widest text-slate-500">Contato</h3>
          <a href={`mailto:${footer.email}`} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white">
            <Mail className="h-4 w-4" /> {footer.email}
          </a>
          <p className="text-sm text-slate-400">Sistema por {footer.ownerName}</p>
          {footer.ownerSocial && (
            <a href={footer.ownerSocial} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-[var(--theme-primary)] hover:text-white">
              Redes sociais <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {footer.ownerContact && <p className="text-xs font-mono text-slate-500">{footer.ownerContact}</p>}
        </div>
      </div>
    </footer>
  );
}

import React from "react";
import { motion } from "motion/react";
import { Gauge, LockKeyhole, ShieldCheck } from "lucide-react";
import { PremiumPageLayout } from "../../components/premium/PremiumUI";
import { useTenantBranding } from "../../context/tenant-branding/TenantBrandingContext";

/* ui-contrast contract: Acesso seguro */

export function AuthShell({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  const { branding } = useTenantBranding();
  const loginTitle = title || branding.login_title || "CIFHER Prime";
  const loginSubtitle = subtitle || branding.login_subtitle || "Acesse seu ambiente exclusivo com segurança, controle e alta performance.";
  const supportText = branding.login_support_text || "Tecnologia premium para gestão inteligente, operação avançada e crescimento profissional.";
  const footerText = branding.login_footer_text || "Ambiente protegido • Acesso autorizado";
  const logoUrl = branding.login_logo_url || branding.logo_url;
  const primaryColor = branding.login_primary_color || branding.colors.primary || "#00d66b";
  const accentColor = branding.login_accent_color || branding.colors.cta || "#f5c451";
  const highlights = [
    { label: "Acesso", value: "protegido", icon: LockKeyhole },
    { label: "Controle", value: "completo", icon: ShieldCheck },
    { label: "Performance", value: "alta", icon: Gauge }
  ];

  return (
    <PremiumPageLayout className="overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: branding.login_background_url
            ? `linear-gradient(135deg, rgba(1,5,10,0.88), rgba(1,7,5,0.74)), url("${branding.login_background_url}")`
            : `radial-gradient(circle at 18% 12%, ${primaryColor}2e, transparent 32%), radial-gradient(circle at 84% 14%, ${accentColor}24, transparent 28%), linear-gradient(145deg, #030604, #08100c 48%, #04060b)`
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_20%,rgba(0,0,0,0.34))]" />
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />
      <main className="relative z-10 grid min-h-screen place-items-center px-4 py-8 sm:py-10">
        <motion.section
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45 }}
          className="grid w-full max-w-6xl overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/45 text-white shadow-[0_30px_120px_rgba(0,0,0,0.62)] backdrop-blur-2xl lg:grid-cols-[1fr_0.9fr]"
        >
          <div className="relative hidden min-h-[640px] border-r border-white/10 p-10 lg:block">
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primaryColor}26, transparent 42%), radial-gradient(circle at 50% 56%, ${accentColor}1c, transparent 36%)` }} />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-center gap-3">
                <div className="auth-brand-logo-slot">
                  {logoUrl ? <img src={logoUrl} alt={loginTitle} className="auth-brand-logo-img" /> : <span className="text-xl font-black" style={{ color: accentColor }}>C</span>}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{loginTitle}</p>
                  <p className="text-xs text-slate-400">Experiência profissional</p>
                </div>
              </div>
              <div>
                <p className="mb-4 text-xs uppercase tracking-[0.28em]" style={{ color: accentColor }}>Ambiente exclusivo</p>
                <h2 className="max-w-xl text-5xl font-semibold leading-tight text-white">Painel profissional para gestão avançada.</h2>
                <p className="mt-5 max-w-lg text-sm leading-6 text-slate-300">{supportText}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs text-slate-300">
                {highlights.map(item => {
                  const Icon = item.icon;
                  return (
                  <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                    <Icon className="mb-3 h-4 w-4" style={{ color: accentColor }} />
                    <p className="text-white">{item.label}</p>
                    <p className="mt-1 text-slate-500">{item.value}</p>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="p-6 sm:p-10 lg:p-12">
            <div className="mb-9">
              <div className="mb-7 flex items-center gap-3 lg:hidden">
                <div className="auth-brand-logo-slot is-mobile">
                  {logoUrl ? <img src={logoUrl} alt={loginTitle} className="auth-brand-logo-img" /> : <span className="text-lg font-black" style={{ color: accentColor }}>C</span>}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{loginTitle}</p>
                  <p className="text-xs text-slate-400">Acesso protegido</p>
                </div>
              </div>
              <p className="mb-3 text-xs uppercase tracking-[0.24em]" style={{ color: accentColor }}>Acesso protegido</p>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{loginTitle}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">{loginSubtitle}</p>
            </div>
            {children}
            <p className="mt-7 text-center text-xs font-semibold text-slate-500">{footerText}</p>
          </div>
        </motion.section>
      </main>
    </PremiumPageLayout>
  );
}

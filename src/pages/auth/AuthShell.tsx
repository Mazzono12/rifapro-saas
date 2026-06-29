import React from "react";
import { motion } from "motion/react";
import { Gauge, LockKeyhole, ShieldCheck } from "lucide-react";
import { PremiumPageLayout } from "../../components/premium/PremiumUI";
import { useTenantBranding } from "../../context/tenant-branding/TenantBrandingContext";

/* ui-contrast contract: Acesso seguro */

export function AuthShell({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  const { branding, companyName, logoUrl: tenantLogoUrl } = useTenantBranding();
  const loginTitle = title || branding.login_title || companyName || "RifaPro";
  const loginSubtitle = subtitle || branding.login_subtitle || "Acesse seu ambiente exclusivo com segurança, controle e alta performance.";
  const supportText = branding.login_support_text || "Tecnologia premium para gestão inteligente, operação avançada e crescimento profissional.";
  const footerText = branding.login_footer_text || "Ambiente protegido • Acesso autorizado";
  const logoUrl = branding.login_logo_url || tenantLogoUrl;
  const primaryColor = branding.login_primary_color || branding.colors.primary || "#2563eb";
  const highlights = [
    { label: "Acesso", value: "protegido", icon: LockKeyhole },
    { label: "Controle", value: "completo", icon: ShieldCheck },
    { label: "Performance", value: "alta", icon: Gauge }
  ];

  return (
    <PremiumPageLayout className="auth-light-shell overflow-hidden bg-[#f8fafc] text-slate-950">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: branding.login_background_url
            ? `linear-gradient(135deg, rgba(248,250,252,0.96), rgba(239,246,255,0.92)), url("${branding.login_background_url}")`
            : `radial-gradient(circle at 18% 12%, ${primaryColor}16, transparent 32%), radial-gradient(circle at 84% 14%, #dbeafe, transparent 28%), linear-gradient(145deg, #f8fafc, #eff6ff 48%, #ffffff)`
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),transparent_42%,rgba(248,250,252,0.92))]" />
      <div className="absolute inset-x-0 top-0 h-px bg-slate-200" />
      <main className="relative z-10 grid min-h-screen place-items-center px-4 py-8 sm:py-10">
        <motion.section
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45 }}
          className="grid w-full max-w-6xl overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white text-slate-950 shadow-[0_30px_90px_rgba(15,23,42,0.12)] lg:grid-cols-[1fr_0.9fr]"
        >
          <div className="relative hidden min-h-[640px] border-r border-slate-200 bg-slate-50 p-10 lg:block">
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primaryColor}0f, transparent 42%), radial-gradient(circle at 50% 56%, #dbeafe, transparent 38%)` }} />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-center gap-3">
                <div className="auth-brand-logo-slot">
                  {logoUrl ? <img src={logoUrl} alt={loginTitle} className="auth-brand-logo-img" /> : <span className="text-xl font-black text-blue-600">R</span>}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">{loginTitle}</p>
                  <p className="text-xs text-slate-500">Experiência profissional</p>
                </div>
              </div>
              <div>
                <p className="mb-4 text-xs uppercase tracking-[0.28em] text-blue-600">Ambiente exclusivo</p>
                <h2 className="max-w-xl text-5xl font-semibold leading-tight text-slate-950">Painel profissional para gestão avançada.</h2>
                <p className="mt-5 max-w-lg text-sm leading-6 text-slate-600">{supportText}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs text-slate-600">
                {highlights.map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <Icon className="mb-3 h-4 w-4 text-blue-600" />
                      <p className="font-semibold text-slate-950">{item.label}</p>
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
                  {logoUrl ? <img src={logoUrl} alt={loginTitle} className="auth-brand-logo-img" /> : <span className="text-lg font-black text-blue-600">R</span>}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">{loginTitle}</p>
                  <p className="text-xs text-slate-500">Acesso protegido</p>
                </div>
              </div>
              <p className="mb-3 text-xs uppercase tracking-[0.24em] text-blue-600">Acesso protegido</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{loginTitle}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">{loginSubtitle}</p>
            </div>
            {children}
            <p className="mt-7 text-center text-xs font-semibold text-slate-500">{footerText}</p>
          </div>
        </motion.section>
      </main>
    </PremiumPageLayout>
  );
}

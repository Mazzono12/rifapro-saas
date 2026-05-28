import React from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { PremiumPageLayout } from "../../components/premium/PremiumUI";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <PremiumPageLayout className="overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.20),transparent_32%),radial-gradient(circle_at_78%_18%,rgba(16,185,129,0.18),transparent_28%),linear-gradient(145deg,#04060a,#0b1020_55%,#04060a)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
      <main className="relative z-10 grid min-h-screen place-items-center px-4 py-10">
        <motion.section
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45 }}
          className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] text-white shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl lg:grid-cols-[1fr_0.92fr]"
        >
          <div className="relative hidden min-h-[640px] border-r border-white/10 p-10 lg:block">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(34,211,238,0.14),transparent_42%),radial-gradient(circle_at_50%_55%,rgba(255,255,255,0.12),transparent_34%)]" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-300 text-black shadow-[0_0_40px_rgba(34,211,238,0.35)]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">RifaPro SaaS</p>
                  <p className="text-xs text-slate-400">Autenticacao multitenant</p>
                </div>
              </div>
              <div>
                <p className="mb-4 text-xs uppercase tracking-[0.28em] text-cyan-200">Enterprise console</p>
                <h2 className="max-w-xl text-5xl font-semibold leading-tight tracking-tight text-white">Controle rifas, PIX e tenants com isolamento profissional.</h2>
                <p className="mt-5 max-w-lg text-sm leading-6 text-slate-300">Sessao persistente, roles, JWT validado no backend e tenant resolvido sem confiar no frontend.</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs text-slate-300">
                {["RLS", "JWT", "Tenant"].map(item => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-cyan-200">{item}</p>
                    <p className="mt-1 text-slate-500">ativo</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-6 sm:p-10 lg:p-12">
            <div className="mb-9">
              <p className="mb-3 text-xs uppercase tracking-[0.24em] text-cyan-200">Acesso seguro</p>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">{subtitle}</p>
            </div>
            {children}
          </div>
        </motion.section>
      </main>
    </PremiumPageLayout>
  );
}

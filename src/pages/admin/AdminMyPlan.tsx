import { useEffect, useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { formatPlanName } from "../../lib/planLabels";

const featureLabels: Record<string, string> = {
  crm: "CRM",
  automations: "Automações",
  advanced_affiliates: "Afiliados avançados",
  wallet: "Wallet",
  provably_fair: "Sorteio auditável",
  reports_pdf: "Relatórios PDF",
  public_api: "API pública",
  pwa: "PWA",
  custom_theme: "Tema customizado",
  whatsapp_automation: "WhatsApp automático",
  realtime_social_proof: "Prova social em tempo real"
};

export function AdminMyPlan() {
  const [plan, setPlan] = useState<any>(null);
  const [features, setFeatures] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/plan").then(res => res.json()),
      fetch("/api/admin/features").then(res => res.json())
    ]).then(([planData, featureData]) => {
      setPlan(planData);
      setFeatures(featureData.features || {});
    }).catch(() => null);
  }, []);

  const currentPlan = plan?.plan;

  return (
    <div className="space-y-6">
      <section className="admin-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-[var(--admin-muted)]">Meu plano</p>
            <h1 className="text-3xl font-black text-[var(--admin-text)]">{currentPlan ? formatPlanName(currentPlan) : "Carregando"}</h1>
            <p className="mt-2 text-sm text-[var(--admin-muted)]">Status operacional: {plan?.tenant?.status || "-"}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-xl bg-[var(--admin-primary)] px-4 py-3 text-sm font-bold text-[var(--admin-button-text)]">
            <Sparkles className="h-4 w-4" /> Solicitar upgrade
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {Object.entries(plan?.limits || {}).map(([label, value]) => (
          <div key={label} className="admin-card p-4">
            <p className="text-xs uppercase text-[var(--admin-muted)]">{label}</p>
            <p className="mt-2 text-xl font-black text-[var(--admin-text)]">{String(value)}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(features).map(([flag, enabled]) => (
          <div key={flag} className={`admin-card flex items-center justify-between p-4 ${enabled ? "" : "opacity-70"}`}>
            <div>
              <p className="font-semibold text-[var(--admin-text)]">{featureLabels[flag] || flag}</p>
              <p className="text-xs text-[var(--admin-muted)]">{enabled ? "Disponível no plano" : "Bloqueado. Solicite upgrade."}</p>
            </div>
            {!enabled && <Lock className="h-5 w-5 text-amber-300" />}
          </div>
        ))}
      </section>
    </div>
  );
}

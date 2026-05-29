import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { AdminDataTable, MetricCard } from "../../components/admin/AdminPremium";

export function SuperAdminAntifraud() {
  const [data, setData] = useState<any>({ signals: [], cases: [], summary: {} });

  useEffect(() => {
    fetch("/api/superadmin/antifraud").then(res => res.json()).then(setData).catch(() => setData({ signals: [], cases: [], summary: {} }));
  }, []);

  const cases = data.cases || [];
  const signals = data.signals || [];

  return (
    <div className="space-y-6">
      <section className="admin-card p-5">
        <p className="text-sm font-bold uppercase tracking-widest text-[var(--admin-primary)]">Visão global por tenant</p>
        <h2 className="mt-1 text-2xl font-black text-[var(--admin-text)]">Antifraude avançado</h2>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">Compras, PIX, afiliados, carteira, saques e alterações de cotas com score 0-100.</p>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={ShieldAlert} label="Casos" value={data.summary?.totalCases || cases.length} trend="todos os tenants" />
        <MetricCard icon={ShieldAlert} label="Alto risco" value={data.summary?.highRisk || 0} trend="score 71-100" tone="warning" />
        <MetricCard icon={ShieldAlert} label="Revisão manual" value={data.summary?.manualReview || 0} trend="fila global" tone="accent" />
      </div>
      <AdminDataTable
        columns={["Tenant", "Sinal", "Score", "Severidade", "Ação", "Status"]}
        rows={cases.map((item: any) => [item.tenant || item.tenant_id, item.signal_type, item.score, item.severity, item.action, item.status])}
        empty="Nenhum caso antifraude global."
      />
      <AdminDataTable
        columns={["Tenant", "Evento", "Score", "Severidade", "Status", "Metadata"]}
        rows={signals.slice(0, 40).map((item: any) => [item.tenant || item.tenant_id, item.signal_type, item.score || 0, item.severity, item.status, JSON.stringify(item.metadata || {})])}
        empty="Nenhum evento antifraude."
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { Bell, CheckCircle2, MousePointerClick, Send, Smartphone, XCircle } from "lucide-react";
import { AdminDataTable, MetricCard } from "../../components/admin/AdminPremium";

function pct(sent: number, clicked: number) {
  return sent ? `${Number(((clicked / sent) * 100).toFixed(2))}%` : "0%";
}

export function SuperAdminPush() {
  const [stats, setStats] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);

  async function load() {
    const [dashboardResponse, tenantsResponse] = await Promise.all([
      fetch("/api/superadmin/push/dashboard"),
      fetch("/api/superadmin/push")
    ]);
    const dashboardPayload = await dashboardResponse.json().catch(() => ({}));
    const tenantsPayload = await tenantsResponse.json().catch(() => ({ tenants: [] }));
    if (dashboardResponse.ok) setStats(dashboardPayload);
    if (tenantsResponse.ok) setTenants(tenantsPayload.tenants || []);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-6">
        <MetricCard icon={Smartphone} label="Assinantes" value={stats?.subscribers || 0} trend="todos tenants" />
        <MetricCard icon={CheckCircle2} label="Ativos" value={stats?.active || 0} trend="dispositivos" tone="success" />
        <MetricCard icon={Send} label="Envios" value={stats?.sent || 0} trend="push enviados" tone="accent" />
        <MetricCard icon={XCircle} label="Falhas" value={stats?.failed || 0} trend="entrega" tone="danger" />
        <MetricCard icon={MousePointerClick} label="Cliques" value={stats?.clicked || 0} trend="aberturas" tone="warning" />
        <MetricCard icon={Bell} label="CTR" value={`${stats?.ctr || 0}%`} trend="global" />
      </div>

      <section className="admin-card p-5">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase text-[var(--admin-primary)]">SuperAdmin &gt; Push</p>
          <h2 className="mb-0 text-2xl font-black text-[var(--admin-text)]">Push Notifications por tenant</h2>
        </div>
        <AdminDataTable
          columns={["Tenant", "SLA Push", "Assinantes", "Ativos", "Envios", "Falhas", "Cliques", "CTR"]}
          rows={tenants.map(tenant => [
            tenant.name,
            tenant.settings?.enabled ? "Habilitado" : "Desabilitado",
            tenant.subscribers || 0,
            tenant.active || 0,
            tenant.sent || 0,
            tenant.failed || 0,
            tenant.clicked || 0,
            pct(tenant.sent || 0, tenant.clicked || 0)
          ])}
        />
      </section>
    </div>
  );
}

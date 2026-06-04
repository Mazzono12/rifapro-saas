import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { formatPlanName } from "../../lib/planLabels";

const tenantStatuses = ["trial", "active", "suspended", "overdue", "maintenance", "blocked", "canceled"];
const statusLabels: Record<string, string> = {
  trial: "Avaliação",
  active: "Ativo",
  suspended: "Suspenso",
  overdue: "Pendente",
  maintenance: "Manutenção",
  blocked: "Bloqueado",
  canceled: "Cancelado"
};

export function SuperAdminTenantPlanResources() {
  const { tenantId = "" } = useParams();
  const [planData, setPlanData] = useState<any>(null);
  const [featureData, setFeatureData] = useState<any>(null);
  const [planId, setPlanId] = useState("");
  const [status, setStatus] = useState("active");
  const [reason, setReason] = useState("Ajuste de governança do cliente");

  const load = () => {
    Promise.all([
      fetch(`/api/superadmin/tenants/${tenantId}/plan`).then(res => res.json()),
      fetch(`/api/superadmin/tenants/${tenantId}/features`).then(res => res.json())
    ]).then(([plan, features]) => {
      setPlanData(plan);
      setFeatureData(features);
      setPlanId(plan.plan?.id || "");
      setStatus(plan.tenant?.status || "active");
    }).catch(error => toast.error(error instanceof Error ? error.message : "Falha ao carregar plano"));
  };

  useEffect(load, [tenantId]);

  const savePlan = async () => {
    const res = await fetch(`/api/superadmin/tenants/${tenantId}/plan`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, status, reason })
    });
    if (!res.ok) return toast.error("Falha ao salvar plano");
    toast.success("Plano atualizado");
    load();
  };

  const toggleFeature = async (flag: string, enabled: boolean) => {
    const next = { ...(featureData?.features || {}), [flag]: enabled };
    const res = await fetch(`/api/superadmin/tenants/${tenantId}/features`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features: next, reason })
    });
    if (!res.ok) return toast.error("Falha ao salvar recurso");
    toast.success("Feature flag atualizada");
    load();
  };

  return (
    <div className="space-y-6">
      <section className="admin-card p-5">
        <h1 className="text-2xl font-black text-[var(--admin-text)]">Plano e Recursos</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">{planData?.tenant?.nome || "Cliente"}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-xs uppercase text-[var(--admin-muted)]">Plano</span>
            <select value={planId} onChange={event => setPlanId(event.target.value)} className="admin-input w-full">
              {(planData?.plans || []).map((plan: any) => <option key={plan.id} value={plan.id}>{formatPlanName(plan)}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase text-[var(--admin-muted)]">Status</span>
            <select value={status} onChange={event => setStatus(event.target.value)} className="admin-input w-full">
              {tenantStatuses.map(item => <option key={item} value={item}>{statusLabels[item] || item}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase text-[var(--admin-muted)]">Motivo</span>
            <input value={reason} onChange={event => setReason(event.target.value)} className="admin-input w-full" />
          </label>
        </div>
        <button type="button" onClick={savePlan} className="admin-button mt-4 h-10 px-3 text-sm">Salvar plano</button>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(featureData?.available || []).map((flag: string) => (
          <label key={flag} className="admin-card flex items-center justify-between p-4">
            <span className="font-semibold text-[var(--admin-text)]">{flag}</span>
            <input type="checkbox" checked={Boolean(featureData?.features?.[flag])} onChange={event => toggleFeature(flag, event.target.checked)} />
          </label>
        ))}
      </section>
    </div>
  );
}

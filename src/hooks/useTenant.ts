import { useAuth } from "../context/auth/AuthContext";

export function useTenant() {
  const { tenant_id, profile } = useAuth();
  return {
    tenant_id,
    tenantId: tenant_id,
    tenantName: profile?.tenantId ? `Tenant ${profile.tenantId}` : "Plataforma",
    futureTenantSwitchEnabled: false
  };
}

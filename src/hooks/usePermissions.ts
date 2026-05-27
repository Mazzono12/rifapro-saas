import { AuthRole } from "../lib/authSession";
import { useAuth } from "../context/auth/AuthContext";

export function usePermissions() {
  const { role } = useAuth();
  const hasRole = (...roles: AuthRole[]) => Boolean(role && roles.includes(role));
  return {
    role,
    isSuperAdmin: role === "superadmin",
    isAdmin: role === "admin",
    isOperator: role === "operador",
    isAffiliate: role === "afiliado",
    hasRole,
    canAccessAdmin: hasRole("superadmin", "admin"),
    canAccessTenantPanel: hasRole("admin", "operador")
  };
}

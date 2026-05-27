import { useAuth } from "../context/auth/AuthContext";

export function useSession() {
  const auth = useAuth();
  return {
    user: auth.user,
    profile: auth.profile,
    role: auth.role,
    tenant_id: auth.tenant_id,
    authenticated: auth.authenticated,
    loading: auth.loading,
    access_token: auth.access_token,
    refresh_token: auth.refresh_token
  };
}

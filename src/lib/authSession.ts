export type AuthRole = "superadmin" | "admin" | "operador" | "afiliado";

export type AuthUser = {
  id: string;
  email: string;
  user_metadata?: { name?: string };
};

export type AuthProfile = {
  role: AuthRole;
  name?: string | null;
  tenantId?: string | null;
  tenant_id?: string | null;
};

export type AuthSessionState = {
  access_token: string;
  refresh_token: string;
  token?: string;
  expires_at?: number;
  token_type?: string;
  user: AuthUser | null;
  usuario?: {
    id: string;
    tenant_id: string | null;
    nome: string | null;
    email: string;
    role: AuthRole;
    ativo: boolean;
    created_at: string;
  };
  profile: AuthProfile | null;
};

export const authStorageKey = "rifapro_saas_auth_session";
export const supportSessionStorageKey = "rifapro_superadmin_support_session";

export function normalizeRole(role?: string | null): AuthRole {
  if (role === "tenant_admin") return "admin";
  if (role === "tenant_user") return "operador";
  if (role === "superadmin" || role === "admin" || role === "operador" || role === "afiliado") return role;
  return "operador";
}

export function roleHome(role?: string | null) {
  const normalized = normalizeRole(role);
  if (normalized === "superadmin") return "/superadmin";
  if (normalized === "admin") return "/admin";
  if (normalized === "operador") return "/painel";
  return "/afiliados";
}

export function isTokenExpiring(expiresAt?: number, skewSeconds = 90) {
  if (!expiresAt) return false;
  return Date.now() >= (expiresAt - skewSeconds) * 1000;
}

export function getStoredAuthSession() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(authStorageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSessionState;
  } catch {
    localStorage.removeItem(authStorageKey);
    return null;
  }
}

export function setStoredAuthSession(session: AuthSessionState | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    localStorage.removeItem(authStorageKey);
    localStorage.removeItem("nexusdraw_admin_token");
    return;
  }
  localStorage.setItem(authStorageKey, JSON.stringify(session));
  if (session.token) localStorage.setItem("nexusdraw_admin_token", session.token);
}

export function getAuthAccessToken() {
  const session = getStoredAuthSession();
  return session?.token || session?.access_token || localStorage.getItem("nexusdraw_admin_token") || "";
}

export function getSupportSessionId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(supportSessionStorageKey) || "";
}

function requestPath(input: RequestInfo | URL) {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
  try {
    return new URL(raw, typeof window !== "undefined" ? window.location.origin : "http://localhost").pathname;
  } catch {
    return raw.split("?")[0] || "";
  }
}

function shouldEmitAuthError(url: string) {
  const path = requestPath(url);
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
  return (
    path.startsWith("/api/admin/") ||
    path.startsWith("/api/superadmin/") ||
    path.startsWith("/api/auth/me") ||
    currentPath.startsWith("/admin") ||
    currentPath.startsWith("/superadmin") ||
    currentPath.startsWith("/dashboard") ||
    currentPath.startsWith("/painel")
  );
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  const token = getAuthAccessToken();
  const url = requestPath(input);
  const isAuthEndpoint = url.startsWith("/api/auth/");
  if (token && url.startsWith("/api/") && !isAuthEndpoint) headers.set("Authorization", `Bearer ${token}`);
  const supportSessionId = getSupportSessionId();
  if (supportSessionId && url.startsWith("/api/admin/")) headers.set("X-Support-Session-Id", supportSessionId);
  const response = await fetch(input, { ...init, headers });
  if (!isAuthEndpoint && response.status === 401 && shouldEmitAuthError(url)) {
    window.dispatchEvent(new CustomEvent("rifapro:auth-error", { detail: { type: "expired" } }));
  }
  if (!isAuthEndpoint && response.status === 403 && shouldEmitAuthError(url)) {
    window.dispatchEvent(new CustomEvent("rifapro:auth-error", { detail: { type: "forbidden" } }));
  }
  return response;
}

export function installAuthFetchMiddleware() {
  if (typeof window === "undefined") return;
  const patchedWindow = window as typeof window & { __rifaproAuthFetchPatched?: boolean };
  if (patchedWindow.__rifaproAuthFetchPatched) return;
  const nativeFetch = window.fetch.bind(window);
  patchedWindow.__rifaproAuthFetchPatched = true;
  window.fetch = (input, init = {}) => {
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    const token = getAuthAccessToken();
    const url = requestPath(input);
    const isAuthEndpoint = url.startsWith("/api/auth/");
    if (token && url.startsWith("/api/") && !isAuthEndpoint) headers.set("Authorization", `Bearer ${token}`);
    const supportSessionId = getSupportSessionId();
    if (supportSessionId && url.startsWith("/api/admin/")) headers.set("X-Support-Session-Id", supportSessionId);
    return nativeFetch(input, { ...init, headers }).then(response => {
      if (!isAuthEndpoint && response.status === 401 && shouldEmitAuthError(url)) window.dispatchEvent(new CustomEvent("rifapro:auth-error", { detail: { type: "expired" } }));
      if (!isAuthEndpoint && response.status === 403 && shouldEmitAuthError(url)) window.dispatchEvent(new CustomEvent("rifapro:auth-error", { detail: { type: "forbidden" } }));
      return response;
    });
  };
}

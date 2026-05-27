import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AuthProfile,
  AuthRole,
  AuthSessionState,
  AuthUser,
  getStoredAuthSession,
  installAuthFetchMiddleware,
  isTokenExpiring,
  normalizeRole,
  roleHome,
  setStoredAuthSession
} from "../../lib/authSession";

type AuthContextValue = {
  user: AuthUser | null;
  profile: AuthProfile | null;
  role: AuthRole | null;
  tenant_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  loading: boolean;
  authenticated: boolean;
  login: (email: string, password: string) => Promise<string>;
  signup: (input: { nome: string; email: string; password: string; role?: AuthRole }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  recoverPassword: (email: string) => Promise<void>;
  hydrate: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const fallbackAuthContext: AuthContextValue = {
  user: null,
  profile: null,
  role: null,
  tenant_id: null,
  access_token: null,
  refresh_token: null,
  loading: false,
  authenticated: false,
  login: async () => {
    throw new Error("AuthProvider indisponivel.");
  },
  signup: async () => {
    throw new Error("AuthProvider indisponivel.");
  },
  logout: async () => {
    setStoredAuthSession(null);
  },
  refresh: async () => false,
  recoverPassword: async () => {
    throw new Error("AuthProvider indisponivel.");
  },
  hydrate: async () => undefined
};

function normalizeBackendSession(data: any): AuthSessionState {
  const usuario = data.usuario;
  const profile = data.profile || {
    role: normalizeRole(usuario?.role),
    name: usuario?.nome,
    tenantId: usuario?.tenant_id
  };
  return {
    access_token: data.access_token || data.session?.access_token || data.token,
    refresh_token: data.refresh_token || data.session?.refresh_token || "",
    expires_at: data.expires_at || data.session?.expires_at,
    token_type: data.token_type || data.session?.token_type || "bearer",
    token: data.token,
    user: data.user || (usuario ? { id: usuario.id, email: usuario.email, user_metadata: { name: usuario.nome || "" } } : null),
    usuario,
    profile: {
      ...profile,
      role: normalizeRole(profile?.role),
      tenantId: profile?.tenantId ?? profile?.tenant_id ?? usuario?.tenant_id ?? null,
      tenant_id: profile?.tenant_id ?? profile?.tenantId ?? usuario?.tenant_id ?? null
    }
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSessionState | null>(() => getStoredAuthSession());
  const [loading, setLoading] = useState(true);

  const persist = useCallback((next: AuthSessionState | null) => {
    setSession(next);
    setStoredAuthSession(next);
  }, []);

  const refresh = useCallback(async () => {
    const current = getStoredAuthSession();
    if (!current?.refresh_token) return false;
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: current.refresh_token })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      persist(null);
      return false;
    }
    persist(normalizeBackendSession(data));
    return true;
  }, [persist]);

  const hydrate = useCallback(async () => {
    setLoading(true);
    const current = getStoredAuthSession();
    if (!current) {
      setLoading(false);
      return;
    }
    if (isTokenExpiring(current.expires_at)) {
      await refresh();
      setLoading(false);
      return;
    }
    const response = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${current.access_token || current.token}` }
    });
    if (!response.ok) {
      const refreshed = await refresh();
      if (!refreshed) persist(null);
      setLoading(false);
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (data.usuario) {
      persist(normalizeBackendSession({ ...current, usuario: data.usuario }));
    } else {
      setSession(current);
    }
    setLoading(false);
  }, [persist, refresh]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setLoading(false);
      throw new Error(data.error || "Credenciais invalidas");
    }
    const next = normalizeBackendSession(data);
    persist(next);
    setLoading(false);
    return roleHome(next.profile?.role);
  }, [persist]);

  const signup = useCallback(async (input: { nome: string; email: string; password: string; role?: AuthRole }) => {
    setLoading(true);
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: input.nome,
        email: input.email.trim().toLowerCase(),
        password: input.password,
        role: input.role || "admin"
      })
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) throw new Error(data.error || "Nao foi possivel criar o usuario");
  }, []);

  const logout = useCallback(async () => {
    const current = getStoredAuthSession();
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: current?.access_token ? { Authorization: `Bearer ${current.access_token}` } : undefined
      });
    } finally {
      persist(null);
    }
  }, [persist]);

  const recoverPassword = useCallback(async (email: string) => {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), redirectTo: `${window.location.origin}/login` })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Nao foi possivel enviar recuperacao de senha");
  }, []);

  useEffect(() => {
    installAuthFetchMiddleware();
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = getStoredAuthSession();
      if (current?.refresh_token && isTokenExpiring(current.expires_at, 180)) refresh();
    }, 60_000);
    const onAuthError = (event: Event) => {
      const type = (event as CustomEvent<{ type?: string }>).detail?.type;
      if (type === "expired") toast.error("Sessao expirada", { description: "Entre novamente para continuar." });
      if (type === "forbidden") toast.error("Acesso negado", { description: "Seu perfil nao tem permissao para esta area." });
    };
    window.addEventListener("rifapro:auth-error", onAuthError);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("rifapro:auth-error", onAuthError);
    };
  }, [refresh]);

  const value = useMemo<AuthContextValue>(() => {
    const profile = session?.profile || null;
    const role = profile?.role ? normalizeRole(profile.role) : null;
    const tenantId = profile?.tenantId ?? profile?.tenant_id ?? session?.usuario?.tenant_id ?? null;
    return {
      user: session?.user || null,
      profile,
      role,
      tenant_id: tenantId || null,
      access_token: session?.access_token || null,
      refresh_token: session?.refresh_token || null,
      loading,
      authenticated: Boolean(session?.user || session?.usuario),
      login,
      signup,
      logout,
      refresh,
      recoverPassword,
      hydrate
    };
  }, [hydrate, loading, login, logout, recoverPassword, refresh, session, signup]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  return value || fallbackAuthContext;
}

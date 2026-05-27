import { create } from 'zustand';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

const mockSessionKey = 'nexusdraw_mock_session';
const adminTokenKey = 'nexusdraw_admin_token';
type AuthRole = 'superadmin' | 'tenant_admin' | 'tenant_user';

function shouldAttachAuthToken(input: RequestInfo | URL) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
  return url.startsWith('/api/admin') ||
    url.startsWith('/api/superadmin') ||
    /^\/api\/purchases\/[^/]+\/confirm$/.test(url) ||
    /^\/api\/fazendinha\/purchases\/[^/]+\/confirm-payment$/.test(url) ||
    /^\/api\/modalidades\/purchases\/[^/]+\/confirm-payment$/.test(url);
}

function installAuthenticatedFetch() {
  if (typeof window === 'undefined' || (window as typeof window & { __nexusdrawFetchPatched?: boolean }).__nexusdrawFetchPatched) return;
  const nativeFetch = window.fetch.bind(window);
  (window as typeof window & { __nexusdrawFetchPatched?: boolean }).__nexusdrawFetchPatched = true;
  window.fetch = (input, init = {}) => {
    const token = localStorage.getItem(adminTokenKey);
    if (!token || !shouldAttachAuthToken(input)) return nativeFetch(input, init);

    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    headers.set('Authorization', `Bearer ${token}`);
    return nativeFetch(input, { ...init, headers });
  };
}

installAuthenticatedFetch();

interface AuthState {
  user: User | null;
  profile: { role: AuthRole; name?: string; phone?: string; tenantId?: string | null } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  signIn: async (email, password) => {
    set({ loading: true });
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      localStorage.setItem(adminTokenKey, data.token);
      localStorage.setItem(mockSessionKey, JSON.stringify({ user: data.user, profile: data.profile }));
      set({ user: data.user, profile: data.profile, loading: false });
      return;
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      set({ user: data.user, profile: { role: 'tenant_user' }, loading: false });
      return;
    }
    set({ loading: false });
    throw new Error(data.error || 'Credenciais invalidas');
  },
  signUp: async (name, email, password) => {
    set({ loading: true });
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) throw error;
      set({ user: data.user, profile: { role: 'tenant_user', name }, loading: false });
      return;
    }

    set({ loading: false });
    throw new Error('Cadastro por login indisponivel neste ambiente. Utilize o cadastro durante a compra.');
  },
  signOut: async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(adminTokenKey);
    localStorage.removeItem(mockSessionKey);
    set({ user: null, profile: null });
  },
  checkAuth: async () => {
    const adminToken = localStorage.getItem(adminTokenKey);
    if (adminToken) {
      const res = await fetch('/api/auth/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: adminToken })
      });
      if (res.ok) {
        const session = await res.json();
        localStorage.setItem(mockSessionKey, JSON.stringify(session));
        set({ user: session.user, profile: session.profile, loading: false });
        return;
      }
      localStorage.removeItem(adminTokenKey);
      localStorage.removeItem(mockSessionKey);
    }

    if (isSupabaseConfigured) {
      const { data: { session } } = await supabase.auth.getSession();
      set({ user: session?.user || null, profile: session?.user ? { role: 'tenant_user' } : null, loading: false });
      return;
    }

    const rawSession = localStorage.getItem(mockSessionKey);
    if (rawSession) {
      const session = JSON.parse(rawSession);
      if (!['superadmin', 'tenant_admin'].includes(session.profile?.role)) {
        set({ user: session.user, profile: session.profile, loading: false });
        return;
      }
      localStorage.removeItem(mockSessionKey);
    }

    set({ loading: false });
  }
}));

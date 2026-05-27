import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "./supabaseAdmin";

export type SaaSAuthRole = "superadmin" | "admin" | "operador" | "afiliado" | "tenant_admin" | "tenant_user";

export type UsuarioRecord = {
  id: string;
  tenant_id: string | null;
  nome: string | null;
  email: string;
  role: SaaSAuthRole;
  ativo: boolean;
  created_at: string;
};

export type AuthSessionPayload = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  token_type: string;
};

let cachedPublicClient: SupabaseClient | null = null;

function maskEmail(email: string) {
  const [name, domain] = String(email || "").split("@");
  if (!domain) return "email-invalido";
  return `${name.slice(0, 2)}***@${domain}`;
}

export function getSupabasePublicAuthClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !anonKey) {
    throw new Error("SUPABASE_URL e SUPABASE_ANON_KEY sao obrigatorios para Supabase Auth.");
  }

  if (!cachedPublicClient) {
    cachedPublicClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  return cachedPublicClient;
}

export function normalizeAuthRole(role: unknown): SaaSAuthRole {
  const value = String(role || "admin").trim().toLowerCase();
  if (value === "tenant_admin") return "admin";
  if (value === "tenant_user") return "operador";
  if (["superadmin", "admin", "operador", "afiliado"].includes(value)) return value as SaaSAuthRole;
  return "admin";
}

export function publicUsuario(usuario: UsuarioRecord) {
  return {
    id: usuario.id,
    tenant_id: usuario.tenant_id,
    nome: usuario.nome,
    email: usuario.email,
    role: normalizeAuthRole(usuario.role),
    ativo: usuario.ativo,
    created_at: usuario.created_at
  };
}

export function publicSession(session: AuthSessionPayload | null) {
  if (!session) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    token_type: session.token_type
  };
}

export async function buscarUsuarioPorId(id: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("usuarios")
    .select("id,tenant_id,nome,email,role,ativo,created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as UsuarioRecord | null;
}

export async function buscarUsuarioPorEmail(email: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("usuarios")
    .select("id,tenant_id,nome,email,role,ativo,created_at")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (error) throw error;
  return data as UsuarioRecord | null;
}

export async function criarUsuarioAuth(input: {
  nome: string;
  email: string;
  password: string;
  tenant_id: string | null;
  role: SaaSAuthRole;
}) {
  const email = input.email.trim().toLowerCase();
  const role = normalizeAuthRole(input.role);
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      nome: input.nome,
      tenant_id: input.tenant_id,
      role
    },
    app_metadata: {
      tenant_id: input.tenant_id,
      role
    }
  });

  if (error) throw error;
  if (!data.user) throw new Error("Supabase Auth nao retornou usuario criado.");

  const usuario = {
    id: data.user.id,
    tenant_id: input.tenant_id,
    nome: input.nome,
    email,
    role,
    ativo: true
  };

  const { data: profile, error: profileError } = await admin
    .from("usuarios")
    .upsert(usuario, { onConflict: "id" })
    .select("id,tenant_id,nome,email,role,ativo,created_at")
    .single();

  if (profileError) throw profileError;
  return profile as UsuarioRecord;
}

export async function loginUsuario(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  console.info(`[auth] login inicio email=${maskEmail(normalizedEmail)} password_present=${Boolean(password)}`);
  const { data, error } = await getSupabasePublicAuthClient().auth.signInWithPassword({
    email: normalizedEmail,
    password
  });

  if (error) {
    console.warn(`[auth] signInWithPassword falhou email=${maskEmail(normalizedEmail)} status=${error.status || "sem-status"} message=${error.message}`);
    throw error;
  }
  if (!data.session || !data.user) throw new Error("Sessao Supabase nao foi criada.");
  console.info(`[auth] signInWithPassword ok email=${maskEmail(normalizedEmail)} user_id=${data.user.id}`);

  const usuario = await buscarUsuarioPorId(data.user.id);
  if (!usuario || !usuario.ativo) {
    console.warn(`[auth] perfil public.usuarios ausente/inativo user_id=${data.user.id} email=${maskEmail(normalizedEmail)}`);
    throw new Error("Usuario inativo ou sem perfil SaaS.");
  }
  console.info(`[auth] perfil carregado email=${maskEmail(normalizedEmail)} role=${normalizeAuthRole(usuario.role)} tenant=${usuario.tenant_id || "platform"}`);

  return {
    usuario,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      token_type: data.session.token_type
    }
  };
}

export async function refreshUsuario(refreshToken: string) {
  const { data, error } = await getSupabasePublicAuthClient().auth.refreshSession({
    refresh_token: refreshToken
  });

  if (error) throw error;
  if (!data.session || !data.user) throw new Error("Refresh token invalido.");
  const usuario = await buscarUsuarioPorId(data.user.id);
  if (!usuario || !usuario.ativo) throw new Error("Usuario inativo ou sem perfil SaaS.");

  return {
    usuario,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      token_type: data.session.token_type
    }
  };
}

export async function logoutUsuario(accessToken: string) {
  const { error } = await getSupabaseAdminClient().auth.admin.signOut(accessToken);
  if (error) throw error;
}

export async function solicitarResetSenha(email: string, redirectTo?: string) {
  const { error } = await getSupabasePublicAuthClient().auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    redirectTo ? { redirectTo } : undefined
  );
  if (error) throw error;
}

export async function validarAccessToken(accessToken: string) {
  const { data, error } = await getSupabaseAdminClient().auth.getUser(accessToken);
  if (error || !data.user) return null;
  const usuario = await buscarUsuarioPorId(data.user.id);
  if (!usuario || !usuario.ativo) return null;
  return usuario;
}

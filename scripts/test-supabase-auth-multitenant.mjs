import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
const migration = read("supabase/migrations/16_supabase_auth_usuarios.sql");
const server = read("server.ts");
const repository = read("src/server/authRepository.ts");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(migration.includes("create table if not exists public.usuarios"), "migration cria tabela usuarios");
for (const field of ["id uuid primary key", "tenant_id uuid references public.tenants(id)", "nome text", "email text unique", "role text", "ativo boolean default true", "created_at timestamptz default now()"]) {
  assert(migration.includes(field), `migration contem campo ${field}`);
}
assert(migration.includes("alter table public.usuarios enable row level security"), "RLS habilitado em usuarios");
assert(migration.includes("usuarios_saas_select"), "policy select criada");
assert(migration.includes("public.can_access_tenant(tenant_id::text)"), "policy usa isolamento por tenant");
assert(migration.includes("public.is_service_role()"), "service_role preserva acesso global");

for (const fn of ["criarUsuarioAuth", "loginUsuario", "refreshUsuario", "logoutUsuario", "solicitarResetSenha", "validarAccessToken"]) {
  assert(repository.includes(`function ${fn}`) || repository.includes(`async function ${fn}`), `repositorio implementa ${fn}`);
}
assert(repository.includes("getSupabaseAdminClient"), "backend usa client admin somente no servidor");
assert(repository.includes("SUPABASE_ANON_KEY"), "signin usa anon key");
assert(!repository.includes("VITE_SUPABASE_SERVICE_ROLE_KEY"), "service role nao possui variavel VITE");

for (const route of [
  'app.post("/api/auth/signup"',
  'app.post("/api/auth/login"',
  'app.post("/api/auth/logout"',
  'app.post("/api/auth/refresh"',
  'app.post("/api/auth/reset-password"',
  'app.get("/api/auth/me"'
]) {
  assert(server.includes(route), `rota ${route} registrada`);
}
assert(server.includes("requireSupabaseJwt"), "middleware valida JWT Supabase");
assert(server.includes("validarAccessToken(accessToken)"), "middleware valida access token com Supabase");
assert(server.includes("normalizeAuthRole"), "roles SaaS normalizadas");
assert(server.includes("signSupabaseCompatToken"), "sessao persistente mantem compatibilidade com token legado");

console.log("PASS: autenticacao Supabase SaaS multitenant com usuarios, RLS, rotas, JWT e sessoes validada estaticamente.");

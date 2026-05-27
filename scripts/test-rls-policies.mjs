import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/10_strong_multitenant_rls.sql", "utf8");
const server = readFileSync("server.ts", "utf8");
const frontendFiles = [
  "src/lib/supabase.ts",
  "src/store/useAuthStore.ts",
  "src/services/api.ts"
].map(path => [path, readFileSync(path, "utf8")]);

assert.match(migration, /create or replace function public\.jwt_tenant_id_text/i, "Migration deve criar helper tenant_id textual.");
assert.match(migration, /create or replace function public\.can_access_tenant/i, "Migration deve criar helper can_access_tenant.");
assert.match(migration, /auth\.role\(\) = 'service_role'/i, "Migration deve permitir backend service role.");
assert.match(migration, /public\.is_app_superadmin\(\)/i, "Migration deve liberar superadmin por claim.");
assert.match(migration, /public\.jwt_app_role\(\) in \('tenant_admin', 'tenant_user'\)/i, "Migration deve escopar tenant_admin/tenant_user.");
assert.match(migration, /drop policy if exists/i, "Migration deve remover policies antigas/permissivas.");
assert.match(migration, /pg_policies/i, "Migration deve limpar policies existentes em tabelas tenant_id.");
assert.match(migration, /information_schema\.columns/i, "Migration deve varrer tabelas com tenant_id.");
assert.match(migration, /alter table .* enable row level security/is, "Migration deve ativar RLS.");
assert.match(migration, /tenant_id::text = public\.jwt_tenant_id_text\(\)/i, "Policies devem comparar tenant_id com claim.");
assert.match(migration, /persistent state service role only/i, "Persistent state deve ser apenas service role.");

assert.match(server, /delete req\.body\.tenant_id/, "Backend deve remover tenant_id recebido do frontend.");
assert.match(server, /resolveRequestTenantId\(req\)/, "Backend deve resolver tenant por sessao/dominio.");
assert.match(server, /createClient\(supabaseUrl, supabaseServiceKey/, "Service role deve ficar apenas no backend server.ts.");

for (const [path, content] of frontendFiles) {
  assert.equal(/SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_KEY/i.test(content), false, `${path} nao pode referenciar service role key.`);
}

console.log("PASS: policies RLS tenant-scoped, superadmin, service role backend e frontend sem service key validados.");

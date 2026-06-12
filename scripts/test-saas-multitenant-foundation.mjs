import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/15_saas_multitenant_foundation.sql", "utf8");
const server = readFileSync("server.ts", "utf8");

const tenantTables = [
  "clientes",
  "campanhas",
  "rifas",
  "pedidos",
  "pagamentos",
  "afiliados",
  "webhooks",
  "automacoes",
  "logs"
];

assert.match(migration, /create table if not exists public\.tenants/i, "Migration deve criar tenants.");
assert.match(migration, /id uuid primary key default gen_random_uuid\(\)/i, "Tenants deve usar id uuid.");
assert.match(migration, /slug text unique not null/i, "Tenants deve ter slug unico obrigatorio.");
assert.match(migration, /dominio text unique/i, "Tenants deve ter dominio unico.");
assert.match(migration, /ativo boolean default true/i, "Tenants deve ter ativo.");
assert.match(migration, /plano text default 'starter'/i, "Tenants deve ter plano starter.");

for (const table of tenantTables) {
  assert.match(migration, new RegExp(`'${table}'`, "i"), `${table} deve estar na lista operacional.`);
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} deve ter RLS ativo.`);
}

assert.match(migration, /table_name \|\| '_tenant_id_idx'/i, "Migration deve criar indice tenant_id para tabelas operacionais.");
assert.match(migration, /table_name \|\| '_tenant_created_idx'/i, "Migration deve criar indice composto tenant_id/created_at.");
assert.match(migration, /table_name \|\| '_saas_select'/i, "Migration deve criar policy select tenant scoped.");
assert.match(migration, /table_name \|\| '_saas_insert'/i, "Migration deve criar policy insert tenant scoped.");
assert.match(migration, /table_name \|\| '_saas_update'/i, "Migration deve criar policy update tenant scoped.");
assert.match(migration, /table_name \|\| '_saas_delete'/i, "Migration deve criar policy delete tenant scoped.");
assert.match(migration, /public\.is_service_role\(\)/i, "Policies devem liberar service_role.");
assert.match(migration, /public\.can_access_tenant\(tenant_id::text\)/i, "Policies devem isolar por tenant_id.");
assert.match(migration, /jwt_tenant_id_text/i, "Migration deve usar tenant_id do JWT.");
assert.match(migration, /CIFHER Prime|Tenant Desenvolvimento/i, "Migration deve criar seed de desenvolvimento.");

assert.match(server, /delete req\.body\.tenant_id/, "Backend deve remover tenant_id enviado pelo frontend.");
assert.match(server, /host === "localhost" \|\| host === "127\.0\.0\.1" \|\| host === "::1"/, "Middleware deve suportar localhost.");
assert.match(server, /tenant\.dominio \|\| tenant\.dominio_customizado/, "Middleware deve resolver dominio proprio.");
assert.match(server, /host\.split\("\."\)\[0\] === tenant\.slug/, "Middleware deve resolver subdominio.");
assert.match(server, /app\.use\(resolveTenant\)/, "Middleware resolveTenant deve continuar ativo.");

console.log("PASS: fundacao SaaS multitenant com tenants, tenant_id, RLS, policies, middleware e seed validada.");

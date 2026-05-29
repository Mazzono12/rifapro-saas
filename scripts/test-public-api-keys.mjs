import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const server = readFileSync(join(root, "server.ts"), "utf8");
const migration = readFileSync(join(root, "supabase/migrations/32_tenant_api_keys.sql"), "utf8");

function includesAll(content, expected, label) {
  const missing = expected.filter(item => !content.includes(item));
  if (missing.length) throw new Error(`${label} sem trechos obrigatorios: ${missing.join(", ")}`);
}

includesAll(migration, [
  "create table if not exists public.tenant_api_keys",
  "tenant_id uuid not null references public.tenants(id)",
  "key_hash text not null",
  "prefix text not null",
  "scopes jsonb not null",
  "last_used_at timestamptz",
  "expires_at timestamptz",
  "alter table public.tenant_api_keys enable row level security",
  "public.can_access_tenant",
  "for delete",
  "using (false)"
], "migration tenant_api_keys");

includesAll(server, [
  "TenantApiKeyScope",
  "tenantApiKeys",
  "hashTenantApiKey",
  "timingSafeEqual",
  "sanitizeTenantApiKey",
  "generateTenantApiKey",
  "findTenantApiKeyByPlainKey",
  "apiKeyRateLimiter",
  "requireTenantApiKey",
  "requireTenantApiScope",
  "Bearer"
], "helpers API keys");

includesAll(server, [
  "raffles:read",
  "raffles:write",
  "orders:read",
  "customers:read",
  "affiliates:read",
  "reports:read",
  "webhooks:write",
  "app.post(\"/api/admin/api-keys\"",
  "app.get(\"/api/admin/api-keys\"",
  "app.delete(\"/api/admin/api-keys/:id\"",
  "TENANT_API_KEY_CREATED",
  "TENANT_API_KEY_REVOKED"
], "endpoints admin API keys");

includesAll(server, [
  "app.use(\"/api/v1\", apiKeyRateLimiter, requireTenantApiKey)",
  "app.get(\"/api/v1/raffles\"",
  "app.get(\"/api/v1/raffles/:id\"",
  "app.get(\"/api/v1/orders\"",
  "app.get(\"/api/v1/customers\"",
  "app.get(\"/api/v1/reports/revenue\"",
  "Escopo insuficiente",
  "tenantHasFeature(record.tenant_id, \"public_api\")",
  "record.last_used_at",
  "maskCpfForCrm",
  "maskPhone"
], "endpoints API externa");

if (/key_hash:\s*plainKey|tenantApiKeys\.push\([^)]*plainKey|tenantApiKeys\.unshift\([^)]*plainKey/.test(server)) {
  throw new Error("API key em texto puro nao pode ser persistida em tenantApiKeys");
}

console.log("[public-api-keys] ok");

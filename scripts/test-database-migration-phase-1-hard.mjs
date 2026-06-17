import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const serverPath = path.join(root, "server.ts");
const migrationPath = path.join(root, "supabase", "migrations", "60_database_migration_phase_1.sql");
const reportPath = path.join(root, "reports", "database-migration-phase-1.md");

function read(file) {
  return readFileSync(file, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(source, needle, label = needle) {
  assert(source.includes(needle), `Esperado encontrar: ${label}`);
}

function assertRegex(source, regex, label = String(regex)) {
  assert(regex.test(source), `Esperado encontrar padrao: ${label}`);
}

assert(existsSync(serverPath), "server.ts nao encontrado");
assert(existsSync(migrationPath), "Migration da Fase 1 nao encontrada");

const server = read(serverPath);
const migration = read(migrationPath);

[
  "app_tenants",
  "tenant_settings",
  "tenant_branding_settings",
  "app_raffles",
  "app_payment_gateway_configs"
].forEach(table => {
  assertIncludes(migration, `create table if not exists public.${table}`, `DDL ${table}`);
  assertIncludes(server, `.from("${table}")`, `uso backend ${table}`);
});

assertRegex(migration, /id text primary key/i, "IDs textuais compativeis com runtime atual");
assertRegex(migration, /tenant_id text/i, "tenant_id textual nas tabelas Phase 1");
assertRegex(migration, /alter table public\.app_tenants enable row level security/i, "RLS app_tenants");
assertRegex(migration, /alter table public\.tenant_settings enable row level security/i, "RLS tenant_settings");
assertRegex(migration, /alter table public\.tenant_branding_settings enable row level security/i, "RLS tenant_branding_settings");
assertRegex(migration, /alter table public\.app_raffles enable row level security/i, "RLS app_raffles");
assertRegex(migration, /alter table public\.app_payment_gateway_configs enable row level security/i, "RLS gateway configs");

[
  "phase1PostgresEnabled",
  "hydratePhase1PostgresState",
  "persistPhase1PostgresState",
  "phase1TenantRow",
  "phase1RaffleRow",
  "phase1GatewayRow"
].forEach(symbol => assertIncludes(server, symbol));

assertRegex(server, /const phase1Hydrated = await hydratePhase1PostgresState\(\);/, "hydrate chama tabelas Phase 1");
assertRegex(server, /await persistPhase1PostgresState\(reason\);/, "persist escreve tabelas Phase 1");
assertRegex(server, /if \(useLocalPersistentState\)/, "persistent-state.json permanece fallback local/dev");
assertRegex(server, /persistenceMode === "postgres"/, "Phase 1 depende de STORAGE_DRIVER=postgres");
assertIncludes(server, "STORAGE_DRIVER deve ser postgres em producao; persistent e apenas local/dev", "producao rejeita persistent-state.json");

const phase1Segment = server.slice(
  server.indexOf("function phase1PostgresEnabled"),
  server.indexOf("async function hydratePersistentState")
);
assert(!/createPix|qrCode|AsaasProvider|checkout\/pedido|\/api\/webhooks|app\.(post|put|patch|get)\(".*webhook/i.test(phase1Segment), "Fase 1 nao deve tocar fluxo PIX, QR Code, webhook ou checkout");

const persistSegment = server.slice(
  server.indexOf("async function persistAllState"),
  server.indexOf('app.get("/api/admin/gateways"')
);
assertRegex(persistSegment, /persistent_state_records/, "snapshot legado continua compatibilidade");
assertRegex(persistSegment, /persistPhase1PostgresState/, "dual-write Phase 1 ativo");

assert(existsSync(reportPath), "Relatorio reports/database-migration-phase-1.md ainda nao foi criado");

console.log("OK: database migration phase 1 hard checks passed");

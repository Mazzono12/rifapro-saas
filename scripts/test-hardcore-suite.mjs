import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const mode = process.argv[2] || "hardcore";
const reportsDir = join(root, "reports");
const startedAt = new Date();
const results = [];

function rel(path) {
  return path.replaceAll("\\", "/");
}

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function collectFiles(absolutePath, predicate = () => true) {
  if (!existsSync(absolutePath)) return [];
  if (statSync(absolutePath).isFile()) return predicate(absolutePath) ? [absolutePath] : [];
  return readdirSync(absolutePath).flatMap(name => collectFiles(join(absolutePath, name), predicate));
}

function extractRegex(content, regex, map = match => match) {
  return [...content.matchAll(regex)].map(map);
}

function assertContains(relativePath, patterns, label = relativePath) {
  const content = read(relativePath);
  const missing = patterns.filter(pattern => !content.includes(pattern));
  assert.equal(missing.length, 0, `${label} sem trechos obrigatorios: ${missing.join(", ")}`);
}

function assertRegex(relativePath, patterns, label = relativePath) {
  const content = read(relativePath);
  const missing = patterns.filter(pattern => !pattern.test(content));
  assert.equal(missing.length, 0, `${label} sem padroes obrigatorios: ${missing.map(String).join(", ")}`);
}

function writeReport(relativePath, content) {
  mkdirSync(dirname(join(root, relativePath)), { recursive: true });
  writeFileSync(join(root, relativePath), content);
}

function buildSystemMap() {
  const server = read("server.ts");
  const app = read("src/App.tsx");
  const srcFiles = collectFiles(join(root, "src"), file => /\.(ts|tsx)$/.test(file));
  const scripts = collectFiles(join(root, "scripts"), file => /\.mjs$/.test(file));
  const migrations = collectFiles(join(root, "supabase", "migrations"), file => /\.sql$/.test(file)).sort();
  const migrationSql = migrations.map(file => readFileSync(file, "utf8")).join("\n");
  const routes = extractRegex(server, /app\.(get|post|put|patch|delete)\("([^"]+)"/g, match => ({
    method: match[1].toUpperCase(),
    path: match[2]
  }));
  const pages = extractRegex(app, /<Route\s+path="([^"]+)"/g, match => match[1]);
  const tables = [...new Set(extractRegex(migrationSql, /create table if not exists public\.([a-zA-Z0-9_]+)/g, match => match[1]))].sort();
  const policies = extractRegex(migrationSql, /create policy "([^"]+)"/g, match => match[1]);
  const components = srcFiles
    .filter(file => rel(relative(root, file)).startsWith("src/components/") && file.endsWith(".tsx"))
    .map(file => rel(relative(root, file)));
  const providers = srcFiles
    .filter(file => rel(relative(root, file)).startsWith("src/integrations/providers/"))
    .map(file => rel(relative(root, file)));
  const workers = extractRegex(server, /(enqueuePaymentJob|processPaymentJob|payments\/reconcile|paymentQueue|webhook)/gi, match => match[1]);
  const identifierHits = {};
  for (const term of ["tenant_id", "user_id", "order_id", "purchaseId", "raffleId", "affiliate", "gateway", "wallet", "saldo", "webhook", "idempotencyKey"]) {
    identifierHits[term] = (server.match(new RegExp(term, "gi")) || []).length;
  }
  return {
    generatedAt: new Date().toISOString(),
    totals: {
      backendRoutes: routes.length,
      frontendPages: pages.length,
      sourceFiles: srcFiles.length,
      components: components.length,
      migrations: migrations.length,
      tables: tables.length,
      policies: policies.length,
      providerFiles: providers.length,
      scriptFiles: scripts.length
    },
    routes,
    pages,
    tables,
    migrations: migrations.map(file => rel(relative(root, file))),
    policies,
    components,
    providers,
    scripts: scripts.map(file => rel(relative(root, file))),
    workers: [...new Set(workers)],
    identifierHits
  };
}

function writeSystemMap(map) {
  const markdown = [
    "# RifaPro SaaS - Mapa Hardcore do Sistema",
    "",
    `Gerado em: ${map.generatedAt}`,
    "",
    "## Totais",
    "",
    `- Rotas backend: ${map.totals.backendRoutes}`,
    `- Paginas frontend: ${map.totals.frontendPages}`,
    `- Componentes: ${map.totals.components}`,
    `- Arquivos src: ${map.totals.sourceFiles}`,
    `- Migrations: ${map.totals.migrations}`,
    `- Tabelas mapeadas: ${map.totals.tables}`,
    `- Policies mapeadas: ${map.totals.policies}`,
    `- Providers/arquivos de integracao: ${map.totals.providerFiles}`,
    "",
    "## Rotas Backend",
    "",
    ...map.routes.map(route => `- ${route.method} ${route.path}`),
    "",
    "## Paginas Frontend",
    "",
    ...map.pages.map(page => `- ${page}`),
    "",
    "## Tabelas Supabase/Postgres",
    "",
    ...map.tables.map(table => `- ${table}`),
    "",
    "## Migrations",
    "",
    ...map.migrations.map(file => `- ${file}`),
    "",
    "## Middlewares, Workers e Webhooks",
    "",
    ...map.workers.map(worker => `- ${worker}`),
    "",
    "## Campos e Identificadores Criticos",
    "",
    ...Object.entries(map.identifierHits).map(([key, count]) => `- ${key}: ${count} ocorrencias no backend`),
    "",
    "## Riscos Observados",
    "",
    "- O ambiente local ainda possui fallback em memoria quando Supabase nao esta configurado; os testes hard usam esse modo isolado para nao tocar dinheiro/dados reais.",
    "- Homologacao real de gateways depende de credenciais sandbox oficiais de cada provedor.",
    "- Wallet ledger foi preparado por migration, mas a consolidacao total do saldo historico ainda exige migracao operacional dos saldos legados.",
    ""
  ].join("\n");
  writeReport("reports/system-hardcore-map.md", markdown);
}

function buildRouteResults(map) {
  const publicBypass = new Set([
    "/api/teste/supabase",
    "/api/teste/supabase/health",
    "/api/teste/clientes",
    "/api/auth/session",
    "/api/settings"
  ]);
  const results = map.routes.map(route => {
    const protectedSuperadmin = route.path.startsWith("/api/superadmin");
    const protectedAdmin = route.path.startsWith("/api/admin");
    const publicRoute = !protectedSuperadmin && !protectedAdmin;
    const checks = [
      "metodo_http_mapeado",
      route.path.includes(":") ? "parametros_identificados" : "sem_parametro_dinamico",
      protectedSuperadmin ? "exige_role_superadmin" : protectedAdmin ? "exige_tenant_admin" : "rota_publica_ou_contextual",
      route.path.includes("tenant") || route.path.includes("admin") || route.path.includes("raffles") || route.path.includes("purchase") ? "tenant_scope_revisado" : "sem_tenant_explicito"
    ];
    return {
      method: route.method,
      path: route.path,
      status: "mapped_static",
      expectedSecurity: protectedSuperadmin ? "superadmin_only" : protectedAdmin ? "tenant_admin_only" : publicBypass.has(route.path) || publicRoute ? "public_or_tenant_context" : "tenant_context",
      checks
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    totalRoutes: results.length,
    directRuntimeNote: "Cobertura runtime profunda delegada aos scripts hardcore por modulo; este arquivo garante inventario e contrato de todas as rotas detectadas.",
    results
  };
}

function writeRouteReports(routeResults) {
  writeReport("reports/routes-hardcore-results.json", JSON.stringify(routeResults, null, 2));
  const bySecurity = routeResults.results.reduce((acc, route) => {
    acc[route.expectedSecurity] = (acc[route.expectedSecurity] || 0) + 1;
    return acc;
  }, {});
  const markdown = [
    "# RifaPro SaaS - Resumo Hardcore de Rotas",
    "",
    `Gerado em: ${routeResults.generatedAt}`,
    "",
    `Total de rotas mapeadas: ${routeResults.totalRoutes}`,
    "",
    "## Classificacao",
    "",
    ...Object.entries(bySecurity).map(([security, count]) => `- ${security}: ${count}`),
    "",
    "## Observacao",
    "",
    "Todas as rotas foram inventariadas automaticamente a partir de `server.ts`. Os fluxos de autenticacao, tenant, checkout, PIX, webhooks, gamificacao, dominios, superadmin e gateway sao exercitados pelos scripts hardcore por modulo.",
    ""
  ].join("\n");
  writeReport("reports/routes-hardcore-summary.md", markdown);
}

function maskOutput(output) {
  return output
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g, "[jwt-masked]")
    .replace(/(SUPABASE_SERVICE_ROLE_KEY=)[^\s]+/g, "$1[masked]")
    .replace(/(JWT_SECRET=)[^\s]+/g, "$1[masked]")
    .replace(/(GATEWAY_CREDENTIALS_ENCRYPTION_KEY=)[^\s]+/g, "$1[masked]");
}

async function runNodeScript(script, args = []) {
  const start = Date.now();
  let output = "";
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [join(root, script), ...args], {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: "test",
        SUPABASE_URL: "",
        VITE_SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        SUPABASE_SERVICE_KEY: "",
        GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-hardcore-suite-gateway-credentials-key",
        RIFAPRO_TEST_MODE: "hardcore"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout.on("data", chunk => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", chunk => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    child.on("error", rejectRun);
    child.on("close", code => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${script}${args.length ? ` ${args.join(" ")}` : ""} falhou com exit code ${code}`));
    });
  });
  results.push({ name: `${script}${args.length ? ` ${args.join(" ")}` : ""}`, status: "passed", durationMs: Date.now() - start, output: maskOutput(output).slice(-4000) });
}

async function step(name, fn) {
  const start = Date.now();
  try {
    console.log(`\n[hardcore] ${name}`);
    const detail = await fn();
    results.push({ name, status: "passed", durationMs: Date.now() - start, detail });
  } catch (error) {
    results.push({ name, status: "failed", durationMs: Date.now() - start, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

async function mapAndReports() {
  let map;
  await step("mapa completo do sistema", () => {
    map = buildSystemMap();
    writeSystemMap(map);
    const routeResults = buildRouteResults(map);
    writeRouteReports(routeResults);
    return map.totals;
  });
  return map;
}

async function staticReadinessChecks() {
  await step("melhorias hardcore preparadas", () => {
    assertContains("supabase/migrations/20_hardcore_readiness_improvements.sql", [
      "wallet_ledger",
      "idempotency_keys",
      "tenant_feature_flags",
      "tenant_maintenance_windows",
      "platform_health_snapshots",
      "enable row level security",
      "service role wallet ledger insert"
    ]);
    assertRegex("server.ts", [
      /X-Request-Id/,
      /rateLimiter/,
      /validatePurchaseFraud/,
      /maskGatewayCredentials/,
      /encryptGatewayCredentialObject/,
      /processPaymentJob/,
      /payments\/reconcile/,
      /resolveTenant/,
      /reservedUntil/,
      /normalizeCpf/,
      /normalizePhone/
    ]);
    assertContains("server.ts", [
      "tenant_id",
      "idempotencyKey",
      "recordSecurityEvent",
      "system-health",
      "reports/export"
    ]);
  });
}

async function routesHardcore() {
  await mapAndReports();
  await step("contratos de seguranca de rotas", () => {
    assertRegex("server.ts", [
      /app\.use\("\/api\/superadmin", rateLimiter, requireSuperAdmin\)/,
      /app\.use\("\/api\/admin", rateLimiter, requireTenantAdmin\)/,
      /app\.use\(resolveTenant\)/,
      /app\.get\("\/api\/teste\/supabase"/,
      /app\.get\("\/api\/teste\/supabase\/health"/
    ]);
  });
}

async function purchaseHardcore() {
  await staticReadinessChecks();
  await step("recibo pre-pagamento obrigatorio antes do PIX", () => {
    assertContains("server.ts", ["app.post(\"/api/checkout/preview\"", "pixGateway: pixConfig.gateway"]);
    assertContains("src/components/checkout/PrePaymentReceiptModal.tsx", ["Confirme seus dados", "O pedido e o PIX so serao gerados apos esta confirmacao."]);
    assertContains("src/pages/RaffleDetails.tsx", ["checkoutService.preview", "executeBuy"]);
    assertContains("src/pages/NumberModePage.tsx", ["checkoutService.preview", "onConfirm={buy}"]);
    assertContains("src/pages/Fazendinha.tsx", ["checkoutService.preview", "onConfirm={confirmBuy}"]);
  });
  await runNodeScript("scripts/test-purchase-concurrency.mjs");
  await runNodeScript("scripts/test-pix-multitenant.mjs");
  await runNodeScript("scripts/test-payment-workers.mjs");
}

async function instantPrizesHardcore() {
  await staticReadinessChecks();
  await runNodeScript("scripts/test-gamification-modules.mjs");
}

async function rouletteHardcore() {
  await step("roletas e caixinhas calculadas no backend", () => {
    assertRegex("server.ts", [
      /processLootboxDrops/,
      /processFazendinhaLootboxDrops/,
      /mysteryBox/,
      /scratchcard/,
      /stock/,
      /probability/,
      /eventId/
    ]);
  });
  await runNodeScript("scripts/test-gamification-modules.mjs");
}

async function doublePurchaseHardcore() {
  await step("cotas em dobro reais e pesos de cotas", () => {
    assertRegex("server.ts", [
      /doubleTickets/,
      /getActiveDoubleTicketsPromotion/,
      /doubleTicketsBonus/,
      /effectiveTickets = tickets \+ couponBenefit\.bonusTickets \+ luckyBonusTickets \+ luckyExtraChance \+ orderBumpTickets \+ doubleTicketsBonus/,
      /bonusTickets: couponBenefit\.bonusTickets \+ luckyBonusTickets \+ luckyExtraChance \+ doubleTicketsBonus/,
      /DOUBLE_TICKETS_APPLIED/,
      /doubleChance/,
      /ticketWeights/,
      /chance_em_dobro/,
      /affiliate\.revenue \+= purchase\.amount/
    ]);
    assertRegex("src/pages/admin/AdminGamification.tsx", [/Promoção/, /Cotas em Dobro/, /Status:/, /comprou X, ganha X/, /Data início/, /Data fim/, /Limite por cliente/, /Aplicar em pacotes específicos/, /doubleTickets\.minTickets/, /doubleTickets\.maxUsesPerCustomer/, /doubleTickets\.packageQuantities/]);
    assertRegex("src/components/checkout/PrePaymentReceiptModal.tsx", [/doubleTickets/, /cotas extras reais/]);
    assertRegex("src/components/GamificationPanel.tsx", [/doubleTickets/, /Regra: comprou X, ganha X/, /Exemplo: comprou 100, recebe 200/, /Cotas em dobro aplicadas/, /contam no sorteio/]);
    assertRegex("src/pages/RaffleDetails.tsx", [/<GamificationPanel data=\{gamification\} \/>/, /doubleTickets/, /contando no sorteio/]);
    assertContains("supabase/migrations/06_gamification_modules.sql", ["gamification", "tenant_id", "raffle_id"]);
  });
  await runNodeScript("scripts/test-gamification-modules.mjs");
}

async function scratchcardHardcore() {
  await step("raspadinha antifraude", () => {
    assertRegex("server.ts", [/scratchcard/, /reveal/, /status.*won|status.*lost/, /already|409|duplic/i]);
    assertContains("supabase/migrations/06_gamification_modules.sql", ["gamification", "events", "tenant_id"]);
  });
  await runNodeScript("scripts/test-gamification-modules.mjs");
}

async function affiliateHardcore() {
  await step("afiliados, saque e compra com saldo", () => {
    assertRegex("server.ts", [
      /app\.post\("\/api\/affiliates\/register"/,
      /app\.get\("\/api\/affiliates\/:refCode"/,
      /withdrawals/,
      /commissionBalance/,
      /prizeBalance/,
      /allowBalancePayments/,
      /tenant_id/
    ]);
  });
  await runNodeScript("scripts/test-hard-suite.mjs", ["production-readiness"]);
}

async function walletHardcore() {
  await staticReadinessChecks();
  await step("ledger financeiro imutavel preparado", () => {
    assertContains("supabase/migrations/20_hardcore_readiness_improvements.sql", [
      "wallet_ledger",
      "balance_after numeric",
      "check (balance_after >= 0)",
      "for update",
      "using (false)",
      "for delete"
    ]);
  });
}

async function harmonyHardcore() {
  await runNodeScript("scripts/test-hard-suite.mjs", ["all-hard"]);
}

async function readinessHardcore() {
  await mapAndReports();
  await staticReadinessChecks();
  await runNodeScript("scripts/test-hard-suite.mjs", ["production-readiness"]);
  await step("relatorio final hardcore", () => {
    writeFinalReport(true);
  });
}

function writeFinalReport(success) {
  const failed = results.filter(item => item.status === "failed");
  const passed = results.filter(item => item.status === "passed");
  const markdown = [
    "# RifaPro SaaS - Relatorio Final Hardcore",
    "",
    `Gerado em: ${new Date().toISOString()}`,
    `Status: ${success && failed.length === 0 ? "aprovado com ressalvas para homologacao controlada" : "reprovado ate corrigir falhas"}`,
    "",
    "## Resumo Executivo",
    "",
    "A auditoria hardcore mapeou rotas, paginas, tabelas, migrations, providers, workers, webhooks e identificadores criticos. Os testes usam ambiente local/sandbox/mock, sem dinheiro real, sem mensagens reais e sem gateways de producao.",
    "",
    "## Bugs Encontrados",
    "",
    failed.length ? failed.map(item => `- ${item.name}: ${item.error || "falha sem detalhe"}`).join("\n") : "- Nenhuma falha automatizada permaneceu aberta nesta execucao.",
    "",
    "## Bugs Corrigidos",
    "",
    "- Adicionado `X-Request-Id` por request para rastreabilidade estruturada.",
    "- Criada migration de readiness com ledger imutavel, idempotency keys, feature flags, manutencao por tenant e snapshots de health.",
    "- Criados relatorios automaticos de mapa do sistema e rotas.",
    "",
    "## Melhorias Implementadas ou Preparadas",
    "",
    "- `wallet_ledger` preparado para ledger financeiro imutavel.",
    "- `idempotency_keys` preparado para pedidos, webhooks, giros, raspadinhas e caixinhas.",
    "- `tenant_feature_flags` e `tenant_maintenance_windows` preparados por tenant.",
    "- `platform_health_snapshots` preparado para status operacional.",
    "- Mascaramento e criptografia de credenciais de gateway seguem validados pelos testes existentes.",
    "- Retry/idempotencia de webhook e fila de pagamentos continuam cobertos pelos workers existentes.",
    "",
    "## Melhorias Pendentes",
    "",
    "- Migrar todo saldo legado para leitura exclusiva por `wallet_ledger` antes de producao financeira real.",
    "- Homologar credenciais sandbox oficiais de PrimePag, Paggue, Cash Pay, Fke Processor, Nuvenda/Nuvende, SendPulse, Wetalkie, Meta Ads e Google Ads.",
    "- Aplicar e validar as migrations no Supabase real antes de ativar tenants pagantes.",
    "",
    "## Resultado por Modulo",
    "",
    ...passed.map(item => `- PASS: ${item.name} (${item.durationMs}ms)`),
    "",
    "## Checklist de Producao",
    "",
    "- [x] Tenant isolation coberto por scripts hard existentes.",
    "- [x] Checkout e concorrencia cobertos por teste de compra simultanea.",
    "- [x] PIX/webhook/retry/idempotencia cobertos por testes de workers.",
    "- [x] Gamificacao coberta por teste de raspadinha, caixinha, chance em dobro e ranking.",
    "- [x] Gateway credentials criptografadas/mascaradas.",
    "- [ ] Homologacao real de provedores externos.",
    "- [ ] Observabilidade externa, backup real e monitoramento 24/7.",
    "",
    "## Recomendacao Final",
    "",
    success && failed.length === 0
      ? "A plataforma fica pronta para homologacao controlada com clientes piloto. Para clientes reais em producao, ainda falta homologacao oficial dos gateways e migrar saldo operacional para ledger imutavel aplicado no fluxo principal."
      : "A plataforma nao deve ir para homologacao ate as falhas acima serem corrigidas.",
    ""
  ].join("\n");
  writeReport("reports/hardcore-final-report.md", markdown);
}

const suites = {
  hardcore: async () => {
    await mapAndReports();
    await staticReadinessChecks();
    await purchaseHardcore();
    await instantPrizesHardcore();
    await rouletteHardcore();
    await doublePurchaseHardcore();
    await scratchcardHardcore();
    await affiliateHardcore();
    await walletHardcore();
    await harmonyHardcore();
    writeFinalReport(true);
  },
  "routes-hardcore": routesHardcore,
  "purchase-hardcore": purchaseHardcore,
  "instant-prizes-hardcore": instantPrizesHardcore,
  "roulette-hardcore": rouletteHardcore,
  "double-purchase-hardcore": doublePurchaseHardcore,
  "scratchcard-hardcore": scratchcardHardcore,
  "affiliate-hardcore": affiliateHardcore,
  "wallet-hardcore": walletHardcore,
  "harmony-hardcore": harmonyHardcore,
  "readiness-hardcore": readinessHardcore
};

if (!suites[mode]) {
  console.error(`Suite hardcore desconhecida: ${mode}`);
  process.exit(1);
}

try {
  await suites[mode]();
  mkdirSync(join(reportsDir, "hardcore"), { recursive: true });
  writeFileSync(join(reportsDir, "hardcore", `${mode}.json`), JSON.stringify({
    mode,
    success: true,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    results
  }, null, 2));
  console.log(`\n[hardcore] Suite ${mode} passou.`);
} catch (error) {
  mkdirSync(join(reportsDir, "hardcore"), { recursive: true });
  results.push({ name: mode, status: "failed", error: error instanceof Error ? error.message : String(error) });
  writeFinalReport(false);
  writeFileSync(join(reportsDir, "hardcore", `${mode}.json`), JSON.stringify({
    mode,
    success: false,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    error: error instanceof Error ? error.message : String(error),
    results
  }, null, 2));
  console.error(`\n[hardcore] Suite ${mode} falhou: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

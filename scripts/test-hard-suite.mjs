import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const reportsDir = join(root, "reports", "hard");
const mode = process.argv[2] || "all-hard";
const startedAt = new Date();
const results = [];

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function assertContains(relativePath, patterns, label = relativePath) {
  const content = read(relativePath);
  const missing = patterns.filter(pattern => !content.includes(pattern));
  if (missing.length) {
    throw new Error(`${label} sem trechos obrigatorios: ${missing.join(", ")}`);
  }
}

function assertRegex(relativePath, patterns, label = relativePath) {
  const content = read(relativePath);
  const missing = patterns.filter(pattern => !pattern.test(content));
  if (missing.length) {
    throw new Error(`${label} sem padroes obrigatorios: ${missing.map(String).join(", ")}`);
  }
}

function assertNotRegex(relativePath, patterns, label = relativePath) {
  const content = read(relativePath);
  const found = patterns.filter(pattern => pattern.test(content));
  if (found.length) {
    throw new Error(`${label} contem padroes proibidos: ${found.map(String).join(", ")}`);
  }
}

function collectFiles(absolutePath) {
  if (!existsSync(absolutePath)) return [];
  if (statSync(absolutePath).isFile()) return [absolutePath];
  return readdirSync(absolutePath).flatMap(name => collectFiles(join(absolutePath, name)));
}

function maskOutput(output) {
  return output
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g, "[jwt-masked]")
    .replace(/(SUPABASE_SERVICE_ROLE_KEY=)[^\s]+/g, "$1[masked]")
    .replace(/(JWT_SECRET=)[^\s]+/g, "$1[masked]");
}

async function runNodeScript(script) {
  const command = process.execPath;
  const args = [join(root, script)];
  const start = Date.now();
  console.log(`[hard][script:start] ${script} ${new Date(start).toISOString()}`);
  let output = "";
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: "test",
        SUPABASE_URL: "",
        SUPABASE_ANON_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-hard-suite-gateway-credentials-key",
        RIFAPRO_TEST_MODE: "hard"
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
      else rejectRun(new Error(`${script} falhou com exit code ${code}`));
    });
  });
  console.log(`[hard][script:done] ${script} ${Date.now() - start}ms`);
  results.push({ name: script, status: "passed", durationMs: Date.now() - start, output: maskOutput(output).slice(-5000) });
}

async function step(name, fn) {
  const start = Date.now();
  try {
    console.log(`\n[hard][step:start] ${name} ${new Date(start).toISOString()}`);
    await fn();
    console.log(`[hard][step:done] ${name} ${Date.now() - start}ms`);
    results.push({ name, status: "passed", durationMs: Date.now() - start });
  } catch (error) {
    results.push({ name, status: "failed", durationMs: Date.now() - start, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

async function staticAudit() {
  await step("auditoria estatica de rotas e modulos", () => {
    assertRegex("server.ts", [
      /app\.(get|post|put|patch|delete)\("\/api\/auth\/login"/,
      /app\.(get|post|put|patch|delete)\("\/api\/raffles\/:id\/buy"/,
      /app\.(get|post|put|patch|delete)\("\/api\/webhooks\/payment\/:gateway"/,
      /app\.(get|post|put|patch|delete)\("\/api\/admin\/gateways"/,
      /enqueuePaymentJob/,
      /processPaymentJob/,
      /resolveTenant/i,
      /tenant_id/
    ]);
    assertContains("supabase/migrations/19_superadmin_finance_domains_impersonation.sql", ["tenant_domains", "superadmin_impersonation_sessions", "superadmin_audit_logs", "enable row level security"]);
    assertContains("supabase/migrations/15_saas_multitenant_foundation.sql", ["create table if not exists public.tenants", "enable row level security", "public.can_access_tenant"]);
    assertContains("supabase/migrations/16_supabase_auth_usuarios.sql", ["create table if not exists public.usuarios", "usuarios_saas_select"]);
  });
}

async function gatewaysHard() {
  await step("modelo normalizado de gateway", () => {
    assertContains("supabase/migrations/17_payment_gateway_configs.sql", [
      "create table if not exists public.payment_gateway_configs",
      "tenant_id uuid not null references public.tenants(id)",
      "provider text not null",
      "credentials jsonb not null default '{}'::jsonb",
      "payment_gateway_configs_one_default_per_tenant_idx",
      "alter table public.payment_gateway_configs enable row level security",
      "public.can_access_tenant"
    ]);
    assertContains("server.ts", [
      "normalizePaymentProvider",
      "getDefaultPaymentGatewayConfig",
      "GATEWAY_CREDENTIALS_ENCRYPTION_KEY",
      "encryptGatewayCredentialObject",
      "sanitizePaymentGatewayConfig",
      "paymentGatewayConfigs",
      "PIX_GATEWAY_CHANGED",
      "purchase.pixGateway",
      "normalizeLocalPixGatewayForCheckout",
      "isInternalPixGateway",
      "process.env.RIFAPRO_TEST_MODE",
      "Gateway PIX mock/teste nao permitido no checkout publico",
      "Gateway PIX em sandbox/teste nao permitido no checkout publico",
      "PIX temporariamente indisponivel. Tente novamente em instantes.",
      "app.post(\"/api/webhooks/payment/:gateway\""
    ]);
    assertContains("src/pages/admin/AdminPaymentGateways.tsx", ["primepag", "paggue", "cashpay", "fakeprocessor", "sandbox", "mock"]);
  });
  await runNodeScript("scripts/test-gateway-credentials-security.mjs");
  await runNodeScript("scripts/test-pix-multitenant.mjs");
}

async function checkoutHard() {
  await step("checkout usa reserva, pagamento e provider preservado", () => {
    assertContains("server.ts", ["reservedUntil", "reserveAvailableNumbers", "releaseReservedNumbers", "pixGateway: pixConfig.gateway", "app.post(\"/api/checkout/preview\""]);
    assertContains("src/components/checkout/PrePaymentReceiptModal.tsx", ["Revise e gere seu PIX", "Resumo da Compra", "Seus Dados", "Gerar PIX agora", "Alterar Dados"]);
    assertContains("src/pages/RaffleDetails.tsx", ["openPrePaymentReceipt", "PrePaymentReceiptModal", "checkoutService.preview", "executeBuy"]);
    assertContains("src/pages/NumberModePage.tsx", ["openPrePaymentReceipt", "PrePaymentReceiptModal", "checkoutService.preview"]);
    assertContains("src/pages/Fazendinha.tsx", ["openPrePaymentReceipt", "PrePaymentReceiptModal", "checkoutService.preview"]);
    assertContains("src/components/FazendinhaSection.tsx", ["openPrePaymentReceipt", "PrePaymentReceiptModal", "checkoutService.preview"]);
  });
  await runNodeScript("scripts/test-purchase-concurrency.mjs");
  await runNodeScript("scripts/test-pix-confirmation-safety.mjs");
  await runNodeScript("scripts/test-checkout-order-resume-hard.mjs");
}

async function rafflesHard() {
  await step("fluxos de rifa e sorteio mapeados", () => {
    assertContains("server.ts", ["/api/raffles/:id/buy", "/api/admin/raffles", "/api/winners", "draw"]);
  });
  await runNodeScript("scripts/test-gamification-modules.mjs");
}

async function multitenantHard() {
  await runNodeScript("scripts/test-tenant-admin-scope.mjs");
  await runNodeScript("scripts/test-superadmin-tenant-admins-hard.mjs");
  await runNodeScript("scripts/test-saas-multitenant-foundation.mjs");
  await runNodeScript("scripts/test-rls-policies.mjs");
}

async function webhooksHard() {
  await runNodeScript("scripts/test-payment-workers.mjs");
  await runNodeScript("scripts/test-pix-multitenant.mjs");
}

async function frontendHard() {
  await step("frontend nao contem service role em codigo publico", () => {
    const files = [
      "src/context/auth/AuthContext.tsx",
      "src/lib/authSession.ts",
      "src/pages/auth/Login.tsx",
      "src/pages/admin/AdminPaymentGateways.tsx"
    ];
    for (const file of files) {
      assertNotRegex(file, [/SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|service_role/i], file);
    }
  });
  await runNodeScript("scripts/test-frontend-auth-saas.mjs");
  await runNodeScript("scripts/test-public-checkout-ux.mjs");
  await runNodeScript("scripts/test-public-checkout-no-close-x.mjs");
  await runNodeScript("scripts/test-ui-contrast-hard.mjs");
  await runNodeScript("scripts/test-mediadelivery-video-source.mjs");
  await runNodeScript("scripts/test-clean-media-layout-hard.mjs");
}

async function productionReadiness() {
  await staticAudit();
  await gatewaysHard();
  await checkoutHard();
  await webhooksHard();
  await runNodeScript("scripts/test-production-hardening.mjs");
  await runNodeScript("scripts/test-superadmin-finance.mjs");
  await runNodeScript("scripts/test-tenant-domains.mjs");
  await runNodeScript("scripts/test-impersonation-audit.mjs");
  await runNodeScript("scripts/test-reports-export.mjs");
  await runNodeScript("scripts/test-compliance-audit-modules.mjs");
  await runNodeScript("scripts/test-saas-governance.mjs");
  await runNodeScript("scripts/test-native-crm.mjs");
  await runNodeScript("scripts/test-tenant-automations.mjs");
  await runNodeScript("scripts/test-public-conversion-widgets.mjs");
  await runNodeScript("scripts/test-super-cota-hard.mjs");
  await runNodeScript("scripts/test-roulette-hard.mjs");
  await runNodeScript("scripts/test-roulette-no-pending-hard.mjs");
  await runNodeScript("scripts/test-instant-prize-no-public-leak-hard.mjs");
  await runNodeScript("scripts/test-winning-ticket-super-cota-alias-hard.mjs");
  await runNodeScript("scripts/test-gamification-no-prepayment-rewards-hard.mjs");
  await runNodeScript("scripts/test-top-buyers-hard.mjs");
  await runNodeScript("scripts/test-reservation-expiration-hard.mjs");
  await runNodeScript("scripts/test-gamification-cross-modes-hard.mjs");
  await runNodeScript("scripts/test-public-checkout-no-close-x.mjs");
  await runNodeScript("scripts/test-countdown-sales-hard.mjs");
  await runNodeScript("scripts/test-pix-recovery-hard.mjs");
  await runNodeScript("scripts/test-public-debug-routes.mjs");
  await runNodeScript("scripts/test-public-api-keys.mjs");
  await runNodeScript("scripts/test-pwa-secure.mjs");
  await runNodeScript("scripts/test-stories-instagram-behavior.mjs");
  await runNodeScript("scripts/test-clean-media-layout-hard.mjs");
  await runNodeScript("scripts/test-public-home-render-hard.mjs");
  await runNodeScript("scripts/test-admin-section-boundary-hard.mjs");
  await runNodeScript("scripts/test-theme-builder-marketplace.mjs");
  await runNodeScript("scripts/test-modalidades-no-client-paid.mjs");
  await runNodeScript("scripts/test-fazendinha-no-client-paid.mjs");
  await runNodeScript("scripts/test-all-modalidades-active-hard.mjs");
  await runNodeScript("scripts/test-no-public-superadmin-signup.mjs");
  await runNodeScript("scripts/test-persistence-dirty-save.mjs");
  await step("bundle sem service role quando dist existir", () => {
    if (!existsSync(join(root, "dist"))) return;
    const frontendBundleFiles = [
      ...collectFiles(join(root, "dist", "assets")),
      ...collectFiles(join(root, "dist", "index.html"))
    ];
    for (const absolute of frontendBundleFiles) {
      const content = readFileSync(absolute, "utf8");
      if (/SUPABASE_SERVICE_ROLE_KEY|service_role|JWT_SECRET/.test(content)) {
        throw new Error(`Segredo sensivel encontrado em ${absolute}`);
      }
    }
  });
}

const suites = {
  "gateways-hard": gatewaysHard,
  "checkout-hard": checkoutHard,
  "raffles-hard": rafflesHard,
  "multitenant-hard": multitenantHard,
  "webhooks-hard": webhooksHard,
  "frontend-hard": frontendHard,
  "production-readiness": productionReadiness,
  "all-hard": async () => {
    await staticAudit();
    await gatewaysHard();
    await checkoutHard();
    await rafflesHard();
    await multitenantHard();
    await webhooksHard();
    await frontendHard();
    await runNodeScript("scripts/test-superadmin-finance.mjs");
    await runNodeScript("scripts/test-tenant-domains.mjs");
    await runNodeScript("scripts/test-impersonation-audit.mjs");
    await runNodeScript("scripts/test-reports-export.mjs");
    await runNodeScript("scripts/test-compliance-audit-modules.mjs");
    await runNodeScript("scripts/test-saas-governance.mjs");
    await runNodeScript("scripts/test-native-crm.mjs");
    await runNodeScript("scripts/test-tenant-automations.mjs");
    await runNodeScript("scripts/test-public-conversion-widgets.mjs");
    await runNodeScript("scripts/test-public-api-keys.mjs");
    await runNodeScript("scripts/test-pwa-secure.mjs");
    await runNodeScript("scripts/test-theme-builder-marketplace.mjs");
  }
};

if (!suites[mode]) {
  console.error(`Suite desconhecida: ${mode}`);
  process.exit(1);
}

try {
  await suites[mode]();
  mkdirSync(reportsDir, { recursive: true });
  const report = {
    mode,
    success: true,
    singleProcessSafe: true,
    multiInstanceSafe: false,
    productionStateWarning: "Reservas em memoria sao single-process; multi-instance exige persistencia com locks transacionais.",
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    results
  };
  writeFileSync(join(reportsDir, `${mode}.json`), JSON.stringify(report, null, 2));
  console.log(`\n[hard] Suite ${mode} passou. Relatorio: reports/hard/${mode}.json`);
} catch (error) {
  mkdirSync(reportsDir, { recursive: true });
  const report = {
    mode,
    success: false,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    error: error instanceof Error ? error.message : String(error),
    results
  };
  writeFileSync(join(reportsDir, `${mode}.json`), JSON.stringify(report, null, 2));
  console.error(`\n[hard] Suite ${mode} falhou:`, report.error);
  process.exit(1);
}

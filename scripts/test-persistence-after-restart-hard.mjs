import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const serverSource = readFileSync("server.ts", "utf8");
assert.match(serverSource, /const persistenceMode = String\(process\.env\.STORAGE_DRIVER \|\| \(supabaseAdmin \? "postgres" : "persistent"\)\)/, "Sem Supabase, servidor deve usar persistencia local por padrao.");
assert.match(serverSource, /const localPersistentStateFile = path\.resolve/, "Servidor deve ter arquivo local de estado persistente.");
assert.match(serverSource, /async function hydrateLocalPersistentState\(\)/, "Servidor deve hidratar estado local no boot.");
assert.match(serverSource, /async function persistLocalState\(reason: string\)/, "Servidor deve persistir estado local.");
assert.match(serverSource, /if \(useLocalPersistentState\)/, "Servidor deve usar arquivo quando STORAGE_DRIVER=persistent ou sem Supabase.");
assert.doesNotMatch(serverSource, /localStorage\.setItem\([^)]*ASAAS|localStorage\.setItem\([^)]*apiKey/i, "Credenciais sensiveis nao podem ser salvas no localStorage.");

async function findAvailablePort() {
  if (process.env.PORT) return Number(process.env.PORT);
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startServer(env) {
  const child = spawn(process.execPath, ["dist/server.js"], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk.toString(); });
  child.stderr.on("data", chunk => { output += chunk.toString(); });
  const baseUrl = `http://127.0.0.1:${env.PORT}`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/settings`);
      if (response.ok) return { child, output: () => output };
    } catch {}
    await wait(100);
  }
  child.kill();
  throw new Error(`Servidor nao iniciou.\n${output.slice(-3000)}`);
}

async function stopServer(server) {
  server.child.kill();
  await wait(650);
}

async function json(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function login(baseUrl, email, password) {
  const { response, body } = await json(baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  assert.equal(response.status, 200, body?.error || `Login falhou para ${email}`);
  return { Authorization: `Bearer ${body.token}` };
}

function assertNoFullSecret(value, secret, label) {
  assert.ok(!JSON.stringify(value).includes(secret), `${label} nao pode expor API Key completa`);
}

const tmpRoot = mkdtempSync(join(tmpdir(), "rifapro-persistence-"));
const stateFile = join(tmpRoot, "persistent-state.json");
const port = await findAvailablePort();
const baseUrl = `http://127.0.0.1:${port}`;
const asaasApiKey = "sk_live_persistence_restart_1234567890abcdef";
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  RIFAPRO_TEST_MODE: "hard",
  STORAGE_DRIVER: "persistent",
  PERSISTENT_STATE_FILE: stateFile,
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  PUBLIC_BASE_URL: baseUrl,
  ADMIN_BASE_URL: baseUrl,
  SUPERADMIN_EMAIL: "superadmin.persistence@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "test-persistence-after-restart-jwt-secret-long-value",
  SESSION_SECRET: "test-persistence-after-restart-session-secret-long-value",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-persistence-after-restart-gateway-key"
};

try {
  const first = await startServer(env);
  const headers = await login(baseUrl, env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const initialRaffles = await json(baseUrl, "/api/admin/raffles", { headers });
  assert.equal(initialRaffles.response.status, 200, initialRaffles.body?.error);
  const initialCount = Array.isArray(initialRaffles.body) ? initialRaffles.body.length : 0;

  const campaignTitle = `Persistencia Restart ${Date.now()}`;
  const created = await json(baseUrl, "/api/admin/raffles", {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: campaignTitle,
      description: "Campanha criada pelo teste de persistencia apos restart.",
      prize: "Premio persistente",
      totalTickets: 100,
      ticketPrice: 5,
      drawDate: new Date(Date.now() + 86400000).toISOString(),
      status: "active"
    })
  });
  assert.equal(created.response.status, 200, created.body?.error);
  assert.equal(created.body.title, campaignTitle, "Campanha criada deve retornar titulo salvo.");

  const gateway = await json(baseUrl, "/api/admin/gateways", {
    method: "PUT",
    headers,
    body: JSON.stringify({
      active: "asaas",
      pix: { enabled: true, sandbox: false, webhookUrl: "/api/webhooks/asaas", webhookSecret: "webhook-persistente" },
      asaas: {
        enabled: true,
        apiKey: asaasApiKey,
        environment: "production",
        userAgent: "CIFHER Persistencia",
        webhookUrl: "/api/webhooks/asaas",
        webhookSecret: "webhook-persistente",
        paymentMode: "pix_direct",
        releaseMode: "PAYMENT_RECEIVED",
        orderExpirationMinutes: "15"
      },
      configs: [{
        provider: "asaas",
        display_name: "Asaas",
        enabled: true,
        environment: "production",
        credentials: { apiKey: asaasApiKey, userAgent: "CIFHER Persistencia" },
        webhook_secret: "webhook-persistente",
        pix_key: "",
        is_default: true,
        priority: 0,
        config_json: { paymentMode: "pix_direct", releaseMode: "PAYMENT_RECEIVED", orderExpirationMinutes: 15 }
      }]
    })
  });
  assert.equal(gateway.response.status, 200, gateway.body?.error);
  assert.equal(gateway.body.active, "asaas", "Gateway ativo deve salvar como asaas.");
  assertNoFullSecret(gateway.body, asaasApiKey, "Resposta PUT gateway");

  const branding = await json(baseUrl, "/api/admin/branding", {
    method: "PUT",
    headers,
    body: JSON.stringify({
      header_name: "",
      display_name: "",
      company_name: "",
      logo_url: "https://cdn.example.test/logo-persistente.png",
      favicon_url: "https://cdn.example.test/favicon-persistente.png",
      primary_color: "#22d3ee",
      secondary_color: "#05070d",
      cta_color: "#14b8a6",
      home_branding: { showName: false, brandLayout: "centered" }
    })
  });
  assert.equal(branding.response.status, 200, branding.body?.error);
  assert.equal(branding.body.logo_url, "https://cdn.example.test/logo-persistente.png", "Branding deve salvar logo.");

  await wait(900);
  assert.ok(existsSync(stateFile), "Arquivo de estado persistente deve existir antes do restart.");
  await stopServer(first);

  const second = await startServer(env);
  const restartHeaders = await login(baseUrl, env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const afterRaffles = await json(baseUrl, "/api/admin/raffles", { headers: restartHeaders });
  assert.equal(afterRaffles.response.status, 200, afterRaffles.body?.error);
  assert.ok(afterRaffles.body.some(item => item.id === created.body.id && item.title === campaignTitle), "Campanha criada deve permanecer apos restart.");
  assert.ok(afterRaffles.body.length >= initialCount + 1, "Seed/demo nao pode apagar campanha real apos restart.");

  const afterGateway = await json(baseUrl, "/api/admin/gateways", { headers: restartHeaders });
  assert.equal(afterGateway.response.status, 200, afterGateway.body?.error);
  assert.equal(afterGateway.body.active, "asaas", "Gateway ativo deve permanecer asaas apos restart.");
  assert.equal(afterGateway.body.defaultProvider, "asaas", "Default provider deve permanecer asaas apos restart.");
  assertNoFullSecret(afterGateway.body, asaasApiKey, "Resposta GET gateway");
  const asaasConfig = (afterGateway.body.configs || afterGateway.body.paymentGatewayConfigs || []).find(item => item.provider === "asaas");
  assert.ok(asaasConfig, "Config Asaas deve ser carregada apos restart.");
  assert.match(asaasConfig.credentials?.apiKey || "", /\*+cdef$/, "API Key Asaas deve voltar mascarada no admin.");

  const afterBranding = await json(baseUrl, "/api/admin/branding", { headers: restartHeaders });
  assert.equal(afterBranding.response.status, 200, afterBranding.body?.error);
  assert.equal(afterBranding.body.logo_url, "https://cdn.example.test/logo-persistente.png", "Logo deve persistir apos restart.");
  assert.equal(afterBranding.body.metadata?.homeBranding?.showName, false, "Regra logo sem nome deve persistir apos restart.");

  await stopServer(second);
  console.log("PASS: persistencia apos restart mantem campanha, Asaas/gateway ativo, branding e mascaramento de segredo.");
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}

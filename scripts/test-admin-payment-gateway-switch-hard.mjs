import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

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

const port = await findAvailablePort();
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  RIFAPRO_TEST_MODE: "hard",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  STORAGE_DRIVER: "persistent",
  PUBLIC_BASE_URL: `http://127.0.0.1:${port}`,
  ADMIN_BASE_URL: `http://127.0.0.1:${port}`,
  SUPERADMIN_EMAIL: "superadmin.gateway-switch@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "test-admin-payment-gateway-switch-jwt-secret-long-value",
  SESSION_SECRET: "test-admin-payment-gateway-switch-session-secret-long-value",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-admin-payment-gateway-switch-key"
};

const server = spawn(process.execPath, ["dist/server.js"], {
  cwd: process.cwd(),
  env,
  stdio: ["ignore", "pipe", "pipe"]
});
let serverOutput = "";
server.stdout.on("data", chunk => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", chunk => {
  serverOutput += chunk.toString();
});

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      if (response.status >= 400) return;
    } catch {}
    await wait(100);
  }
  throw new Error(`Servidor de teste nao iniciou a tempo.\n${serverOutput.slice(-2000)}`);
}

async function json(path, options = {}) {
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

async function login(email, password) {
  const { response, body } = await json("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  assert.equal(response.status, 200, `Login falhou para ${email}`);
  return body.token;
}

async function createTenantAdmin(superHeaders) {
  const tenant = await json("/api/superadmin/tenants", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({ nome: "Gateway Switch", slug: "gateway-switch", plano: "premium" })
  });
  assert.equal(tenant.response.status, 201, tenant.body?.error);

  const email = "admin.gateway-switch@test.local";
  const user = await json("/api/superadmin/users", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({
      nome: "Admin Gateway Switch",
      email,
      password: "SenhaTenant123!",
      role: "tenant_admin",
      tenant_id: tenant.body.id
    })
  });
  assert.equal(user.response.status, 201, user.body?.error);
  const token = await login(email, "SenhaTenant123!");
  return { Authorization: `Bearer ${token}` };
}

function gatewayConfig(provider) {
  const base = {
    provider,
    display_name: provider,
    enabled: true,
    environment: provider === "pay2m" ? "production" : "sandbox",
    webhook_secret: `${provider}-webhook-secret`,
    pix_key: "",
    is_default: true,
    priority: 0,
    config_json: {}
  };
  const credentials = {
    mercadopago: { accessToken: "mp-access-token", publicKey: "mp-public-key" },
    asaas: { apiKey: "asaas-api-key", userAgent: "CIFHER Prime" },
    pay2m: { clientId: "pay2m-client-id", clientSecret: "pay2m-client-secret" },
    pagbank: { token: "pagbank-token" },
    cora: { clientId: "cora-client-id", clientSecret: "cora-client-secret", certificate: "cora-cert", privateKey: "cora-private-key" },
    primepag: { clientId: "primepag-client-id", clientSecret: "primepag-client-secret", accessToken: "primepag-access-token" }
  };
  return { ...base, credentials: credentials[provider] };
}

async function saveGateway(headers, provider) {
  const config = gatewayConfig(provider);
  const response = await json("/api/admin/gateways", {
    method: "PUT",
    headers,
    body: JSON.stringify({
      active: provider,
      pix: {
        enabled: true,
        sandbox: config.environment !== "production",
        webhookUrl: `/api/webhooks/${provider}`,
        webhookSecret: config.webhook_secret
      },
      [provider]: config.credentials,
      configs: [config],
      paymentGatewayConfigs: [config]
    })
  });
  assert.equal(response.response.status, 200, response.body?.error);
  return response.body;
}

function assertGatewayState(body, provider) {
  assert.equal(body.active, provider, `active deve permanecer ${provider}`);
  assert.equal(body.defaultProvider, provider, `defaultProvider deve permanecer ${provider}`);
  const configs = body.configs || body.paymentGatewayConfigs || [];
  const selected = configs.find(config => config.provider === provider);
  assert.ok(selected, `GET deve retornar config ${provider}`);
  assert.equal(selected.enabled, true, `${provider} deve ficar enabled`);
  assert.equal(selected.is_default, true, `${provider} deve ser default`);
  const defaultConfigs = configs.filter(config => config.is_default);
  assert.equal(defaultConfigs.length, 1, "Deve existir apenas um gateway default");
  assert.equal(defaultConfigs[0].provider, provider, `Default nao pode voltar para ${defaultConfigs[0].provider}`);
}

try {
  await waitForServer();
  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const headers = await createTenantAdmin({ Authorization: `Bearer ${superToken}` });

  assertGatewayState(await saveGateway(headers, "mercadopago"), "mercadopago");

  for (const provider of ["asaas", "pay2m", "pagbank", "cora", "primepag"]) {
    assertGatewayState(await saveGateway(headers, provider), provider);
    const afterReload = await json("/api/admin/gateways", { headers });
    assert.equal(afterReload.response.status, 200, afterReload.body?.error);
    assertGatewayState(afterReload.body, provider);
  }

  console.log("PASS: troca admin de gateway PIX persiste active/defaultProvider para Asaas, Pay2M, PagBank, Cora e PrimePag.");
} finally {
  server.kill();
}

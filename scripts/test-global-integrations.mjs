import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.PORT || (3132 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  SUPERADMIN_EMAIL: "superadmin.integrations@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "test-global-integrations-jwt-secret-long-value",
  INTEGRATION_ENCRYPTION_KEY: "test-global-integrations-encryption-key-32"
};

const server = spawn(process.execPath, ["dist/server.js"], {
  cwd: process.cwd(),
  env,
  stdio: ["ignore", "pipe", "pipe"]
});

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      if (response.status >= 400) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Servidor de teste nao iniciou a tempo.");
}

async function json(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
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

async function createTenantAdmin(superHeaders, tenantId, email) {
  const { response } = await json("/api/superadmin/users", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({ nome: `Admin ${tenantId}`, email, password: "SenhaTenant123!", role: "tenant_admin", tenant_id: tenantId })
  });
  assert.equal(response.status, 201);
  return login(email, "SenhaTenant123!");
}

async function createIntegration(headers, payload) {
  const { response, body } = await json("/api/admin/integrations/global", {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  assert.equal(response.status, 201, body?.error || "Integracao deveria ser criada");
  return body;
}

async function createRaffle(headers, title) {
  const { response, body } = await json("/api/admin/raffles", {
    method: "POST",
    headers,
    body: JSON.stringify({ title, description: title, price: 2, totalTickets: 100, drawDate: "2026-12-31T20:00:00Z", image: "", status: "active" })
  });
  assert.equal(response.status, 200);
  return body;
}

async function buy(host, raffleId) {
  const { response, body } = await json(`/api/raffles/${raffleId}/buy`, {
    method: "POST",
    headers: { "x-forwarded-host": host },
    body: JSON.stringify({ tickets: 2, contact: "11977770000", customer: { name: "Comprador Integracao", phone: "11977770000", cpf: "77777777777", accessPassword: "123456" } })
  });
  assert.equal(response.status, 200, body?.error || "Compra deveria ser criada");
  return body;
}

try {
  await waitForServer();
  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const superHeaders = { Authorization: `Bearer ${superToken}` };
  const tokenA = await createTenantAdmin(superHeaders, "tenant-cliente-a", "admin.integracao-a@test.local");
  const tokenB = await createTenantAdmin(superHeaders, "tenant-cliente-b", "admin.integracao-b@test.local");
  const headersA = { Authorization: `Bearer ${tokenA}` };
  const headersB = { Authorization: `Bearer ${tokenB}` };

  const primepagA = await createIntegration(headersA, {
    provider: "primepag",
    status: "active",
    credentials: { clientId: "cliente-a-id", clientSecret: "cliente-a-secret" },
    settings: { mock: true, failOnce: true }
  });
  const paggueB = await createIntegration(headersB, {
    provider: "paggue",
    status: "active",
    credentials: { clientKey: "cliente-b-key", clientSecret: "cliente-b-secret" },
    settings: { mock: true }
  });

  assert.notEqual(primepagA.credentials.clientSecret, "cliente-a-secret", "Secret cliente-a deve voltar mascarado");
  assert.notEqual(paggueB.credentials.clientSecret, "cliente-b-secret", "Secret cliente-b deve voltar mascarado");

  const aCannotReadB = await json(`/api/admin/integrations/global/${paggueB.id}/test`, { method: "POST", headers: headersA });
  assert.equal(aCannotReadB.response.status, 404, "Tenant A nao acessa integracao do tenant B");

  const invalid = await json("/api/admin/integrations/global", {
    method: "POST",
    headers: headersA,
    body: JSON.stringify({ provider: "primepag", status: "active", credentials: {}, settings: { mock: true } })
  });
  assert.equal(invalid.response.status, 201, "Integracao invalida deve ser registrada para auditoria");
  assert.equal(invalid.body.status, "error", "Credenciais invalidas devem marcar status error");
  assert.match(invalid.body.last_error, /Credenciais ausentes/);

  const retryResult = await json(`/api/admin/integrations/global/${primepagA.id}/action/createPixCharge`, {
    method: "POST",
    headers: headersA,
    body: JSON.stringify({ purchaseId: "retry-1", amount: 10 })
  });
  assert.equal(retryResult.response.status, 201, "Retry deve recuperar falha temporaria simulada");
  assert.equal(retryResult.body.success, true);

  const disabled = await createIntegration(headersA, {
    provider: "smtp",
    status: "inactive",
    credentials: { host: "smtp.local", port: 587, username: "user", password: "pass", from: "noreply@test.local" },
    settings: { mock: true }
  });
  const disabledAction = await json(`/api/admin/integrations/global/${disabled.id}/action/sendEmail`, {
    method: "POST",
    headers: headersA,
    body: JSON.stringify({ to: "x@test.local", subject: "Teste" })
  });
  assert.equal(disabledAction.response.status, 409, "Integracao desativada nao executa");

  const endpointA = await json("/api/admin/integrations/global/webhook-endpoints", {
    method: "POST",
    headers: headersA,
    body: JSON.stringify({ provider: "primepag", secret: "secret-a" })
  });
  assert.equal(endpointA.response.status, 201);
  const wrongTenantWebhook = await json(`/api/integrations/webhooks/primepag/${endpointA.body.id}`, {
    method: "POST",
    headers: { "x-forwarded-host": "cliente-b.meudominio.com", "x-webhook-secret": "secret-a" },
    body: JSON.stringify({ event_type: "pix.paid" })
  });
  assert.equal(wrongTenantWebhook.response.status, 404, "Webhook do tenant errado deve ser recusado");

  await createIntegration(headersA, {
    provider: "metaAds",
    status: "active",
    credentials: { pixelId: "pixel-a", accessToken: "meta-token-a" },
    settings: { mock: true }
  });
  await createIntegration(headersA, {
    provider: "googleAds",
    status: "active",
    credentials: { customerId: "123", conversionActionId: "456", developerToken: "dev", clientId: "cid", clientSecret: "secret", refreshToken: "refresh" },
    settings: { mock: true }
  });

  const raffleA = await createRaffle(headersA, "Rifa Conversao Integracao A");
  const purchaseA = await buy("cliente-a.meudominio.com", raffleA.id);
  const confirmed = await json(`/api/admin/orders/${purchaseA.purchaseId}/manual-confirm-payment`, { method: "POST", headers: headersA, body: JSON.stringify({ reason: "Teste de integracao global" }) });
  assert.equal(confirmed.response.status, 200);
  await new Promise(resolve => setTimeout(resolve, 250));

  const logsA = await json("/api/admin/integrations/global/logs", { headers: headersA });
  assert.ok(logsA.body.some(log => log.provider === "primepag" && log.action === "createPixCharge" && log.success), "Log PrimePag deve existir");
  assert.ok(logsA.body.some(log => log.provider === "metaAds" && log.action === "sendConversionEvent" && log.success), "Purchase deve enviar conversao Meta");
  assert.ok(logsA.body.some(log => log.provider === "googleAds" && log.action === "sendConversionEvent" && log.success), "Purchase deve enviar conversao Google");
  assert.equal(logsA.body.some(log => JSON.stringify(log.request_payload).includes("secret-a-secret")), false, "Logs nao devem expor secrets");

  const listB = await json("/api/admin/integrations/global", { headers: headersB });
  assert.equal(listB.body.integrations.some(item => item.id === primepagA.id), false, "Tenant B nao lista integracoes do tenant A");

  const global = await json("/api/superadmin/integrations", { headers: superHeaders });
  assert.equal(global.response.status, 200, "Superadmin deve monitorar integracoes globais");
  assert.ok(global.body.integrations.length >= 5);

  console.log("PASS: API global de integracoes multitenant com credenciais mascaradas, logs, retry, webhook isolado e conversoes.");
} finally {
  server.kill();
}

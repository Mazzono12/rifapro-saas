import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.PORT || (3133 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  SUPERADMIN_EMAIL: "superadmin.hardening@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "test-production-hardening-jwt-secret-long-value",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-production-hardening-gateway-credentials-key",
  INTEGRATION_ENCRYPTION_KEY: "test-production-hardening-encryption-key"
};

const server = spawn(process.execPath, ["dist/server.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });

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
  const { response, body } = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
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

async function createRaffle(headers, title) {
  return json("/api/admin/raffles", {
    method: "POST",
    headers,
    body: JSON.stringify({ title, description: title, price: 2, totalTickets: 100, drawDate: "2026-12-31T20:00:00Z", image: "", status: "active" })
  });
}

try {
  await waitForServer();
  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const superHeaders = { Authorization: `Bearer ${superToken}` };

  const plans = await json("/api/superadmin/plans", { headers: superHeaders });
  assert.equal(plans.response.status, 200, "Superadmin deve listar planos.");
  assert.ok(plans.body.some(plan => plan.id === "gratis"));
  assert.ok(plans.body.some(plan => plan.id === "white-label"));

  const tenantRes = await json("/api/superadmin/tenants", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({ nome: "Cliente Gratis", slug: "cliente-gratis", plano: "gratis" })
  });
  assert.equal(tenantRes.response.status, 201);
  assert.equal(tenantRes.body.plano, "gratis");
  assert.equal(tenantRes.body.percentual_plataforma, 12);

  const tokenGratis = await createTenantAdmin(superHeaders, tenantRes.body.id, "admin.gratis@test.local");
  const headersGratis = { Authorization: `Bearer ${tokenGratis}` };

  const firstRaffle = await createRaffle(headersGratis, "Primeira rifa gratis");
  assert.equal(firstRaffle.response.status, 200, firstRaffle.body?.error);
  const secondRaffle = await createRaffle(headersGratis, "Segunda rifa bloqueada");
  assert.equal(secondRaffle.response.status, 403, "Plano gratis deve bloquear segunda rifa.");

  const blockedIntegration = await json("/api/admin/integrations/global", {
    method: "POST",
    headers: headersGratis,
    body: JSON.stringify({
      provider: "primepag",
      status: "active",
      credentials: { clientId: "x", clientSecret: "y" },
      settings: { mock: true }
    })
  });
  assert.equal(blockedIntegration.response.status, 403, "Plano gratis nao deve liberar PrimePag.");

  const tokenA = await createTenantAdmin(superHeaders, "tenant-cliente-a", "admin.hardening-a@test.local");
  const headersA = { Authorization: `Bearer ${tokenA}` };
  await json("/api/admin/gateways", {
    method: "PUT",
    headers: headersA,
    body: JSON.stringify({ pix: { apiKey: "pix-key-a", webhookSecret: "secret-a", webhookUrl: "/api/webhooks/payment/mercadopago" } })
  });
  const raffleA = await createRaffle(headersA, "Fila Webhook A");
  assert.equal(raffleA.response.status, 200);
  const purchaseA = await json(`/api/raffles/${raffleA.body.id}/buy`, {
    method: "POST",
    headers: { "x-forwarded-host": "cliente-a.meudominio.com" },
    body: JSON.stringify({ tickets: 1, contact: "11955551111", customer: { name: "Fila Teste", phone: "11955551111", cpf: "55555511111", accessPassword: "123456" } })
  });
  assert.equal(purchaseA.response.status, 200);
  const ignoredWebhook = await json("/api/webhooks/payment/mercadopago", {
    method: "POST",
    headers: { "x-forwarded-host": "cliente-a.meudominio.com", "x-webhook-secret": "secret-a" },
    body: JSON.stringify({ status: "pending", external_reference: purchaseA.body.purchaseId })
  });
  assert.equal(ignoredWebhook.response.status, 202, "Webhook nao pago deve entrar na fila e ser ignorado.");

  const queueA = await json("/api/admin/payments/queue", { headers: headersA });
  assert.ok(queueA.body.some(job => job.purchaseId === purchaseA.body.purchaseId && job.status === "cancelled"), "Fila de pagamento deve registrar webhook nao pago.");

  const auditA = await json("/api/admin/audit/security", { headers: headersA });
  assert.ok(auditA.body.some(log => log.action === "RAFFLE_CREATED"), "Auditoria deve registrar criacao de rifa.");
  assert.ok(auditA.body.some(log => log.action === "PIX_GATEWAY_CHANGED"), "Auditoria deve registrar mudanca de gateway PIX.");

  const overview = await json("/api/superadmin/overview", { headers: superHeaders });
  assert.equal(overview.response.status, 200);
  assert.ok("webhookErrors" in overview.body.metrics);
  assert.ok(Array.isArray(overview.body.ranking), "Overview deve incluir ranking de tenants.");
  assert.ok(Array.isArray(overview.body.plans), "Overview deve incluir planos.");

  console.log("PASS: hardening de planos, auditoria, fila de pagamentos e dashboard superadmin validado.");
} finally {
  server.kill();
}

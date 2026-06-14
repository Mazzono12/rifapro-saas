import assert from "node:assert/strict";
import { createServer } from "node:net";
import { spawn } from "node:child_process";

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
  STORAGE_DRIVER: "persistent",
  PUBLIC_BASE_URL: `http://127.0.0.1:${port}`,
  ADMIN_BASE_URL: `http://127.0.0.1:${port}/admin`,
  SESSION_SECRET: "prodreadiness-session-alpha-bravo-charlie-2026",
  SUPABASE_URL: "https://test.supabase.local",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "hardening-service-role-key-long-value-2026",
  SUPABASE_SERVICE_KEY: "",
  SUPERADMIN_EMAIL: "superadmin.hardening@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "prodreadiness-jwt-alpha-bravo-charlie-2026",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "hardening-gateway-credentials-key-2026",
  INTEGRATION_ENCRYPTION_KEY: "hardening-integration-encryption-key-2026"
};

let serverOutput = "";
const server = spawn(process.execPath, ["dist/server.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
server.stdout.on("data", chunk => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", chunk => {
  serverOutput += chunk.toString();
});

async function waitForServer() {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/public/health`);
      if (response.status === 200) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor de teste nao iniciou a tempo.\n${serverOutput.slice(-4000)}`);
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
  assert.deepEqual(plans.body.map(plan => plan.nome), ["Básico", "Profissional", "Premium", "Empresa", "White Label"]);
  assert.ok(!plans.body.some(plan => ["gratis", "basico", "profissional"].includes(plan.id)));
  assert.ok(plans.body.some(plan => plan.id === "white-label"));

  const tenantRes = await json("/api/superadmin/tenants", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({
      nome: "Cliente Basico",
      slug: "cliente-basico",
      plano: "gratis",
      admin: { nome: "Admin Basico Inicial", email: "admin.basico.initial@test.local", password: "SenhaTenant123!" }
    })
  });
  assert.equal(tenantRes.response.status, 201);
  assert.equal(tenantRes.body.plano, "starter");
  assert.equal(tenantRes.body.plan.nome, "Básico");
  assert.equal(tenantRes.body.percentual_plataforma, 12);

  const tokenBasico = await createTenantAdmin(superHeaders, tenantRes.body.id, "admin.basico@test.local");
  const headersBasico = { Authorization: `Bearer ${tokenBasico}` };

  const firstRaffle = await createRaffle(headersBasico, "Primeira rifa basica");
  assert.equal(firstRaffle.response.status, 200, firstRaffle.body?.error);
  const secondRaffle = await createRaffle(headersBasico, "Segunda rifa bloqueada");
  assert.equal(secondRaffle.response.status, 403, "Plano Básico deve bloquear segunda rifa.");

  const blockedIntegration = await json("/api/admin/integrations/global", {
    method: "POST",
    headers: headersBasico,
    body: JSON.stringify({
      provider: "primepag",
      status: "active",
      credentials: { clientId: "x", clientSecret: "y" },
      settings: { mock: true }
    })
  });
  assert.equal(blockedIntegration.response.status, 403, "Plano Básico nao deve liberar PrimePag.");

  const tokenA = await createTenantAdmin(superHeaders, "tenant-cliente-a", "admin.hardening-a@test.local");
  const headersA = { Authorization: `Bearer ${tokenA}` };
  await json("/api/admin/gateways", {
    method: "PUT",
    headers: headersA,
    body: JSON.stringify({
      pix: { apiKey: "pix-key-a", sandbox: true, webhookSecret: "secret-a", webhookUrl: "/api/webhooks/payment/mercadopago" },
      mercadopago: { environment: "sandbox" }
    })
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

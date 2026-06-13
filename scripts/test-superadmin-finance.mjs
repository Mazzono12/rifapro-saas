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
const env = { ...process.env, PORT: String(port), NODE_ENV: "production", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", SUPERADMIN_EMAIL: "superadmin.finance@test.local", SUPERADMIN_PASSWORD: "SenhaSuper123!", JWT_SECRET: "test-superadmin-finance-secret", GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-superadmin-finance-gateway-key" };
const server = spawn(process.execPath, ["dist/server.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });

async function wait() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${baseUrl}/api/public/health`); if (r.status === 200) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Servidor nao iniciou");
}
async function json(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  return { response: res, body: await res.json().catch(() => ({})) };
}
async function login(email, password) {
  const { response, body } = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  assert.equal(response.status, 200);
  return body.token;
}
async function createTenantAdmin(superHeaders, tenantId) {
  const email = `admin.finance.${tenantId}@test.local`;
  const { response } = await json("/api/superadmin/users", { method: "POST", headers: superHeaders, body: JSON.stringify({ nome: "Admin Finance", email, password: "SenhaTenant123!", role: "tenant_admin", tenant_id: tenantId }) });
  assert.equal(response.status, 201);
  return login(email, "SenhaTenant123!");
}
async function createPaidOrder(headers, host) {
  await json("/api/admin/gateways", {
    method: "PUT",
    headers,
    body: JSON.stringify({
      pix: { apiKey: "key", sandbox: true, webhookSecret: "secret", webhookUrl: "/api/webhooks/payment/mercadopago" },
      mercadopago: { environment: "sandbox" }
    })
  });
  const raffle = await json("/api/admin/raffles", { method: "POST", headers, body: JSON.stringify({ title: `Finance ${host}`, price: 5, totalTickets: 100, drawDate: "2026-12-31T20:00:00Z", status: "active" }) });
  assert.equal(raffle.response.status, 200);
  const buy = await json(`/api/raffles/${raffle.body.id}/buy`, { method: "POST", headers: { "x-forwarded-host": host }, body: JSON.stringify({ tickets: 2, contact: "11911110000", customer: { name: "Cliente Finance", phone: "11911110000", cpf: "11111111111", accessPassword: "123456" } }) });
  assert.equal(buy.response.status, 200, `compra falhou: ${JSON.stringify(buy.body)}`);
  const paid = await json("/api/webhooks/payment/mercadopago", { method: "POST", headers: { "x-forwarded-host": host, "x-webhook-secret": "secret" }, body: JSON.stringify({ status: "approved", external_reference: buy.body.purchaseId }) });
  assert.equal(paid.response.status, 200);
}

try {
  await wait();
  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const superHeaders = { Authorization: `Bearer ${superToken}` };
  const tokenA = await createTenantAdmin(superHeaders, "tenant-cliente-a");
  await createPaidOrder({ Authorization: `Bearer ${tokenA}` }, "cliente-a.meudominio.com");
  const overview = await json("/api/superadmin/overview", { headers: superHeaders });
  assert.equal(overview.response.status, 200);
  assert.ok(overview.body.metrics.paidRevenue >= 10, "superadmin ve faturamento global");
  assert.ok("revenueToday" in overview.body.metrics, "metricas financeiras avancadas existem");
  const report = await json("/api/superadmin/reports/revenue?gateway=mercadopago", { headers: superHeaders });
  assert.equal(report.response.status, 200);
  assert.ok(report.body.rows.every(row => row.gateway === "mercadopago"), "filtro por gateway funciona");
  const tenantToken = tokenA;
  const forbidden = await json("/api/superadmin/overview", { headers: { Authorization: `Bearer ${tenantToken}` } });
  assert.equal(forbidden.response.status, 403, "tenant admin nao ve faturamento global");
  console.log("PASS: superadmin finance global, filtros e bloqueio para tenant admin validados.");
} finally {
  server.kill();
}

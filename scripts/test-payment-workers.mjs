import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.PORT || (3135 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  SUPERADMIN_EMAIL: "superadmin.payment-workers@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "test-payment-workers-jwt-secret-long-value",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-payment-workers-gateway-credentials-key"
};

const server = spawn(process.execPath, ["dist/server.js"], {
  cwd: process.cwd(),
  env,
  stdio: ["ignore", "pipe", "pipe"]
});

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      if (response.status >= 400) return;
    } catch {
      // Server is still starting.
    }
    await wait(100);
  }
  throw new Error("Servidor de teste nao iniciou a tempo.");
}

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
}

async function json(path, options = {}) {
  const response = await request(path, options);
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
    body: JSON.stringify({
      nome: `Admin ${tenantId}`,
      email,
      password: "SenhaTenant123!",
      role: "tenant_admin",
      tenant_id: tenantId
    })
  });
  assert.equal(response.status, 201, `Superadmin deve criar admin para ${tenantId}.`);
  return login(email, "SenhaTenant123!");
}

async function createRaffle(headers, title) {
  const { response, body } = await json("/api/admin/raffles", {
    method: "POST",
    headers,
    body: JSON.stringify({
      title,
      description: `${title} descricao`,
      price: 2,
      totalTickets: 100,
      drawDate: "2026-12-31T20:00:00Z",
      image: "",
      status: "active"
    })
  });
  assert.equal(response.status, 200, `Tenant admin deve criar rifa ${title}.`);
  return body;
}

async function buy(host, raffleId, suffix) {
  const { response, body } = await json(`/api/raffles/${raffleId}/buy`, {
    method: "POST",
    headers: { "x-forwarded-host": host },
    body: JSON.stringify({
      tickets: 2,
      contact: `11955${suffix}`,
      tenant_id: "tenant-forjado",
      customer: {
        name: `Comprador ${suffix}`,
        phone: `11955${suffix}`,
        cpf: `55555${suffix}`,
        accessPassword: "123456"
      }
    })
  });
  assert.equal(response.status, 200, `Compra PIX deve ser criada em ${host}.`);
  return body;
}

async function webhook(host, secret, body) {
  return json("/api/webhooks/payment/mercadopago", {
    method: "POST",
    headers: {
      "x-forwarded-host": host,
      "x-webhook-secret": secret
    },
    body: JSON.stringify(body)
  });
}

async function adminPurchases(headers) {
  const { response, body } = await json("/api/admin/purchases", { headers });
  assert.equal(response.status, 200);
  return body;
}

async function adminQueue(headers) {
  const { response, body } = await json("/api/admin/payments/queue", { headers });
  assert.equal(response.status, 200);
  return body;
}

try {
  await waitForServer();

  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const superHeaders = { Authorization: `Bearer ${superToken}` };
  const tokenA = await createTenantAdmin(superHeaders, "tenant-cliente-a", "admin.payment-worker-a@test.local");
  const tokenB = await createTenantAdmin(superHeaders, "tenant-cliente-b", "admin.payment-worker-b@test.local");
  const headersA = { Authorization: `Bearer ${tokenA}` };
  const headersB = { Authorization: `Bearer ${tokenB}` };

  await json("/api/admin/gateways", {
    method: "PUT",
    headers: headersA,
    body: JSON.stringify({ pix: { webhookSecret: "secret-a", webhookUrl: "/api/webhooks/payment/mercadopago" } })
  });
  await json("/api/admin/gateways", {
    method: "PUT",
    headers: headersB,
    body: JSON.stringify({ pix: { webhookSecret: "secret-b", webhookUrl: "/api/webhooks/payment/mercadopago" } })
  });

  const raffleA = await createRaffle(headersA, "Fila PIX Cliente A");
  const raffleB = await createRaffle(headersB, "Fila PIX Cliente B");
  const pendingFirst = await buy("cliente-a.meudominio.com", raffleA.id, "000001");
  const paidOnce = await buy("cliente-a.meudominio.com", raffleA.id, "000002");
  const retryPurchase = await buy("cliente-a.meudominio.com", raffleA.id, "000003");
  const wrongTenantPurchase = await buy("cliente-a.meudominio.com", raffleA.id, "000004");
  await buy("cliente-b.meudominio.com", raffleB.id, "000005");

  const outOfOrder = await webhook("cliente-a.meudominio.com", "secret-a", {
    eventId: "evt-out-of-order-pending",
    status: "pending",
    external_reference: pendingFirst.purchaseId
  });
  assert.equal(outOfOrder.response.status, 202, "Webhook fora de ordem/pending deve ser ignorado sem pagar.");
  let purchasesA = await adminPurchases(headersA);
  assert.equal(purchasesA.find(item => item.purchaseId === pendingFirst.purchaseId)?.status, "pending");

  const paidAfterPending = await webhook("cliente-a.meudominio.com", "secret-a", {
    eventId: "evt-out-of-order-paid",
    status: "approved",
    external_reference: pendingFirst.purchaseId
  });
  assert.equal(paidAfterPending.response.status, 200, "Webhook pago posterior deve confirmar a compra.");

  const invalid = await webhook("cliente-a.meudominio.com", "secret-a", {
    eventId: "evt-invalid-no-reference",
    status: "approved"
  });
  assert.equal(invalid.response.status, 400, "Webhook invalido sem referencia deve falhar.");

  const paid = await webhook("cliente-a.meudominio.com", "secret-a", {
    eventId: "evt-paid-once",
    status: "approved",
    external_reference: paidOnce.purchaseId
  });
  assert.equal(paid.response.status, 200, "Webhook pago deve processar uma vez.");
  const duplicate = await webhook("cliente-a.meudominio.com", "secret-a", {
    eventId: "evt-paid-once",
    status: "approved",
    external_reference: paidOnce.purchaseId
  });
  assert.equal(duplicate.response.status, 200, "Webhook duplicado deve ser idempotente.");
  assert.equal(duplicate.body.duplicate, true, "Webhook duplicado deve sinalizar idempotencia.");

  purchasesA = await adminPurchases(headersA);
  const paidPurchase = purchasesA.find(item => item.purchaseId === paidOnce.purchaseId);
  assert.equal(paidPurchase.status, "paid");
  assert.equal(paidPurchase.numeros.length, 2, "Compra paga uma vez nao deve receber numeros duplicados.");

  const wrongTenant = await webhook("cliente-b.meudominio.com", "secret-b", {
    eventId: "evt-wrong-tenant",
    status: "approved",
    external_reference: wrongTenantPurchase.purchaseId
  });
  assert.equal(wrongTenant.response.status, 404, "Tenant errado nao pode confirmar compra de outro tenant.");

  const failedOnce = await webhook("cliente-a.meudominio.com", "secret-a", {
    eventId: "evt-retry-once",
    status: "approved",
    external_reference: retryPurchase.purchaseId,
    simulateFailure: "once"
  });
  assert.equal(failedOnce.response.status, 503, "Falha temporaria deve retornar retry.");

  const queueBeforeRetry = await adminQueue(headersA);
  const retryJobBefore = queueBeforeRetry.find(job => job.purchaseId === retryPurchase.purchaseId);
  assert.equal(retryJobBefore?.status, "pending", "Job com falha temporaria deve voltar para pending.");
  assert.equal(retryJobBefore?.attempts, 1, "Job com falha temporaria deve registrar tentativa.");

  const retryRun = await json("/api/admin/payments/queue/process", {
    method: "POST",
    headers: headersA,
    body: JSON.stringify({ limit: 10 })
  });
  assert.equal(retryRun.response.status, 200, "Worker manual deve processar jobs pendentes.");
  assert.ok(retryRun.body.processed >= 1, "Worker deve processar ao menos o job de retry.");

  purchasesA = await adminPurchases(headersA);
  assert.equal(purchasesA.find(item => item.purchaseId === retryPurchase.purchaseId)?.status, "paid", "Retry deve confirmar PIX pendente.");

  const logsA = await json("/api/admin/payments/webhooks", { headers: headersA });
  assert.ok(logsA.body.some(log => log.status === "ignored" && log.purchaseId === pendingFirst.purchaseId), "Log de webhook fora de ordem deve existir.");
  assert.ok(logsA.body.some(log => log.status === "invalid"), "Log de webhook invalido deve existir.");
  assert.ok(logsA.body.some(log => log.status === "duplicate" && log.purchaseId === paidOnce.purchaseId), "Log de webhook duplicado deve existir.");
  assert.ok(logsA.body.some(log => log.status === "failed" && log.purchaseId === retryPurchase.purchaseId), "Log de falha para retry deve existir.");
  assert.ok(logsA.body.some(log => log.status === "confirmed" && log.purchaseId === retryPurchase.purchaseId), "Log de retry confirmado deve existir.");

  const purchasesB = await adminPurchases(headersB);
  assert.equal(purchasesB.some(item => item.purchaseId === wrongTenantPurchase.purchaseId), false, "Cliente B nao ve compra do cliente A.");

  console.log("PASS: workers PIX/webhook com fila, idempotencia, retry, logs e isolamento multitenant.");
} finally {
  server.kill();
}

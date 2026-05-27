import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.TEST_PIX_PORT || process.env.PORT || (3129 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  SUPERADMIN_EMAIL: "superadmin.pix@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "test-pix-multitenant-jwt-secret-long-value",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-pix-multitenant-gateway-credentials-key"
};

const server = spawn(process.execPath, ["dist/server.js"], {
  cwd: process.cwd(),
  env,
  stdio: ["ignore", "pipe", "pipe"]
});

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      if (response.status >= 400) return;
    } catch {
      // Server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
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

async function buy(host, raffleId, phone, name, cpf) {
  const { response, body } = await json(`/api/raffles/${raffleId}/buy`, {
    method: "POST",
    headers: { "x-forwarded-host": host },
    body: JSON.stringify({
      tickets: 2,
      contact: phone,
      tenant_id: "tentativa-forjada",
      customer: { name, phone, cpf, accessPassword: "123456" }
    })
  });
  assert.equal(response.status, 200, `Compra PIX deve ser criada em ${host}.`);
  return body;
}

async function webhook(host, secret, purchaseId) {
  return json("/api/webhooks/payment/mercadopago", {
    method: "POST",
    headers: {
      "x-forwarded-host": host,
      "x-webhook-secret": secret
    },
    body: JSON.stringify({
      status: "approved",
      external_reference: purchaseId
    })
  });
}

try {
  await waitForServer();

  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const superHeaders = { Authorization: `Bearer ${superToken}` };
  const tokenA = await createTenantAdmin(superHeaders, "tenant-cliente-a", "admin.pix-a@test.local");
  const tokenB = await createTenantAdmin(superHeaders, "tenant-cliente-b", "admin.pix-b@test.local");
  const headersA = { Authorization: `Bearer ${tokenA}` };
  const headersB = { Authorization: `Bearer ${tokenB}` };

  await json("/api/admin/gateways", {
    method: "PUT",
    headers: headersA,
    body: JSON.stringify({ pix: { apiKey: "pix-a-key", webhookSecret: "secret-a", webhookUrl: "/api/webhooks/payment/mercadopago" } })
  });
  await json("/api/admin/gateways", {
    method: "PUT",
    headers: headersB,
    body: JSON.stringify({ pix: { apiKey: "pix-b-key", webhookSecret: "secret-b", webhookUrl: "/api/webhooks/payment/mercadopago" } })
  });

  const gatewaysA = await json("/api/admin/gateways", { headers: headersA });
  const gatewaysB = await json("/api/admin/gateways", { headers: headersB });
  assert.notEqual(gatewaysA.body.pix.apiKey, "pix-a-key", "PIX cliente-a nao deve expor API key em claro.");
  assert.notEqual(gatewaysB.body.pix.apiKey, "pix-b-key", "PIX cliente-b nao deve expor API key em claro.");
  assert.match(gatewaysA.body.pix.apiKey, /\*+.*key$/, "PIX cliente-a deve voltar mascarado.");
  assert.match(gatewaysB.body.pix.apiKey, /\*+.*key$/, "PIX cliente-b deve voltar mascarado.");

  const raffleA = await createRaffle(headersA, "PIX Cliente A");
  const raffleB = await createRaffle(headersB, "PIX Cliente B");
  const purchaseA = await buy("cliente-a.meudominio.com", raffleA.id, "11933333333", "Pagador Cliente A", "33333333333");
  const purchaseB = await buy("cliente-b.meudominio.com", raffleB.id, "11944444444", "Pagador Cliente B", "44444444444");

  const paidA = await webhook("cliente-a.meudominio.com", "secret-a", purchaseA.purchaseId);
  assert.equal(paidA.response.status, 200, "Webhook cliente-a deve confirmar compra cliente-a.");
  assert.equal(paidA.body.success, true);

  const duplicateA = await webhook("cliente-a.meudominio.com", "secret-a", purchaseA.purchaseId);
  assert.equal(duplicateA.response.status, 200, "Webhook duplicado deve ser idempotente.");
  assert.equal(duplicateA.body.duplicate, true);

  const invalidB = await webhook("cliente-b.meudominio.com", "secret-errado", purchaseB.purchaseId);
  assert.equal(invalidB.response.status, 401, "Webhook com assinatura invalida deve falhar.");

  const wrongTenant = await webhook("cliente-b.meudominio.com", "secret-b", purchaseA.purchaseId);
  assert.equal(wrongTenant.response.status, 404, "Compra do cliente-a nao pode ser confirmada no cliente-b.");

  const paidB = await webhook("cliente-b.meudominio.com", "secret-b", purchaseB.purchaseId);
  assert.equal(paidB.response.status, 200, "Webhook cliente-b deve confirmar compra cliente-b.");

  const purchasesA = await json("/api/admin/purchases", { headers: headersA });
  const purchasesB = await json("/api/admin/purchases", { headers: headersB });
  const paidPurchaseA = purchasesA.body.find(item => item.purchaseId === purchaseA.purchaseId);
  assert.equal(paidPurchaseA?.status, "paid");
  assert.equal(purchasesB.body.find(item => item.purchaseId === purchaseB.purchaseId)?.status, "paid");
  assert.equal(purchasesB.body.some(item => item.purchaseId === purchaseA.purchaseId), false, "cliente-b nao lista compra cliente-a.");

  const drawA = await json(`/api/admin/raffles/${raffleA.id}/draw`, {
    method: "POST",
    headers: headersA,
    body: JSON.stringify({ number: paidPurchaseA.numeros[0] })
  });
  assert.equal(drawA.response.status, 200, "Sorteio cliente-a deve consultar cota paga.");
  assert.equal(drawA.body.status, "winner", "Sorteio deve localizar ganhador pago do tenant correto.");

  const crossDraw = await json(`/api/admin/raffles/${raffleA.id}/draw`, {
    method: "POST",
    headers: headersB,
    body: JSON.stringify({ number: paidPurchaseA.numeros[0] })
  });
  assert.equal(crossDraw.response.status, 400, "cliente-b nao pode sortear rifa do cliente-a.");

  const commissions = await json("/api/superadmin/commissions", { headers: superHeaders });
  const commissionA = commissions.body.byTenant.find(item => item.tenant_id === "tenant-cliente-a");
  const commissionB = commissions.body.byTenant.find(item => item.tenant_id === "tenant-cliente-b");
  assert.equal(commissionA.paidRevenue, 4, "Receita paga cliente-a deve ser por tenant.");
  assert.equal(commissionB.paidRevenue, 4, "Receita paga cliente-b deve ser por tenant.");
  assert.equal(commissionA.platformCommission, 0.4, "Comissao plataforma cliente-a deve usar percentual do tenant.");
  assert.equal(commissionB.platformCommission, 0.4, "Comissao plataforma cliente-b deve usar percentual do tenant.");

  const logsA = await json("/api/admin/payments/webhooks", { headers: headersA });
  const logsB = await json("/api/admin/payments/webhooks", { headers: headersB });
  assert.ok(logsA.body.some(log => log.purchaseId === purchaseA.purchaseId && log.status === "confirmed"), "Log webhook confirmado cliente-a deve existir.");
  assert.ok(logsA.body.some(log => log.purchaseId === purchaseA.purchaseId && log.status === "duplicate"), "Log webhook duplicado cliente-a deve existir.");
  assert.ok(logsB.body.some(log => log.status === "invalid"), "Log webhook invalido cliente-b deve existir.");
  assert.ok(logsB.body.some(log => log.purchaseId === purchaseB.purchaseId && log.status === "confirmed"), "Log webhook confirmado cliente-b deve existir.");

  console.log("PASS: PIX e webhooks multitenant isolados, idempotentes, com logs e comissao por tenant.");
} finally {
  server.kill();
}

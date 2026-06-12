import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.PORT || (3835 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  SUPERADMIN_EMAIL: "superadmin.pix-safety@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "test-pix-safety-jwt-secret-long-value",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-pix-safety-gateway-key"
};

const server = spawn(process.execPath, ["dist/server.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
let serverOutput = "";
server.stdout.on("data", chunk => { serverOutput += chunk.toString(); });
server.stderr.on("data", chunk => { serverOutput += chunk.toString(); });

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function json(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      if (response.status > 0) return;
    } catch {
      await wait(100);
    }
  }
  throw new Error("Servidor de seguranca PIX nao iniciou.");
}

async function login(email, password) {
  const { response, body } = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  assert.equal(response.status, 200);
  return body.token;
}

async function createTenantAdmin(superHeaders, tenantId, email) {
  const created = await json("/api/superadmin/users", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({ nome: email, email, password: "SenhaTenant123!", role: "tenant_admin", tenant_id: tenantId })
  });
  assert.equal(created.response.status, 201);
  return login(email, "SenhaTenant123!");
}

async function createRaffle(headers, title) {
  const { response, body } = await json("/api/admin/raffles", {
    method: "POST",
    headers,
    body: JSON.stringify({
      title,
      description: title,
      price: 2,
      totalTickets: 100,
      drawDate: "2026-12-31T20:00:00Z",
      image: "",
      status: "active",
      pixConfig: {
        inheritGlobal: false,
        enabled: true,
        gateway: "mock",
        sandbox: true
      }
    })
  });
  assert.equal(response.status, 200);
  return body;
}

async function buy(host, raffleId, suffix, refCode = "") {
  const { response, body } = await json(`/api/raffles/${raffleId}/buy`, {
    method: "POST",
    headers: { "x-forwarded-host": host },
    body: JSON.stringify({
      tickets: 2,
      contact: `11977${suffix}`,
      refCode,
      customer: { name: `Cliente ${suffix}`, phone: `11977${suffix}`, cpf: `777777${suffix}`, accessPassword: "123456" }
    })
  });
  assert.equal(response.status, 200);
  return body;
}

try {
  await waitForServer();
  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const superHeaders = { Authorization: `Bearer ${superToken}` };
  const tokenA = await createTenantAdmin(superHeaders, "tenant-cliente-a", "admin.pix-safety-a@test.local");
  const tokenB = await createTenantAdmin(superHeaders, "tenant-cliente-b", "admin.pix-safety-b@test.local");
  const headersA = { Authorization: `Bearer ${tokenA}` };
  const headersB = { Authorization: `Bearer ${tokenB}` };

  await json("/api/admin/gateways", { method: "PUT", headers: headersA, body: JSON.stringify({ pix: { apiKey: "pix-a-key", webhookSecret: "secret-a", webhookUrl: "/api/webhooks/payment/mercadopago" } }) });
  await json("/api/admin/whatsapp/config", { method: "POST", headers: headersA, body: JSON.stringify({ enabled: true, provider: "mock", environment: "sandbox" }) });

  const raffle = await createRaffle(headersA, "PIX Safety");
  const pending = await buy("cliente-a.meudominio.com", raffle.id, "10000");
  const pendingApprove = await buy("cliente-a.meudominio.com", raffle.id, "10001");

  const statusPending = await json(`/api/checkout/orders/${pending.purchaseId}/status`, { headers: { "x-forwarded-host": "cliente-a.meudominio.com" } });
  assert.equal(statusPending.response.status, 200);
  assert.equal(statusPending.body.paymentStatus, "pending", "Verificar pagamento nao marca como pago.");
  assert.equal(statusPending.body.paid, false);

  for (const forbiddenStatus of ["paid", "confirmed", "received"]) {
    const blocked = await json(`/api/admin/purchases/${pending.purchaseId}`, {
      method: "PUT",
      headers: headersA,
      body: JSON.stringify({ status: forbiddenStatus, reason: `Tentativa bloqueada ${forbiddenStatus}` })
    });
    assert.equal(blocked.response.status, 403, `PUT generico nao pode aceitar status ${forbiddenStatus}.`);
    assert.equal(blocked.body.error, "Status financeiro deve ser alterado apenas pela confirmação manual auditada ou gateway.");
  }

  const blockedAmount = await json(`/api/admin/purchases/${pending.purchaseId}`, {
    method: "PUT",
    headers: headersA,
    body: JSON.stringify({ amount: 0.01, reason: "Tentativa bloqueada de valor" })
  });
  assert.equal(blockedAmount.response.status, 403, "PUT generico nao pode alterar valor financeiro.");

  const safeUpdate = await json(`/api/admin/purchases/${pending.purchaseId}`, {
    method: "PUT",
    headers: headersA,
    body: JSON.stringify({ reason: "Atualizacao administrativa sem status financeiro" })
  });
  assert.equal(safeUpdate.response.status, 200, "PUT sem status financeiro deve continuar funcionando.");
  assert.equal(safeUpdate.body.status, "pending", "PUT seguro nao pode alterar status pendente.");

  const wrongTenantPut = await json(`/api/admin/purchases/${pending.purchaseId}`, {
    method: "PUT",
    headers: headersB,
    body: JSON.stringify({ status: "paid", reason: "Tentativa cruzada" })
  });
  assert.equal(wrongTenantPut.response.status, 404, "Admin de outro tenant nao altera compra pelo PUT generico.");

  const clientManual = await json(`/api/admin/orders/${pending.purchaseId}/manual-confirm-payment`, { method: "POST", headers: { "x-forwarded-host": "cliente-a.meudominio.com" }, body: JSON.stringify({ reason: "fraude" }) });
  assert.equal(clientManual.response.status, 401, "Cliente nao chama rota manual admin.");

  const noReason = await json(`/api/admin/orders/${pending.purchaseId}/manual-confirm-payment`, { method: "POST", headers: headersA, body: JSON.stringify({ reason: "" }) });
  assert.equal(noReason.response.status, 400, "Admin sem motivo nao confirma.");

  const otherTenant = await json(`/api/admin/orders/${pending.purchaseId}/manual-confirm-payment`, { method: "POST", headers: headersB, body: JSON.stringify({ reason: "Tentativa cruzada" }) });
  assert.equal(otherTenant.response.status, 404, "Admin de outro tenant nao confirma.");

  const manual = await json(`/api/admin/orders/${pending.purchaseId}/manual-confirm-payment`, { method: "POST", headers: headersA, body: JSON.stringify({ reason: "Comprovante bancario conferido" }) });
  assert.equal(manual.response.status, 200);
  assert.equal(manual.body.purchase.status, "paid");
  assert.equal(manual.body.purchase.numeros.length, 2, "Confirmacao manual gera bilhete/cotas.");
  await wait(150);

  const duplicate = await json(`/api/admin/orders/${pending.purchaseId}/manual-confirm-payment`, { method: "POST", headers: headersA, body: JSON.stringify({ reason: "Comprovante bancario conferido novamente" }) });
  assert.equal(duplicate.response.status, 200);
  assert.deepEqual(duplicate.body.purchase.numeros, manual.body.purchase.numeros, "Confirmacao manual nao duplica cotas.");

  const messages = await json("/api/admin/whatsapp/messages", { headers: headersA });
  assert.equal(messages.body.filter(message => message.order_id === pending.purchaseId && message.message_type === "ticket_confirmation").length, 1, "Confirmacao manual nao duplica WhatsApp.");

  const paidStatus = await json(`/api/checkout/orders/${pending.purchaseId}/status`, { headers: { "x-forwarded-host": "cliente-a.meudominio.com" } });
  assert.equal(paidStatus.body.paymentStatus, "paid", "Pagamento pago mostra estado correto.");

  const approve = await json(`/api/admin/purchases/${pendingApprove.purchaseId}/approve`, {
    method: "POST",
    headers: headersA,
    body: JSON.stringify({ reason: "Comprovante conferido pela rota approve" })
  });
  assert.equal(approve.response.status, 200, "Rota approve auditada continua confirmando pagamento.");
  assert.equal(approve.body.status, "paid", "Approve continua usando confirmacao segura.");
  assert.equal(approve.body.numeros.length, 2, "Approve continua liberando cotas corretamente.");

  console.log("PASS: botoes e endpoints de confirmacao PIX seguros, auditados e idempotentes.");
} catch (error) {
  console.error(serverOutput);
  throw error;
} finally {
  server.kill("SIGTERM");
}

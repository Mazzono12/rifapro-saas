import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.PORT || (3635 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  SUPERADMIN_EMAIL: "superadmin.whatsapp@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "test-whatsapp-auto-ticket-jwt-secret-long-value",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-whatsapp-auto-ticket-gateway-key"
};

const server = spawn(process.execPath, ["dist/server.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
let serverOutput = "";
server.stdout.on("data", chunk => { serverOutput += chunk.toString(); });
server.stderr.on("data", chunk => { serverOutput += chunk.toString(); });

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      if (response.status >= 400) return;
    } catch {
      await wait(100);
    }
  }
  throw new Error("Servidor de teste WhatsApp nao iniciou.");
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
  const { response, body } = await json("/api/admin/raffles", {
    method: "POST",
    headers,
    body: JSON.stringify({ title, description: title, price: 2, totalTickets: 100, drawDate: "2026-12-31T20:00:00Z", image: "", status: "active" })
  });
  assert.equal(response.status, 200);
  return body;
}

async function buy(host, raffleId, phone, cpf) {
  const { response, body } = await json(`/api/raffles/${raffleId}/buy`, {
    method: "POST",
    headers: { "x-forwarded-host": host },
    body: JSON.stringify({
      tickets: 2,
      contact: phone,
      customer: { name: `Cliente ${phone.slice(-4)}`, phone, cpf, accessPassword: "123456" }
    })
  });
  assert.equal(response.status, 200);
  return body;
}

async function webhook(host, secret, body) {
  return json("/api/webhooks/payment/mercadopago", {
    method: "POST",
    headers: { "x-forwarded-host": host, "x-webhook-secret": secret },
    body: JSON.stringify(body)
  });
}

try {
  await waitForServer();
  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const superHeaders = { Authorization: `Bearer ${superToken}` };
  const tokenA = await createTenantAdmin(superHeaders, "tenant-cliente-a", "admin.whatsapp-a@test.local");
  const headersA = { Authorization: `Bearer ${tokenA}` };

  await json("/api/admin/gateways", { method: "PUT", headers: headersA, body: JSON.stringify({ pix: { apiKey: "pix-a-key", webhookSecret: "secret-a", webhookUrl: "/api/webhooks/payment/mercadopago" } }) });
  const config = await json("/api/admin/whatsapp/config", {
    method: "POST",
    headers: headersA,
    body: JSON.stringify({ enabled: true, provider: "mock", environment: "sandbox", default_language: "pt_BR" })
  });
  assert.equal(config.response.status, 200);
  assert.equal(config.body.enabled, true);

  const raffle = await createRaffle(headersA, "WhatsApp Auto Ticket");
  const pendingPurchase = await buy("cliente-a.meudominio.com", raffle.id, "11955550000", "11111111111");
  let messages = await json("/api/admin/whatsapp/messages", { headers: headersA });
  assert.equal(messages.body.length, 0, "PIX pendente nao deve enfileirar WhatsApp.");

  const ignored = await webhook("cliente-a.meudominio.com", "secret-a", { eventId: "evt-pending-whatsapp", status: "pending", external_reference: pendingPurchase.purchaseId });
  assert.equal(ignored.response.status, 202);
  messages = await json("/api/admin/whatsapp/messages", { headers: headersA });
  assert.equal(messages.body.length, 0, "Webhook pendente nao deve enviar WhatsApp.");

  const purchase = await buy("cliente-a.meudominio.com", raffle.id, "11955550001", "11111111112");
  const paid = await webhook("cliente-a.meudominio.com", "secret-a", { eventId: "evt-paid-whatsapp", status: "approved", external_reference: purchase.purchaseId });
  assert.equal(paid.response.status, 200);
  await wait(150);
  messages = await json("/api/admin/whatsapp/messages", { headers: headersA });
  const ticketMessage = messages.body.find(message => message.order_id === purchase.purchaseId && message.message_type === "ticket_confirmation");
  assert.ok(ticketMessage, "PIX aprovado deve enfileirar WhatsApp.");
  assert.equal(ticketMessage.status, "sent", "Provider mock deve marcar como sent.");
  assert.match(ticketMessage.message_body, /Campanha: WhatsApp Auto Ticket/);
  assert.match(ticketMessage.message_body, /Quantidade de cotas: 2/);
  assert.match(ticketMessage.message_body, /Valor pago:/);
  assert.match(ticketMessage.message_body, /Acesse seu bilhete:/);
  assert.doesNotMatch(ticketMessage.message_body, /admin/i, "Link do bilhete nao deve apontar para admin.");

  const duplicate = await webhook("cliente-a.meudominio.com", "secret-a", { eventId: "evt-paid-whatsapp", status: "approved", external_reference: purchase.purchaseId });
  assert.equal(duplicate.response.status, 200);
  await wait(100);
  messages = await json("/api/admin/whatsapp/messages", { headers: headersA });
  assert.equal(messages.body.filter(message => message.order_id === purchase.purchaseId && message.message_type === "ticket_confirmation").length, 1, "Webhook duplicado nao deve duplicar WhatsApp.");

  await json("/api/admin/whatsapp/config", { method: "POST", headers: headersA, body: JSON.stringify({ enabled: false, provider: "mock", environment: "sandbox" }) });
  const disabledPurchase = await buy("cliente-a.meudominio.com", raffle.id, "11955550002", "11111111113");
  await webhook("cliente-a.meudominio.com", "secret-a", { eventId: "evt-paid-whatsapp-disabled", status: "approved", external_reference: disabledPurchase.purchaseId });
  await wait(100);
  messages = await json("/api/admin/whatsapp/messages", { headers: headersA });
  assert.equal(messages.body.some(message => message.order_id === disabledPurchase.purchaseId), false, "Envio automatico desligado por tenant nao deve enfileirar.");

  console.log("PASS: PIX aprovado enfileira bilhete WhatsApp com idempotencia, mock e bloqueio para pendentes.");
} catch (error) {
  console.error(serverOutput);
  throw error;
} finally {
  server.kill("SIGTERM");
}

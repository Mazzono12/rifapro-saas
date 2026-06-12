import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.PORT || (3136 + Math.floor(Math.random() * 1000)));
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
  SUPERADMIN_EMAIL: "superadmin.concurrency@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "test-purchase-concurrency-jwt-secret-long-value",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-purchase-concurrency-gateway-credentials-key",
  PURCHASE_RESERVATION_TTL_MS: "60000"
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
  for (let attempt = 0; attempt < 120; attempt += 1) {
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

async function createTenantAdmin(superHeaders) {
  const email = "admin.concurrency-a@test.local";
  const { response } = await json("/api/superadmin/users", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({
      nome: "Admin Concorrencia A",
      email,
      password: "SenhaTenant123!",
      role: "tenant_admin",
      tenant_id: "tenant-cliente-a"
    })
  });
  assert.equal(response.status, 201);
  return login(email, "SenhaTenant123!");
}

async function createRaffle(headers) {
  const { response, body } = await json("/api/admin/raffles", {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "Concorrencia de Cotas",
      description: "Teste de reserva simultanea",
      price: 1,
      totalTickets: 10,
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

async function buy(raffleId, index) {
  return json(`/api/raffles/${raffleId}/buy`, {
    method: "POST",
    headers: { "x-forwarded-host": "cliente-a.meudominio.com" },
    body: JSON.stringify({
      tickets: 1,
      contact: `1197000${String(index).padStart(4, "0")}`,
      customer: {
        name: `Comprador Concorrente ${index}`,
        phone: `1197000${String(index).padStart(4, "0")}`,
        cpf: `700000${String(index).padStart(5, "0")}`,
        accessPassword: "123456"
      }
    })
  });
}

try {
  await waitForServer();

  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const superHeaders = { Authorization: `Bearer ${superToken}` };
  const tenantToken = await createTenantAdmin(superHeaders);
  const tenantHeaders = { Authorization: `Bearer ${tenantToken}` };
  const raffle = await createRaffle(tenantHeaders);

  const attempts = await Promise.all(Array.from({ length: 30 }, (_, index) => buy(raffle.id, index + 1)));
  const successes = attempts.filter(item => item.response.status === 200);
  const rejected = attempts.filter(item => item.response.status !== 200);

  assert.equal(successes.length, 10, "Apenas a quantidade total de cotas deve ser reservada.");
  assert.equal(rejected.length, 20, "Compras excedentes devem ser recusadas.");
  assert.ok(rejected.every(item => [400, 409].includes(item.response.status)), "Excedentes devem falhar por indisponibilidade/reserva.");

  const publicPendingNumbers = successes.flatMap(item => item.body.numeros || []);
  assert.equal(publicPendingNumbers.length, 0, "Resposta publica pendente nao deve revelar cotas antes do pagamento.");

  const purchases = await json("/api/admin/purchases", { headers: tenantHeaders });
  assert.equal(purchases.response.status, 200);
  const rafflePurchases = purchases.body.filter(item => item.raffleId === raffle.id);
  assert.equal(rafflePurchases.length, 10, "Somente compras com reserva devem ser persistidas.");
  assert.ok(rafflePurchases.every(item => item.status === "pending"), "Reservas PIX devem ficar pendentes ate pagamento.");
  assert.ok(rafflePurchases.every(item => item.reservedUntil), "Toda reserva pendente deve ter expiracao.");

  const persistedNumbers = rafflePurchases.flatMap(item => item.numeros || []);
  assert.equal(persistedNumbers.length, 10, "Cada compra aprovada deve reservar uma cota internamente.");
  assert.equal(new Set(persistedNumbers).size, persistedNumbers.length, "Persistencia nao pode ter cotas duplicadas.");

  const paid = rafflePurchases[0];
  const reservedBeforePayment = [...(paid.numeros || [])];
  const confirm = await json(`/api/admin/orders/${paid.purchaseId}/manual-confirm-payment`, {
    method: "POST",
    headers: tenantHeaders,
    body: JSON.stringify({ reason: "Teste de concorrencia de compra" })
  });
  assert.equal(confirm.response.status, 200, "Confirmacao deve usar a cota ja reservada.");
  assert.deepEqual((confirm.body.purchase || confirm.body).numeros, reservedBeforePayment, "Pagamento nao pode realocar a cota reservada.");

  const afterConfirm = await json("/api/admin/purchases", { headers: tenantHeaders });
  const finalNumbers = afterConfirm.body.filter(item => item.raffleId === raffle.id).flatMap(item => item.numeros || []);
  assert.equal(new Set(finalNumbers).size, finalNumbers.length, "Confirmacao nao pode duplicar cotas.");

  console.log("PASS: concorrencia de compras sem cotas duplicadas, com reserva pendente e confirmacao idempotente.");
} finally {
  server.kill();
}

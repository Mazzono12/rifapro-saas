import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("FAIL: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios para o E2E com banco real.");
  process.exit(2);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const port = 3137;
const baseUrl = `http://127.0.0.1:${port}`;
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  SUPERADMIN_EMAIL: `superadmin.e2e.${runId}@test.local`,
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: `test-e2e-supabase-${runId}-jwt-secret-long-value`,
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: `test-e2e-supabase-${runId}-gateway-credentials-key`,
  INTEGRATION_ENCRYPTION_KEY: `test-e2e-supabase-${runId}-encryption-key`
};

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function assertSupabaseReady() {
  const { error } = await supabase
    .from("persistent_state_records")
    .select("collection")
    .eq("tenant_id", "platform")
    .limit(1);
  assert.equal(error, null, `Supabase deve estar acessivel e com migrations aplicadas: ${error?.message || ""}`);
}

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

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      if (response.status >= 400) return;
    } catch {
      // Server is still starting.
    }
    await wait(100);
  }
  throw new Error(`Servidor de teste nao iniciou a tempo. Logs: ${serverOutput.slice(-1200)}`);
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
  assert.equal(response.status, 200, `Login falhou para ${email}: ${JSON.stringify(body)}`);
  return body.token;
}

async function createTenantAdmin(superHeaders, tenantId, label) {
  const email = `admin.${label}.${runId}@test.local`;
  const { response, body } = await json("/api/superadmin/users", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({
      nome: `Admin ${label} E2E`,
      email,
      password: "SenhaTenant123!",
      role: "tenant_admin",
      tenant_id: tenantId
    })
  });
  assert.equal(response.status, 201, `Superadmin deve criar admin ${label}: ${JSON.stringify(body)}`);
  return login(email, "SenhaTenant123!");
}

async function createRaffle(headers, title) {
  const { response, body } = await json("/api/admin/raffles", {
    method: "POST",
    headers,
    body: JSON.stringify({
      title,
      description: `${title} descricao E2E ${runId}`,
      price: 2,
      totalTickets: 60,
      drawDate: "2026-12-31T20:00:00Z",
      image: "",
      status: "active"
    })
  });
  assert.equal(response.status, 200, `Tenant admin deve criar rifa ${title}: ${JSON.stringify(body)}`);
  return body;
}

async function configureGateway(headers, secret) {
  const { response, body } = await json("/api/admin/gateways", {
    method: "PUT",
    headers,
    body: JSON.stringify({
      pix: {
        apiKey: `pix-key-${secret}`,
        sandbox: true,
        webhookSecret: secret,
        webhookUrl: "/api/webhooks/payment/mercadopago"
      }
    })
  });
  assert.equal(response.status, 200, `Gateway PIX deve salvar: ${JSON.stringify(body)}`);
}

async function configureGamification(headers, raffleId) {
  const current = await json(`/api/admin/gamification/${raffleId}`, { headers });
  assert.equal(current.response.status, 200);
  const { response, body } = await json(`/api/admin/gamification/${raffleId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      ...current.body.config,
      modules: {
        ...current.body.config.modules,
        scratchcard: true,
        buyerRanking: true,
        orderBump: true
      },
      scratchcard: {
        winProbability: 100,
        prizes: [{ id: `scr-${runId}`, name: "PIX 1 E2E", type: "pix", value: 1, stock: 5, probability: 100 }]
      },
      orderBump: { enabled: true, tickets: 1, discountPercent: 0, label: "Adicionar 1 cota E2E" }
    })
  });
  assert.equal(response.status, 200, `Gamificacao deve salvar: ${JSON.stringify(body)}`);
  return body;
}

async function buy(host, raffleId, index, tickets = 1, orderBumpAccepted = false) {
  return json(`/api/raffles/${raffleId}/buy`, {
    method: "POST",
    headers: { "x-forwarded-host": host },
    body: JSON.stringify({
      tickets,
      orderBumpAccepted,
      contact: `11988${String(index).padStart(7, "0")}`,
      tenant_id: "tenant-forjado",
      customer: {
        name: `Comprador E2E ${index}`,
        phone: `11988${String(index).padStart(7, "0")}`,
        cpf: `988${String(index).padStart(8, "0")}`,
        accessPassword: "123456"
      }
    })
  });
}

async function webhook(host, secret, purchaseId, eventId) {
  return json("/api/webhooks/payment/mercadopago", {
    method: "POST",
    headers: {
      "x-forwarded-host": host,
      "x-webhook-secret": secret
    },
    body: JSON.stringify({
      eventId,
      status: "approved",
      external_reference: purchaseId
    })
  });
}

function assertNoDuplicateNumbers(purchases, label) {
  const numbersByRaffle = new Map();
  for (const purchase of purchases) {
    const key = `${purchase.tenant_id}:${purchase.raffleId}`;
    if (!numbersByRaffle.has(key)) numbersByRaffle.set(key, []);
    numbersByRaffle.get(key).push(...(purchase.numeros || []));
  }
  for (const [key, numbers] of numbersByRaffle) {
    assert.equal(new Set(numbers).size, numbers.length, `${label}: numeros duplicados em ${key}`);
  }
}

async function readPersistentCollection(collection) {
  const { data, error } = await supabase
    .from("persistent_state_records")
    .select("data")
    .eq("tenant_id", "platform")
    .eq("collection", collection)
    .eq("record_key", "singleton")
    .single();
  assert.equal(error, null, `Colecao ${collection} deve existir no Supabase: ${error?.message || ""}`);
  return data.data;
}

try {
  await assertSupabaseReady();
  await waitForServer();

  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const superHeaders = { Authorization: `Bearer ${superToken}` };
  const tokenA = await createTenantAdmin(superHeaders, "tenant-cliente-a", "cliente-a");
  const tokenB = await createTenantAdmin(superHeaders, "tenant-cliente-b", "cliente-b");
  const headersA = { Authorization: `Bearer ${tokenA}` };
  const headersB = { Authorization: `Bearer ${tokenB}` };

  await configureGateway(headersA, `secret-a-${runId}`);
  await configureGateway(headersB, `secret-b-${runId}`);

  const raffleA = await createRaffle(headersA, `Rifa Cliente A E2E ${runId}`);
  const raffleB = await createRaffle(headersB, `Rifa Cliente B E2E ${runId}`);
  await configureGamification(headersA, raffleA.id);

  const [buyAResults, buyBResults] = await Promise.all([
    Promise.all(Array.from({ length: 12 }, (_, index) => buy("cliente-a.meudominio.com", raffleA.id, 1000 + index, 1, index === 0))),
    Promise.all(Array.from({ length: 12 }, (_, index) => buy("cliente-b.meudominio.com", raffleB.id, 2000 + index)))
  ]);
  assert.ok(buyAResults.every(item => item.response.status === 200), "Compras simultaneas cliente-a devem passar.");
  assert.ok(buyBResults.every(item => item.response.status === 200), "Compras simultaneas cliente-b devem passar.");

  const pendingA = buyAResults[0].body;
  const paidA = buyAResults[1].body;
  const paidB = buyBResults[0].body;
  assert.equal(pendingA.status, "pending", "PIX pendente deve nascer como pending.");
  assert.ok(pendingA.gamification?.scratchcardEventId, "Gamificacao deve criar raspadinha quando ativa.");

  const scratch = await json(`/api/gamification/scratchcards/${pendingA.gamification.scratchcardEventId}/reveal`, {
    method: "POST",
    headers: { "x-forwarded-host": "cliente-a.meudominio.com" }
  });
  assert.equal(scratch.response.status, 200, `Raspadinha deve funcionar: ${JSON.stringify(scratch.body)}`);

  const paidAWebhook = await webhook("cliente-a.meudominio.com", `secret-a-${runId}`, paidA.purchaseId, `evt-paid-a-${runId}`);
  assert.equal(paidAWebhook.response.status, 200, "Webhook pago cliente-a deve aprovar.");
  const duplicateAWebhook = await webhook("cliente-a.meudominio.com", `secret-a-${runId}`, paidA.purchaseId, `evt-paid-a-${runId}`);
  assert.equal(duplicateAWebhook.response.status, 200, "Webhook duplicado deve responder 200.");
  assert.equal(duplicateAWebhook.body.duplicate, true, "Webhook duplicado deve ser idempotente.");

  const paidBWebhook = await webhook("cliente-b.meudominio.com", `secret-b-${runId}`, paidB.purchaseId, `evt-paid-b-${runId}`);
  assert.equal(paidBWebhook.response.status, 200, "Webhook pago cliente-b deve aprovar.");

  const purchasesA = await json("/api/admin/purchases", { headers: headersA });
  const purchasesB = await json("/api/admin/purchases", { headers: headersB });
  assert.equal(purchasesA.response.status, 200);
  assert.equal(purchasesB.response.status, 200);
  assert.equal(purchasesA.body.some(item => item.raffleId === raffleB.id || item.purchaseId === paidB.purchaseId), false, "cliente-a nao ve dados do cliente-b.");
  assert.equal(purchasesB.body.some(item => item.raffleId === raffleA.id || item.purchaseId === paidA.purchaseId), false, "cliente-b nao ve dados do cliente-a.");
  assertNoDuplicateNumbers(purchasesA.body.filter(item => item.raffleId === raffleA.id), "cliente-a");
  assertNoDuplicateNumbers(purchasesB.body.filter(item => item.raffleId === raffleB.id), "cliente-b");

  const paidPurchaseA = purchasesA.body.find(item => item.purchaseId === paidA.purchaseId);
  assert.equal(paidPurchaseA.status, "paid", "PIX pago deve ficar paid.");
  assert.equal(purchasesA.body.find(item => item.purchaseId === pendingA.purchaseId).status, "pending", "PIX pendente deve continuar pending.");

  const drawA = await json(`/api/admin/raffles/${raffleA.id}/draw`, {
    method: "POST",
    headers: headersA,
    body: JSON.stringify({ number: paidPurchaseA.numeros[0] })
  });
  assert.equal(drawA.response.status, 200, "Sorteio cliente-a deve executar.");
  assert.equal(drawA.body.status, "winner", "Sorteio deve achar ganhador pago.");

  const crossDraw = await json(`/api/admin/raffles/${raffleA.id}/draw`, {
    method: "POST",
    headers: headersB,
    body: JSON.stringify({ number: paidPurchaseA.numeros[0] })
  });
  assert.equal(crossDraw.response.status, 400, "cliente-b nao pode sortear rifa cliente-a.");

  const superPix = await json("/api/superadmin/payments/pix", { headers: superHeaders });
  assert.equal(superPix.response.status, 200);
  assert.ok(superPix.body.some(item => item.id === paidA.purchaseId), "Superadmin deve ver pagamento cliente-a.");
  assert.ok(superPix.body.some(item => item.id === paidB.purchaseId), "Superadmin deve ver pagamento cliente-b.");

  const logsA = await json("/api/admin/payments/webhooks", { headers: headersA });
  assert.ok(logsA.body.some(log => log.purchaseId === paidA.purchaseId && log.status === "confirmed"), "Log confirmed deve existir.");
  assert.ok(logsA.body.some(log => log.purchaseId === paidA.purchaseId && log.status === "duplicate"), "Log duplicate deve existir.");

  await wait(800);
  const persistedPurchases = await readPersistentCollection("purchases");
  assert.ok(Array.isArray(persistedPurchases), "Compras devem estar persistidas como array no Supabase.");
  assert.ok(persistedPurchases.some(item => item.purchaseId === paidA.purchaseId), "Compra cliente-a deve estar no Supabase.");
  assert.ok(persistedPurchases.some(item => item.purchaseId === paidB.purchaseId), "Compra cliente-b deve estar no Supabase.");
  assertNoDuplicateNumbers(persistedPurchases.filter(item => [raffleA.id, raffleB.id].includes(item.raffleId)), "supabase");

  const persistedEvents = await readPersistentCollection("gamificationEvents");
  assert.ok(Array.isArray(persistedEvents), "Eventos de gamificacao devem estar persistidos.");
  assert.ok(persistedEvents.some(item => item.purchaseId === pendingA.purchaseId && item.module === "scratchcard"), "Gamificacao cliente-a deve persistir no Supabase.");

  console.log("PASS: E2E Supabase/Postgres multitenant com compras simultaneas, PIX, webhook idempotente, sorteio, gamificacao e isolamento.");
} finally {
  server.kill();
}

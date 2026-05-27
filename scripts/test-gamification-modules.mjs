import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.PORT || (3130 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  SUPERADMIN_EMAIL: "superadmin.gamification@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "test-gamification-jwt-secret-long-value"
};

const server = spawn(process.execPath, ["dist/server.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      if (response.status >= 400) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Servidor de teste nao iniciou a tempo.");
}

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
}

async function json(path, options = {}) {
  const response = await request(path, options);
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
    body: JSON.stringify({ title, description: title, price: 10, totalTickets: 20, drawDate: "2026-12-31T20:00:00Z", image: "", status: "active" })
  });
  assert.equal(response.status, 200);
  return body;
}

async function buy(host, raffleId, phone, cpf, extra = {}) {
  const { response, body } = await json(`/api/raffles/${raffleId}/buy`, {
    method: "POST",
    headers: { "x-forwarded-host": host },
    body: JSON.stringify({
      tickets: 1,
      contact: phone,
      customer: { name: `Cliente ${phone.slice(-2)}`, phone, cpf, accessPassword: "123456" },
      ...extra
    })
  });
  assert.equal(response.status, 200);
  return body;
}

async function configure(headers, raffleId, patch) {
  const current = await json(`/api/admin/gamification/${raffleId}`, { headers });
  assert.equal(current.response.status, 200);
  const { response, body } = await json(`/api/admin/gamification/${raffleId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ ...current.body.config, ...patch })
  });
  assert.equal(response.status, 200);
  return body;
}

try {
  await waitForServer();
  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const superHeaders = { Authorization: `Bearer ${superToken}` };
  const tokenA = await createTenantAdmin(superHeaders, "tenant-cliente-a", "admin.game-a@test.local");
  const tokenB = await createTenantAdmin(superHeaders, "tenant-cliente-b", "admin.game-b@test.local");
  const headersA = { Authorization: `Bearer ${tokenA}` };
  const headersB = { Authorization: `Bearer ${tokenB}` };
  const raffleA = await createRaffle(headersA, "Gamificacao Cliente A");
  const raffleB = await createRaffle(headersB, "Gamificacao Cliente B");

  let publicConfig = await json(`/api/raffles/${raffleA.id}/gamification`, { headers: { "x-forwarded-host": "cliente-a.meudominio.com" } });
  assert.equal(publicConfig.body.modules.scratchcard, false, "Modulo desativado deve aparecer desativado.");

  const now = Date.now();
  await configure(headersA, raffleA.id, {
    modules: { scratchcard: true, winningTicket: true, luckyHour: true, mysteryBox: true, doubleChance: true, extremeTickets: true, buyerRanking: true, orderBump: true },
    scratchcard: { winProbability: 100, prizes: [{ id: "scr-win", name: "PIX 10", type: "pix", value: 10, stock: 1, probability: 100 }] },
    winningTicket: { prizes: Array.from({ length: 20 }, (_, index) => ({ id: `bil-${index + 1}`, number: index + 1, prize: "Bilhete premiado", value: 5, status: "available" })) },
    luckyHour: { windows: [{ id: "inside", startsAt: new Date(now - 60000).toISOString(), endsAt: new Date(now + 3600000).toISOString(), type: "bonus", value: 1, active: true }] },
    mysteryBox: { boxes: [{ id: "box-a", label: "A", prize: "Bônus 5", type: "bonus", value: 5, status: "available" }] },
    doubleChance: { startsAt: new Date(now - 60000).toISOString(), endsAt: new Date(now + 3600000).toISOString(), minTickets: 1, weight: 2 },
    buyerRanking: { visible: true, metric: "tickets", limit: 5 },
    orderBump: { enabled: true, tickets: 2, discountPercent: 50, label: "Adicione mais 2 cotas pela metade" }
  });

  publicConfig = await json(`/api/raffles/${raffleA.id}/gamification`, { headers: { "x-forwarded-host": "cliente-a.meudominio.com" } });
  assert.equal(publicConfig.body.modules.scratchcard, true, "Modulo ativado deve aparecer ativado.");
  assert.equal(publicConfig.body.luckyHour.active, true, "Hora premiada dentro do horario deve estar ativa.");
  assert.equal(publicConfig.body.doubleChance.active, true, "Chance em dobro dentro do horario deve estar ativa.");

  const purchaseWin = await buy("cliente-a.meudominio.com", raffleA.id, "11955555555", "55555555555", { orderBumpAccepted: true });
  assert.ok(purchaseWin.gamification.scratchcardEventId, "Raspadinha deve ser criada apos compra.");
  assert.ok(purchaseWin.gamification.mysteryBoxEventId, "Caixinha deve ser criada apos compra.");
  assert.equal(purchaseWin.gamification.luckyHour.applied, true, "Hora premiada deve aplicar bonus dentro do horario.");
  assert.equal(purchaseWin.gamification.orderBump.accepted, true, "Upsell aceito deve ser registrado.");

  const scratchWin = await json(`/api/gamification/scratchcards/${purchaseWin.gamification.scratchcardEventId}/reveal`, { method: "POST", headers: { "x-forwarded-host": "cliente-a.meudominio.com" } });
  assert.equal(scratchWin.body.event.status, "won", "Comprador deve ganhar raspadinha com probabilidade 100.");

  const boxOpen = await json(`/api/gamification/mystery-boxes/${purchaseWin.gamification.mysteryBoxEventId}/open`, { method: "POST", headers: { "x-forwarded-host": "cliente-a.meudominio.com" }, body: JSON.stringify({ boxId: "box-a" }) });
  assert.equal(boxOpen.response.status, 200, "Caixinha deve abrir uma vez.");
  const boxAgain = await json(`/api/gamification/mystery-boxes/${purchaseWin.gamification.mysteryBoxEventId}/open`, { method: "POST", headers: { "x-forwarded-host": "cliente-a.meudominio.com" }, body: JSON.stringify({ boxId: "box-a" }) });
  assert.equal(boxAgain.response.status, 409, "Caixinha nao pode abrir duas vezes.");

  const confirmWin = await json(`/api/admin/orders/${purchaseWin.purchaseId}/manual-confirm-payment`, { method: "POST", headers: headersA, body: JSON.stringify({ reason: "Teste hard de gamificacao" }) });
  assert.equal(confirmWin.response.status, 200);
  const confirmedWinPurchase = confirmWin.body.purchase || confirmWin.body;
  assert.equal(confirmedWinPurchase.ticketWeights.every(item => item.weight === 2), true, "Chance em dobro deve alterar peso.");
  assert.ok(confirmedWinPurchase.gamification.autoPrizes?.length > 0, "Bilhete premiado deve registrar premio automatico.");

  await configure(headersA, raffleA.id, {
    scratchcard: { winProbability: 0, prizes: [{ id: "scr-lose", name: "PIX 99", type: "pix", value: 99, stock: 1, probability: 100 }] },
    luckyHour: { windows: [{ id: "outside", startsAt: new Date(now - 7200000).toISOString(), endsAt: new Date(now - 3600000).toISOString(), type: "bonus", value: 5, active: true }] }
  });
  const purchaseLose = await buy("cliente-a.meudominio.com", raffleA.id, "11966666666", "66666666666", { orderBumpAccepted: false });
  assert.equal(purchaseLose.gamification.luckyHour.applied, false, "Hora premiada fora do horario nao aplica.");
  assert.equal(purchaseLose.gamification.orderBump.accepted, false, "Upsell recusado deve ser registrado.");
  const scratchLose = await json(`/api/gamification/scratchcards/${purchaseLose.gamification.scratchcardEventId}/reveal`, { method: "POST", headers: { "x-forwarded-host": "cliente-a.meudominio.com" } });
  assert.equal(scratchLose.body.event.status, "lost", "Comprador nao deve ganhar raspadinha com probabilidade 0.");
  await json(`/api/admin/orders/${purchaseLose.purchaseId}/manual-confirm-payment`, { method: "POST", headers: headersA, body: JSON.stringify({ reason: "Teste hard de gamificacao" }) });

  const ranking = await json(`/api/raffles/${raffleA.id}/ranking`, { headers: { "x-forwarded-host": "cliente-a.meudominio.com" } });
  assert.equal(ranking.response.status, 200);
  assert.ok(ranking.body[0].tickets >= ranking.body.at(-1).tickets, "Ranking deve ordenar por cotas.");

  const extreme = await json(`/api/admin/gamification/${raffleA.id}/extreme-tickets/calculate`, { method: "POST", headers: headersA });
  assert.equal(extreme.response.status, 200, "Maior e menor cota deve calcular apenas cotas pagas.");
  assert.equal(extreme.body.winners.length, 2);

  const cross = await json(`/api/admin/gamification/${raffleA.id}`, { headers: headersB });
  assert.equal(cross.response.status, 404, "Tenant B nao acessa gamificacao do tenant A.");
  const tenantBState = await json("/api/admin/gamification", { headers: headersB });
  assert.equal(JSON.stringify(tenantBState.body).includes(raffleA.id), false, "Tenant B nao ve eventos/configs do tenant A.");

  console.log("PASS: modulos de gamificacao multitenant ativados/desativados e fluxos obrigatorios validados.");
} finally {
  server.kill();
}

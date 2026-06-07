import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.TEST_ALL_MODALIDADES_ACTIVE_PORT || (6100 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
const host = "cliente-a.meudominio.com";
const webhookSecret = "secret-all-modalidades-hard";
let serverOutput = "";

const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  RIFAPRO_TEST_MODE: "hard",
  STORAGE_DRIVER: "persistent",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  SUPERADMIN_EMAIL: "superadmin.all-modalidades@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "test-all-modalidades-active-hard-jwt-secret",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-all-modalidades-active-hard-gateway-key",
  PURCHASE_RESERVATION_TTL_MS: "900",
  FAST_MODALITY_RESERVATION_TTL_MS: "900"
};

const server = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
  cwd: process.cwd(),
  env,
  stdio: ["ignore", "pipe", "pipe"]
});
server.stdout.on("data", chunk => { serverOutput += chunk.toString(); });
server.stderr.on("data", chunk => { serverOutput += chunk.toString(); });

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      if (response.status >= 200) return;
    } catch {
      // Server is still starting.
    }
    await wait(100);
  }
  throw new Error(`Servidor de teste nao iniciou a tempo. Saida: ${serverOutput.slice(-2000)}`);
}

async function json(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function login(email, password, extraHeaders = {}) {
  const { response, body } = await json("/api/auth/login", {
    method: "POST",
    headers: extraHeaders,
    body: JSON.stringify({ email, password })
  });
  assert.equal(response.status, 200, `Login falhou para ${email}: ${JSON.stringify(body)}`);
  return body.token;
}

async function createTenantAdmin(superHeaders) {
  const email = "admin.all-modalidades@test.local";
  const created = await json("/api/superadmin/users", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({
      nome: "Admin All Modalidades",
      email,
      password: "SenhaTenant123!",
      role: "tenant_admin",
      tenant_id: "tenant-cliente-a"
    })
  });
  assert.equal(created.response.status, 201, `Superadmin deve criar admin tenant: ${JSON.stringify(created.body)}`);
  return login(email, "SenhaTenant123!");
}

function customer(label, suffix) {
  const clean = String(suffix).replace(/\D/g, "").padStart(5, "0").slice(-5);
  return {
    name: `Cliente ${label} ${clean}`,
    phone: `1198${clean.padStart(7, "0")}`,
    cpf: `91${clean.padStart(9, "0")}`.slice(0, 11),
    accessPassword: "123456"
  };
}

async function setupScenario(headers) {
  const gateway = await json("/api/admin/gateways", {
    method: "PUT",
    headers,
    body: JSON.stringify({
      active: "mercadopago",
      pix: {
        enabled: true,
        gateway: "mercadopago",
        sandbox: true,
        apiKey: "sandbox-pix-key",
        webhookSecret,
        webhookUrl: "/api/webhooks/payment/mercadopago"
      },
      mercadopago: {
        environment: "sandbox",
        accessToken: "",
        publicKey: "",
        webhookSecret,
        webhookUrl: "/api/webhooks/payment/mercadopago",
        releaseStatus: "approved"
      }
    })
  });
  assert.equal(gateway.response.status, 200, `Gateway sandbox deve salvar: ${JSON.stringify(gateway.body)}`);

  const raffle = await json("/api/admin/raffles", {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "All Modalidades Hard",
      description: "Rifa tradicional controlada para bateria hard",
      price: 1,
      totalTickets: 4,
      reservationMinutes: 1,
      drawDate: "2026-12-31T20:00:00Z",
      image: "",
      status: "active"
    })
  });
  assert.equal(raffle.response.status, 200, `Rifa ativa deve ser criada: ${JSON.stringify(raffle.body)}`);

  const farmReset = await json("/api/admin/fazendinha/reset", { method: "POST", headers });
  assert.equal(farmReset.response.status, 200, "Fazendinha deve resetar ativa para o tenant.");
  const farmConfig = await json("/api/admin/fazendinha/config", {
    method: "PUT",
    headers,
    body: JSON.stringify({ ...farmReset.body.config, reservationMinutes: 1 })
  });
  assert.equal(farmConfig.response.status, 200, `Fazendinha deve aceitar reserva minima de teste: ${JSON.stringify(farmConfig.body)}`);

  for (const mode of ["dezena", "centena", "milhar"]) {
    const configured = await json(`/api/admin/modalidades/${mode}/config`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        enabled: true,
        status: "active",
        price: mode === "dezena" ? 1 : mode === "centena" ? 2 : 3,
        prize: `Premio ${mode}`,
        drawDate: "2026-12-31T20:00:00Z",
        reservationMinutes: 1,
        lootboxEnabled: false
      })
    });
    assert.equal(configured.response.status, 200, `${mode} deve ficar ativa: ${JSON.stringify(configured.body)}`);
  }

  return raffle.body;
}

async function buyRaffle(raffleId, suffix, extra = {}) {
  return json(`/api/raffles/${raffleId}/buy`, {
    method: "POST",
    headers: { "x-forwarded-host": host },
    body: JSON.stringify({
      tickets: 1,
      contact: customer("rifa", suffix).phone,
      customer: customer("rifa", suffix),
      ...extra
    })
  });
}

async function buyMode(mode, numbers, suffix, extra = {}) {
  return json(`/api/modalidades/${mode}/buy`, {
    method: "POST",
    headers: { "x-forwarded-host": host },
    body: JSON.stringify({
      numbers,
      customer: customer(mode, suffix),
      ...extra
    })
  });
}

async function buyFarm(groupIds, suffix, extra = {}) {
  return json("/api/fazendinha/buy", {
    method: "POST",
    headers: { "x-forwarded-host": host },
    body: JSON.stringify({
      groupIds,
      customer: customer("fazendinha", suffix),
      ...extra
    })
  });
}

async function webhook(orderId) {
  return json("/api/webhooks/payment/mercadopago", {
    method: "POST",
    headers: {
      "x-forwarded-host": host,
      "x-webhook-secret": webhookSecret
    },
    body: JSON.stringify({
      status: "approved",
      external_reference: orderId
    })
  });
}

async function status(orderId) {
  return json(`/api/checkout/orders/${orderId}/status`, {
    headers: { "x-forwarded-host": host }
  });
}

async function assertPublicPaidIgnored(kind, purchase, statusField = "status") {
  assert.ok(purchase, `${kind}: compra deve existir.`);
  assert.notEqual(purchase[statusField], "paid", `${kind}: payload publico paid nao pode liquidar compra.`);
  assert.equal(purchase.paymentStatus || "pending", "pending", `${kind}: paymentStatus deve permanecer pending.`);
  assert.equal(purchase.paidAt ?? null, null, `${kind}: paidAt nao pode vir preenchido do cliente.`);
  assert.equal(purchase.confirmedAt ?? null, null, `${kind}: confirmedAt nao pode vir preenchido do cliente.`);
}

async function assertWebhookConfirms(orderId, expectedType) {
  const paid = await webhook(orderId);
  assert.equal(paid.response.status, 200, `${expectedType}: webhook seguro deve confirmar pagamento: ${JSON.stringify(paid.body)}`);
  const after = await status(orderId);
  assert.equal(after.response.status, 200);
  assert.equal(after.body.paymentStatus, "paid", `${expectedType}: status deve ficar paid apos webhook.`);
  assert.equal(after.body.paid, true, `${expectedType}: paid=true apos webhook.`);
}

async function assertLatePaymentBlocked(orderId, expectedType) {
  await wait(62_000);
  const expired = await status(orderId);
  assert.equal(expired.response.status, 200, `${expectedType}: status de expiracao deve responder.`);
  assert.equal(expired.body.expired, true, `${expectedType}: reserva deve expirar.`);
  assert.equal(expired.body.paymentStatus, "expired", `${expectedType}: PIX deve ficar expirado.`);
  const late = await webhook(orderId);
  assert.notEqual(late.response.status, 200, `${expectedType}: webhook atrasado nao pode liquidar item vencido.`);
  const afterLate = await status(orderId);
  assert.notEqual(afterLate.body.paymentStatus, "paid", `${expectedType}: pagamento atrasado nao pode virar paid.`);
}

try {
  await waitForServer();

  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD, { "x-forwarded-host": "admin.meudominio.com" });
  const superHeaders = { Authorization: `Bearer ${superToken}`, "x-forwarded-host": "admin.meudominio.com" };
  const tenantToken = await createTenantAdmin(superHeaders);
  const tenantHeaders = { Authorization: `Bearer ${tenantToken}` };
  const raffle = await setupScenario(tenantHeaders);

  const paidPayload = { statusPagamento: "paid", paymentStatus: "paid", paid: true, confirmed: true };

  const rafflePaidPayload = await buyRaffle(raffle.id, 10001, paidPayload);
  assert.equal(rafflePaidPayload.response.status, 200, `Rifa deve criar reserva: ${JSON.stringify(rafflePaidPayload.body)}`);
  assert.equal(rafflePaidPayload.body.status, "pending", "Rifa publica deve nascer pending.");

  const raffleBlocked = await buyRaffle(raffle.id, 10002);
  assert.equal(raffleBlocked.response.status, 200, "Rifa deve reservar segunda cota.");
  await assertWebhookConfirms(raffleBlocked.body.purchaseId, "rifa tradicional");

  const raffleExpired = await buyRaffle(raffle.id, 10003);
  assert.equal(raffleExpired.response.status, 200, "Rifa deve criar reserva para expiracao.");
  await assertLatePaymentBlocked(raffleExpired.body.purchaseId, "rifa tradicional");

  const releasedRaffle = await buyRaffle(raffle.id, 10004);
  assert.equal(releasedRaffle.response.status, 200, "Rifa deve liberar cota vencida para nova reserva.");

  const concurrentRaffle = await Promise.all(Array.from({ length: 6 }, (_, index) => buyRaffle(raffle.id, 10100 + index)));
  const raffleSuccesses = concurrentRaffle.filter(item => item.response.status === 200);
  const raffleNumbers = raffleSuccesses.flatMap(item => item.body.numeros || []);
  assert.equal(new Set(raffleNumbers).size, raffleNumbers.length, "Rifa nao pode duplicar cotas em compra simultanea.");
  assert.ok(concurrentRaffle.some(item => item.response.status !== 200), "Rifa com estoque limitado deve recusar excedentes simultaneos.");

  const farmState = await json("/api/fazendinha", { headers: { "x-forwarded-host": host } });
  assert.equal(farmState.response.status, 200, "Fazendinha publica deve carregar.");
  const farmGroupA = farmState.body.groups.find(item => item.status === "available");
  const farmGroupB = farmState.body.groups.find(item => item.status === "available" && item.id !== farmGroupA?.id);
  assert.ok(farmGroupA && farmGroupB, "Fazendinha precisa de grupos disponiveis.");

  const farmPaidPayload = await buyFarm([farmGroupA.id], 20001, paidPayload);
  assert.equal(farmPaidPayload.response.status, 200, `Fazendinha deve criar reserva: ${JSON.stringify(farmPaidPayload.body)}`);
  await assertPublicPaidIgnored("fazendinha", farmPaidPayload.body.purchase, "statusPagamento");
  assert.ok(farmPaidPayload.body.groups.every(group => group.status === "reserved"), "Fazendinha deve reservar, nao vender.");

  const farmDuplicate = await buyFarm([farmGroupA.id], 20002);
  assert.equal(farmDuplicate.response.status, 409, "Grupo reservado nao pode ser vendido para outro cliente.");

  const farmConfirmed = await buyFarm([farmGroupB.id], 20003);
  assert.equal(farmConfirmed.response.status, 200, "Fazendinha deve criar reserva para confirmacao.");
  await assertWebhookConfirms(farmConfirmed.body.purchase.id, "fazendinha");

  const farmExpiredGroup = farmState.body.groups.find(item => item.status === "available" && ![farmGroupA.id, farmGroupB.id].includes(item.id));
  assert.ok(farmExpiredGroup, "Fazendinha precisa de grupo para expiracao.");
  const farmExpired = await buyFarm([farmExpiredGroup.id], 20004);
  assert.equal(farmExpired.response.status, 200, "Fazendinha deve criar reserva para expiracao.");
  await assertLatePaymentBlocked(farmExpired.body.purchase.id, "fazendinha");
  const farmReleased = await buyFarm([farmExpiredGroup.id], 20005);
  assert.equal(farmReleased.response.status, 200, "Grupo vencido da Fazendinha deve voltar a ficar disponivel.");

  const modeNumbers = { dezena: "42", centena: "123", milhar: "1234" };
  let suffix = 30000;
  for (const mode of ["dezena", "centena", "milhar"]) {
    const number = modeNumbers[mode];
    const paidAttempt = await buyMode(mode, [number], suffix += 1, paidPayload);
    assert.equal(paidAttempt.response.status, 200, `${mode}: deve criar reserva mesmo com payload paid.`);
    await assertPublicPaidIgnored(mode, paidAttempt.body.purchase);

    const duplicate = await buyMode(mode, [number], suffix += 1);
    assert.equal(duplicate.response.status, 409, `${mode}: numero reservado nao pode ser vendido para outro.`);

    const confirmNumber = mode === "dezena" ? "43" : mode === "centena" ? "124" : "1235";
    const confirm = await buyMode(mode, [confirmNumber], suffix += 1);
    assert.equal(confirm.response.status, 200, `${mode}: deve criar reserva para webhook.`);
    await assertWebhookConfirms(confirm.body.purchase.id, mode);

    const expireNumber = mode === "dezena" ? "44" : mode === "centena" ? "125" : "1236";
    const expiring = await buyMode(mode, [expireNumber], suffix += 1);
    assert.equal(expiring.response.status, 200, `${mode}: deve criar reserva para expiracao.`);
    await assertLatePaymentBlocked(expiring.body.purchase.id, mode);

    const released = await buyMode(mode, [expireNumber], suffix += 1);
    assert.equal(released.response.status, 200, `${mode}: numero vencido deve ser liberado para nova reserva.`);

    const concurrentNumber = mode === "dezena" ? "45" : mode === "centena" ? "126" : "1237";
    const concurrent = await Promise.all(Array.from({ length: 5 }, (_, index) => buyMode(mode, [concurrentNumber], suffix + 10 + index)));
    assert.equal(concurrent.filter(item => item.response.status === 200).length, 1, `${mode}: apenas uma compra simultanea pode reservar o mesmo numero.`);
    assert.ok(concurrent.filter(item => item.response.status === 409).length >= 1, `${mode}: concorrentes devem receber conflito.`);
    suffix += 20;
  }

  console.log("PASS: all-modalidades-active-hard validou rifa, Fazendinha, Dezena, Centena e Milhar ativas com reservas, PIX pendente, webhook seguro, expiracao e concorrencia.");
} catch (error) {
  console.error(serverOutput.slice(-4000));
  throw error;
} finally {
  server.kill("SIGTERM");
}

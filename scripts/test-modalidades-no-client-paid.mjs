import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.TEST_MODALIDADES_NO_CLIENT_PAID_PORT || (3300 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
let serverOutput = "";
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "test",
  RIFAPRO_TEST_MODE: "p0-client-paid",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  SUPERADMIN_EMAIL: "superadmin.modalidades-p0@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "test-modalidades-no-client-paid-jwt-secret",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-modalidades-no-client-paid-gateway-key"
};

const server = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
  cwd: process.cwd(),
  env,
  stdio: ["ignore", "pipe", "pipe"]
});
server.stdout.on("data", chunk => { serverOutput += chunk.toString(); });
server.stderr.on("data", chunk => { serverOutput += chunk.toString(); });

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
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
      "x-forwarded-host": "cliente-a.meudominio.com",
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function login(email, password) {
  const { response, body } = await json("/api/auth/login", {
    method: "POST",
    headers: { "x-forwarded-host": "admin.meudominio.com" },
    body: JSON.stringify({ email, password })
  });
  assert.equal(response.status, 200, "Login superadmin deve funcionar.");
  return body.token;
}

try {
  await waitForServer();

  const buy = await json("/api/modalidades/dezena/buy", {
    method: "POST",
    body: JSON.stringify({
      numbers: ["42"],
      statusPagamento: "paid",
      paymentStatus: "paid",
      paid: true,
      confirmed: true,
      customer: {
        name: "Tentativa Modalidade Paga",
        phone: "11951000001",
        cpf: "51000000001",
        accessPassword: "123456"
      }
    })
  });
  assert.equal(buy.response.status, 200, `Compra modalidade deve ser criada como reserva: ${JSON.stringify(buy.body)}`);
  const purchase = buy.body.purchase;
  assert.equal(purchase.status, "reserved", "Payload publico nao pode marcar modalidade como paid.");
  assert.equal(purchase.paymentStatus, "pending", "paymentStatus publico deve nascer pending.");
  assert.equal(purchase.paidAt, null, "paidAt nao deve ser preenchido pelo cliente.");
  assert.equal(purchase.confirmedAt, null, "confirmedAt nao deve ser preenchido pelo cliente.");
  assert.equal(purchase.earnedLootboxes || 0, 0, "Lootbox nao deve ser liberada antes do pagamento.");

  const publicState = await json("/api/modalidades/dezena");
  const saved = publicState.body.purchases.find(item => item.id === purchase.id);
  assert.ok(saved, "Compra deve estar persistida em memoria.");
  assert.equal(saved.status, "reserved", "Item deve ficar reservado, nao vendido confirmado.");
  assert.equal(saved.paymentStatus, "pending", "Registro salvo deve continuar pending.");

  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const commissions = await json("/api/superadmin/commissions", {
    headers: {
      Authorization: `Bearer ${superToken}`,
      "x-forwarded-host": "admin.meudominio.com"
    }
  });
  assert.equal(commissions.response.status, 200, "Superadmin deve consultar comissoes.");
  const tenantCommission = commissions.body.byTenant.find(item => item.tenant_id === "tenant-cliente-a");
  assert.equal(tenantCommission?.paidRevenue || 0, 0, "Receita nao deve somar compra reservada.");
  assert.equal(tenantCommission?.platformCommission || 0, 0, "Comissao nao deve ser liberada sem pagamento.");

  console.log("PASS: cliente nao consegue criar modalidade paga pelo payload publico.");
} finally {
  server.kill();
}

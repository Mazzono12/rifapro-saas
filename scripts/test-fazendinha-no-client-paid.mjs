import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.TEST_FAZENDINHA_NO_CLIENT_PAID_PORT || (4400 + Math.floor(Math.random() * 1000)));
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
  SUPERADMIN_EMAIL: "superadmin.fazendinha-p0@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "test-fazendinha-no-client-paid-jwt-secret",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-fazendinha-no-client-paid-gateway-key"
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
  for (let attempt = 0; attempt < 180; attempt += 1) {
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
  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const gatewaySetup = await json("/api/admin/gateways", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${superToken}`,
      "x-forwarded-host": "cliente-a.meudominio.com"
    },
    body: JSON.stringify({
      active: "mock",
      pix: { enabled: true, sandbox: true },
      mock: { apiKey: "mock-only" }
    })
  });
  assert.equal(gatewaySetup.response.status, 200, `Gateway mock deve ser configurado apenas no teste: ${JSON.stringify(gatewaySetup.body)}`);

  const before = await json("/api/fazendinha");
  assert.equal(before.response.status, 200, "Fazendinha publica deve carregar.");
  const group = before.body.groups.find(item => item.status === "available");
  assert.ok(group, "Deve existir grupo disponivel para compra.");

  const buy = await json("/api/fazendinha/buy", {
    method: "POST",
    body: JSON.stringify({
      groupIds: [group.id],
      statusPagamento: "paid",
      paymentStatus: "paid",
      paid: true,
      confirmed: true,
      customer: {
        name: "Tentativa Fazendinha Paga",
        phone: "11952000001",
        cpf: "52000000001",
        accessPassword: "123456"
      }
    })
  });
  assert.equal(buy.response.status, 200, `Compra Fazendinha deve ser criada como reserva: ${JSON.stringify(buy.body)}`);
  const purchase = buy.body.purchase;
  assert.equal(purchase.statusPagamento, "reserved", "Payload publico nao pode marcar Fazendinha como paid.");
  assert.equal(purchase.paymentStatus, "pending", "paymentStatus publico deve nascer pending.");
  assert.equal(purchase.paidAt, null, "paidAt nao deve ser preenchido pelo cliente.");
  assert.equal(purchase.confirmedAt, null, "confirmedAt nao deve ser preenchido pelo cliente.");
  assert.equal(purchase.earnedLootboxes || 0, 0, "Lootbox nao deve ser liberada antes do pagamento.");
  assert.ok(buy.body.groups.every(item => item.status === "reserved"), "Grupo deve ficar reservado, nao vendido.");

  const after = await json("/api/fazendinha");
  const savedGroup = after.body.groups.find(item => item.id === group.id);
  const savedPurchase = after.body.purchases.find(item => item.id === purchase.id);
  assert.equal(savedGroup?.status, "reserved", "Animal deve ficar reservado, nao sold.");
  assert.equal(savedPurchase?.statusPagamento, "reserved", "Compra salva deve continuar reserved.");
  assert.equal(savedPurchase?.paymentStatus, "pending", "Compra salva deve continuar pending.");

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

  console.log("PASS: cliente nao consegue criar Fazendinha paga pelo payload publico.");
} finally {
  server.kill();
}

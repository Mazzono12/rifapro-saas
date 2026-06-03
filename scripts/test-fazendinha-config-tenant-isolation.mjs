import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.TEST_FAZENDINHA_CONFIG_TENANT_PORT || (7200 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
const hostA = "cliente-a.meudominio.com";
const hostB = "cliente-b.meudominio.com";
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
  SUPERADMIN_EMAIL: "superadmin.faz-config@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "test-fazendinha-config-tenant-isolation-jwt",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-fazendinha-config-tenant-isolation-gateway"
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
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      if (response.status >= 200) return;
    } catch {
      // Server is still starting.
    }
    await wait(100);
  }
  throw new Error(`Servidor de teste nao iniciou. Saida: ${serverOutput.slice(-2000)}`);
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

async function login(email, password, host = "admin.meudominio.com") {
  const { response, body } = await json("/api/auth/login", {
    method: "POST",
    headers: { "x-forwarded-host": host },
    body: JSON.stringify({ email, password })
  });
  assert.equal(response.status, 200, `Login falhou para ${email}: ${JSON.stringify(body)}`);
  return body.token;
}

async function createTenantAdmin(superToken, tenantId, email) {
  const { response, body } = await json("/api/superadmin/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${superToken}`,
      "x-forwarded-host": "admin.meudominio.com"
    },
    body: JSON.stringify({
      nome: `Admin ${tenantId}`,
      email,
      password: "SenhaTenant123!",
      role: "tenant_admin",
      tenant_id: tenantId
    })
  });
  assert.equal(response.status, 201, `Superadmin deve criar admin ${tenantId}: ${JSON.stringify(body)}`);
  return login(email, "SenhaTenant123!");
}

async function enablePix(headers) {
  const { response, body } = await json("/api/admin/gateways", {
    method: "PUT",
    headers,
    body: JSON.stringify({
      active: "mercadopago",
      pix: {
        enabled: true,
        gateway: "mercadopago",
        sandbox: true,
        apiKey: "sandbox-pix-key",
        webhookSecret: "faz-config-secret",
        webhookUrl: "/api/webhooks/payment/mercadopago"
      },
      mercadopago: {
        environment: "sandbox",
        accessToken: "",
        publicKey: "",
        webhookSecret: "faz-config-secret",
        webhookUrl: "/api/webhooks/payment/mercadopago",
        releaseStatus: "approved"
      }
    })
  });
  assert.equal(response.status, 200, `Gateway sandbox deve salvar: ${JSON.stringify(body)}`);
}

function customer(label) {
  const suffix = String(Math.floor(Math.random() * 900000) + 100000);
  return {
    name: `Cliente ${label} ${suffix}`,
    phone: `119${suffix.padStart(8, "0")}`.slice(0, 11),
    cpf: `92${suffix.padStart(9, "0")}`.slice(0, 11),
    accessPassword: "123456"
  };
}

async function publicFarm(host) {
  const result = await json("/api/fazendinha", { headers: { "x-forwarded-host": host } });
  assert.equal(result.response.status, 200, `Fazendinha publica deve carregar em ${host}: ${JSON.stringify(result.body)}`);
  return result.body;
}

async function buyFarm(host, groupId, label) {
  return json("/api/fazendinha/buy", {
    method: "POST",
    headers: { "x-forwarded-host": host },
    body: JSON.stringify({ groupIds: [groupId], customer: customer(label) })
  });
}

try {
  await waitForServer();

  const superToken = await login("superadmin.faz-config@test.local", "SenhaSuperadmin123!");
  const adminAToken = await createTenantAdmin(superToken, "tenant-cliente-a", "admin-faz-a@test.local");
  const adminBToken = await createTenantAdmin(superToken, "tenant-cliente-b", "admin-faz-b@test.local");
  const headersA = { Authorization: `Bearer ${adminAToken}`, "x-forwarded-host": hostA };
  const headersB = { Authorization: `Bearer ${adminBToken}`, "x-forwarded-host": hostB };

  await enablePix(headersA);
  await enablePix(headersB);

  const resetA = await json("/api/admin/fazendinha/reset", { method: "POST", headers: headersA });
  const resetB = await json("/api/admin/fazendinha/reset", { method: "POST", headers: headersB });
  assert.equal(resetA.response.status, 200, `Reset tenant A: ${JSON.stringify(resetA.body)}`);
  assert.equal(resetB.response.status, 200, `Reset tenant B: ${JSON.stringify(resetB.body)}`);

  const savedA = await json("/api/admin/fazendinha/config", {
    method: "PUT",
    headers: headersA,
    body: JSON.stringify({
      enabled: true,
      status: "active",
      name: "Fazendinha Tenant A",
      pricePerGroup: 7,
      mainPrize: "Premio isolado A",
      lootboxEnabled: false,
      lootboxConfig: { prizeName: "Caixinha A", prizeValue: 11 }
    })
  });
  assert.equal(savedA.response.status, 200, `Config tenant A deve salvar: ${JSON.stringify(savedA.body)}`);
  assert.equal(savedA.body.config.tenant_id, "tenant-cliente-a");
  assert.equal(savedA.body.config.pricePerGroup, 7);
  assert.equal(savedA.body.config.lootboxEnabled, false);

  const adminB = await json("/api/admin/fazendinha", { headers: headersB });
  assert.equal(adminB.response.status, 200, `Admin tenant B deve carregar: ${JSON.stringify(adminB.body)}`);
  assert.equal(adminB.body.config.tenant_id, "tenant-cliente-b");
  assert.notEqual(adminB.body.config.pricePerGroup, 7, "Preco do tenant A nao pode vazar para B.");
  assert.notEqual(adminB.body.config.mainPrize, "Premio isolado A", "Premio do tenant A nao pode vazar para B.");

  const publicA = await publicFarm(hostA);
  const publicB = await publicFarm(hostB);
  assert.equal(publicA.config.tenant_id, undefined, "Config publica nao deve expor tenant_id.");
  assert.equal(publicA.config.pricePerGroup, 7, "Checkout/publico A deve ler preco do tenant A.");
  assert.notEqual(publicB.config.pricePerGroup, 7, "Checkout/publico B deve manter preco proprio.");

  const buyA = await buyFarm(hostA, publicA.groups[0].id, "faz-a");
  assert.equal(buyA.response.status, 200, `Compra A deve usar config do tenant A: ${JSON.stringify(buyA.body)}`);
  assert.equal(buyA.body.purchase.valorPago, 7, "Compra publica A deve cobrar preco do tenant A.");

  const pausedA = await json("/api/admin/fazendinha/config", {
    method: "PUT",
    headers: headersA,
    body: JSON.stringify({ status: "paused" })
  });
  assert.equal(pausedA.response.status, 200, `Tenant A deve pausar: ${JSON.stringify(pausedA.body)}`);

  const blockedA = await buyFarm(hostA, publicA.groups[1].id, "faz-a-paused");
  assert.equal(blockedA.response.status, 403, "Tenant A pausado deve bloquear checkout.");

  const freshB = await publicFarm(hostB);
  const buyB = await buyFarm(hostB, freshB.groups[0].id, "faz-b");
  assert.equal(buyB.response.status, 200, `Tenant B deve continuar ativo e isolado: ${JSON.stringify(buyB.body)}`);
  assert.notEqual(buyB.body.purchase.valorPago, 7, "Compra B nao pode usar preco do tenant A.");

  console.log("PASS: fazendinha-config-tenant-isolation validou config, admin e checkout isolados por tenant.");
} finally {
  server.kill("SIGTERM");
}

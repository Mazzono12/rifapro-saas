import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.PORT || (3128 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  SUPABASE_URL: "http://127.0.0.1:54321",
  VITE_SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: "tenantScopeSupabaseRoleValueForHardeningSuite20260604",
  SUPABASE_SERVICE_KEY: "tenantScopeSupabaseRoleValueForHardeningSuite20260604",
  SUPERADMIN_EMAIL: "superadmin.scope@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  PUBLIC_BASE_URL: baseUrl,
  ADMIN_BASE_URL: baseUrl,
  STORAGE_DRIVER: "persistent",
  JWT_SECRET: "tenantScopeJwtValueForHardeningSuite20260604",
  SESSION_SECRET: "tenantScopeSessionValueForHardeningSuite20260604",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "tenantScopeGatewayValueForHardeningSuite20260604"
};

const server = spawn(process.execPath, ["dist/server.js"], {
  cwd: process.cwd(),
  env,
  stdio: ["ignore", "pipe", "pipe"]
});
let serverOutput = "";
server.stdout.on("data", chunk => { serverOutput += chunk.toString(); });
server.stderr.on("data", chunk => { serverOutput += chunk.toString(); });

async function waitForServer() {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      if (response.status > 0) return;
    } catch {
      // Server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor de teste nao iniciou a tempo.\n${serverOutput.slice(-2000)}`);
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
      status: "active",
      pixConfig: {
        inheritGlobal: false,
        enabled: true,
        gateway: "mock",
        sandbox: false,
        apiKey: "mock-only"
      }
    })
  });
  assert.equal(response.status, 200, `Tenant admin deve criar rifa ${title}.`);
  return body;
}

async function buyRaffle(tenantSlug, raffleId, markerPhone, name, cpf) {
  const { response, body } = await json(`/api/raffles/${raffleId}/buy`, {
    method: "POST",
    headers: { "x-forwarded-host": `${tenantSlug}.test.local` },
    body: JSON.stringify({
      tickets: 2,
      contact: markerPhone,
      customer: {
        name,
        phone: markerPhone,
        cpf,
        accessPassword: "123456",
        city: tenantSlug
      }
    })
  });
  assert.equal(response.status, 200, `Compra PIX deve ser criada para ${tenantSlug}.`);
  return body;
}

function assertOnlyTenantData(label, items, ownTenantId, otherTenantId, ownMarker, otherMarker) {
  assert.ok(items.length > 0, `${label} deve retornar dados do proprio tenant.`);
  assert.ok(items.every(item => item.tenant_id === ownTenantId), `${label} deve conter apenas ${ownTenantId}.`);
  const serialized = JSON.stringify(items);
  assert.match(serialized, new RegExp(ownMarker), `${label} deve conter marcador proprio.`);
  assert.doesNotMatch(serialized, new RegExp(otherTenantId), `${label} nao deve conter tenant oposto.`);
  assert.doesNotMatch(serialized, new RegExp(otherMarker), `${label} nao deve conter marcador oposto.`);
}

try {
  await waitForServer();

  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const superHeaders = { Authorization: `Bearer ${superToken}` };
  const updateTenantB = await request("/api/superadmin/tenants/tenant-cliente-b", {
    method: "PUT",
    headers: superHeaders,
    body: JSON.stringify({
      nome: "Cliente B",
      slug: "cliente-b",
      dominio_customizado: "sorteios.cliente-b.test",
      percentual_plataforma: 10
    })
  });
  assert.equal(updateTenantB.status, 200, "Superadmin deve configurar dominio proprio do cliente-b.");

  const tokenA = await createTenantAdmin(superHeaders, "tenant-cliente-a", "admin.cliente-a.scope@test.local");
  const tokenB = await createTenantAdmin(superHeaders, "tenant-cliente-b", "admin.cliente-b.scope@test.local");
  const headersA = { Authorization: `Bearer ${tokenA}` };
  const headersB = { Authorization: `Bearer ${tokenB}` };

  const raffleA = await createRaffle(headersA, "Rifa Exclusiva Cliente A");
  const raffleB = await createRaffle(headersB, "Rifa Exclusiva Cliente B");
  await buyRaffle("cliente-a", raffleA.id, "11911111111", "Comprador Cliente A", "11111111111");
  await buyRaffle("cliente-b", raffleB.id, "11922222222", "Comprador Cliente B", "22222222222");

  const publicA = await json("/api/raffles", { headers: { "x-forwarded-host": "cliente-a.meudominio.com" } });
  const publicB = await json("/api/raffles", { headers: { "x-forwarded-host": "cliente-b.meudominio.com" } });
  const publicCustomB = await json("/api/raffles", { headers: { "x-forwarded-host": "sorteios.cliente-b.test" } });
  assert.equal(publicA.response.status, 200, "Subdominio cliente-a deve resolver tenant cliente-a.");
  assert.equal(publicB.response.status, 200, "Subdominio cliente-b deve resolver tenant cliente-b.");
  assert.equal(publicCustomB.response.status, 200, "Dominio proprio deve resolver por tenants.dominio_customizado.");
  assert.ok(publicA.body.every(item => item.tenant_id === "tenant-cliente-a"), "cliente-a.meudominio.com deve listar apenas cliente-a.");
  assert.ok(publicB.body.every(item => item.tenant_id === "tenant-cliente-b"), "cliente-b.meudominio.com deve listar apenas cliente-b.");
  assert.ok(publicCustomB.body.every(item => item.tenant_id === "tenant-cliente-b"), "dominio proprio deve listar apenas cliente-b.");

  const missingTenant = await request("/api/raffles", { headers: { "x-forwarded-host": "inexistente.meudominio.com" } });
  assert.equal(missingTenant.status, 404, "Dominio inexistente deve retornar 404.");

  const adminHost = await request("/", { headers: { "x-forwarded-host": "admin.meudominio.com" }, redirect: "manual" });
  assert.equal(adminHost.status, 302, "admin.meudominio.com deve abrir o superadmin.");
  assert.equal(adminHost.headers.get("location"), "/superadmin");

  await json("/api/admin/winners", {
    method: "POST",
    headers: headersA,
    body: JSON.stringify({ raffleName: "Rifa Exclusiva Cliente A", winnerName: "Ganhador Cliente A", prizeDescription: "Premio A", mediaUrl: "", mediaType: "image" })
  });
  await json("/api/admin/winners", {
    method: "POST",
    headers: headersB,
    body: JSON.stringify({ raffleName: "Rifa Exclusiva Cliente B", winnerName: "Ganhador Cliente B", prizeDescription: "Premio B", mediaUrl: "", mediaType: "image" })
  });

  await json("/api/admin/settings", {
    method: "PUT",
    headers: headersA,
    body: JSON.stringify({ branding: { companyName: "Config Cliente A" } })
  });
  await json("/api/admin/settings", {
    method: "PUT",
    headers: headersB,
    body: JSON.stringify({ branding: { companyName: "Config Cliente B" } })
  });
  await json("/api/admin/gateways", {
    method: "PUT",
    headers: headersA,
    body: JSON.stringify({ pix: { apiKey: "pix-key-cliente-a" } })
  });
  await json("/api/admin/gateways", {
    method: "PUT",
    headers: headersB,
    body: JSON.stringify({ pix: { apiKey: "pix-key-cliente-b" } })
  });

  const rafflesA = await json("/api/admin/raffles", { headers: headersA });
  const rafflesB = await json("/api/admin/raffles", { headers: headersB });
  assertOnlyTenantData("Rifas cliente-a", rafflesA.body, "tenant-cliente-a", "tenant-cliente-b", "Cliente A", "Cliente B");
  assertOnlyTenantData("Rifas cliente-b", rafflesB.body, "tenant-cliente-b", "tenant-cliente-a", "Cliente B", "Cliente A");

  const supportStart = await json("/api/superadmin/tenants/tenant-cliente-a/impersonate/start", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({ reason: "Auditoria multitenant de isolamento do modo suporte" })
  });
  assert.equal(supportStart.response.status, 201, `Superadmin deve iniciar suporte: ${JSON.stringify(supportStart.body)}`);
  assert.ok(supportStart.body.session?.id, `Sessao de suporte deve retornar id: ${JSON.stringify(supportStart.body)}`);
  const supportHeaders = {
    Authorization: `Bearer ${superToken}`,
    "X-Support-Session-Id": supportStart.body.session.id
  };
  const supportRaffles = await json("/api/admin/raffles", { headers: supportHeaders });
  assert.equal(supportRaffles.response.status, 200, `Modo suporte deve listar rifas tenant-scoped: ${JSON.stringify(supportRaffles.body)}`);
  assertOnlyTenantData("Rifas suporte cliente-a", supportRaffles.body, "tenant-cliente-a", "tenant-cliente-b", "Cliente A", "Cliente B");

  const purchasesA = await json("/api/admin/purchases", { headers: headersA });
  const purchasesB = await json("/api/admin/purchases", { headers: headersB });
  assertOnlyTenantData("Compras/PIX cliente-a", purchasesA.body, "tenant-cliente-a", "tenant-cliente-b", "Comprador Cliente A", "Comprador Cliente B");
  assertOnlyTenantData("Compras/PIX cliente-b", purchasesB.body, "tenant-cliente-b", "tenant-cliente-a", "Comprador Cliente B", "Comprador Cliente A");

  const accountingCrossA = await request(`/api/admin/raffles/${raffleB.id}/accounting`, { headers: headersA });
  const accountingCrossB = await request(`/api/admin/raffles/${raffleA.id}/accounting`, { headers: headersB });
  assert.equal(accountingCrossA.status, 404, "cliente-a nao acessa relatorio/contabilidade da rifa do cliente-b.");
  assert.equal(accountingCrossB.status, 404, "cliente-b nao acessa relatorio/contabilidade da rifa do cliente-a.");

  const settingsA = await json("/api/settings", { headers: headersA });
  const settingsB = await json("/api/settings", { headers: headersB });
  assert.equal(settingsA.body.branding.companyName, "Config Cliente A");
  assert.equal(settingsB.body.branding.companyName, "Config Cliente B");

  const gatewaysA = await json("/api/admin/gateways", { headers: headersA });
  const gatewaysB = await json("/api/admin/gateways", { headers: headersB });
  assert.notEqual(gatewaysA.body.pix.apiKey, "pix-key-cliente-a");
  assert.notEqual(gatewaysB.body.pix.apiKey, "pix-key-cliente-b");
  assert.match(gatewaysA.body.pix.apiKey, /\*+.*te-a$/);
  assert.match(gatewaysB.body.pix.apiKey, /\*+.*te-b$/);

  const forbidden = await request("/api/superadmin/overview", { headers: headersA });
  assert.equal(forbidden.status, 403, "admin comum nao acessa superadmin.");

  console.log("PASS: cliente-a e cliente-b veem apenas seus dados; admin comum recebe 403 em /api/superadmin.");
} finally {
  server.kill();
}

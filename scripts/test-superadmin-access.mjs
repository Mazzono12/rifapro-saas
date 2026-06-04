import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.PORT || (3127 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  SUPABASE_URL: "http://127.0.0.1:54321",
  VITE_SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: "superadminAccessSupabaseRoleValueForHardeningSuite20260604",
  SUPABASE_SERVICE_KEY: "superadminAccessSupabaseRoleValueForHardeningSuite20260604",
  SUPERADMIN_EMAIL: "superadmin.access@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  PUBLIC_BASE_URL: baseUrl,
  ADMIN_BASE_URL: baseUrl,
  STORAGE_DRIVER: "persistent",
  JWT_SECRET: "superadminAccessJwtValueForHardeningSuite20260604",
  SESSION_SECRET: "superadminAccessSessionValueForHardeningSuite20260604",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "superadminAccessGatewayValueForHardeningSuite20260604"
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

async function login(email, password) {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  assert.equal(response.status, 200, `Login falhou para ${email}`);
  return (await response.json()).token;
}

try {
  await waitForServer();

  const unauthenticated = await request("/api/superadmin/overview");
  assert.equal(unauthenticated.status, 401, "Area superadmin exige autenticacao.");

  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const superHeaders = { Authorization: `Bearer ${superToken}` };
  const overview = await request("/api/superadmin/overview", { headers: superHeaders });
  assert.equal(overview.status, 200, "Superadmin deve consultar visao global.");

  const createdTenantResponse = await request("/api/superadmin/tenants", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({
      nome: "Cliente Protegido",
      slug: "cliente-protegido",
      plano: "pro",
      percentual_plataforma: 7.5
    })
  });
  assert.equal(createdTenantResponse.status, 201, "Superadmin deve criar tenant.");
  const createdTenant = await createdTenantResponse.json();

  const updatedTenantResponse = await request(`/api/superadmin/tenants/${createdTenant.id}`, {
    method: "PUT",
    headers: superHeaders,
    body: JSON.stringify({ nome: "Cliente Protegido Editado", slug: "cliente-protegido", percentual_plataforma: 8 })
  });
  assert.equal(updatedTenantResponse.status, 200, "Superadmin deve editar tenant.");

  const suspendedResponse = await request(`/api/superadmin/tenants/${createdTenant.id}/status`, {
    method: "PATCH",
    headers: superHeaders,
    body: JSON.stringify({ status: "suspended" })
  });
  assert.equal(suspendedResponse.status, 200, "Superadmin deve suspender tenant.");
  assert.equal((await suspendedResponse.json()).status, "suspended");

  const createAdmin = await request("/api/superadmin/users", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({
      nome: "Admin Cliente A",
      email: "tenant.admin@test.local",
      password: "SenhaTenant123!",
      role: "tenant_admin",
      tenant_id: "tenant-cliente-a"
    })
  });
  assert.equal(createAdmin.status, 201, "Superadmin deve criar administrador de tenant.");

  const tenantToken = await login("tenant.admin@test.local", "SenhaTenant123!");
  const tenantHeaders = { Authorization: `Bearer ${tenantToken}` };
  for (const endpoint of [
    "/api/superadmin/overview",
    "/api/superadmin/tenants",
    "/api/superadmin/raffles",
    "/api/superadmin/sales",
    "/api/superadmin/commissions",
    "/api/superadmin/payments/pix"
  ]) {
    const response = await request(endpoint, { headers: tenantHeaders });
    assert.equal(response.status, 403, `Tenant admin nao pode acessar ${endpoint}.`);
  }

  console.log("PASS: superadmin acessa e administra tenants; tenant_admin recebe 403 em /api/superadmin/*.");
} finally {
  server.kill();
}

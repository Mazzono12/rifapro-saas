import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const serverSource = readFileSync("server.ts", "utf8");
const appSource = readFileSync("src/App.tsx", "utf8");
const navbarSource = readFileSync("src/components/Navbar.tsx", "utf8");
const raffleSource = readFileSync("src/pages/RaffleDetails.tsx", "utf8");
const adminConfigSource = readFileSync("src/pages/admin/AdminConfig.tsx", "utf8");
const adminLayoutSource = readFileSync("src/pages/admin/AdminLayout.tsx", "utf8");
const migration = readFileSync("supabase/migrations/23_tenant_branding_settings.sql", "utf8");

for (const endpoint of [
  "/api/admin/branding",
  "/api/admin/branding/logo",
  "/api/admin/branding/favicon",
  "/api/admin/branding/reset",
  "/api/superadmin/tenants/:tenantId/branding",
  "/api/superadmin/tenants/:tenantId/branding/logo",
  "/api/superadmin/tenants/:tenantId/branding/favicon",
  "/api/superadmin/tenants/:tenantId/branding/reset",
  "/api/public/branding"
]) {
  assert.match(serverSource, new RegExp(endpoint.replace(/[/:]/g, match => match === "/" ? "\\/" : match === ":" ? ":" : "\\:")), `Endpoint ${endpoint} deve existir`);
}

assert.match(migration, /create table if not exists public\.tenant_branding_settings/i, "Migration cria tenant_branding_settings");
assert.match(migration, /unique \(tenant_id\)/i, "tenant_id deve ser unico");
assert.match(migration, /enable row level security/i, "RLS deve estar ativo");
assert.match(migration, /tenant-assets/i, "Bucket tenant-assets deve estar preparado");
assert.match(serverSource, /publicTenantBranding/, "Resposta publica deve ser sanitizada");
assert.doesNotMatch(serverSource.match(/app\.get\("\/api\/public\/branding"[\s\S]+?\n  \}\);/)?.[0] || "", /service|secret|senha_hash/i, "Branding publico nao deve expor segredos");
assert.match(appSource, /TenantBrandingProvider/, "App deve carregar provider de branding");
assert.match(navbarSource, /TenantLogo/, "Header publico deve usar TenantLogo");
assert.match(raffleSource, /TenantHeaderName/, "Pagina da rifa deve usar nome do tenant");
assert.match(adminConfigSource, /BrandingSettingsForm/, "Admin tenant deve ter tela de aparencia");
assert.match(adminLayoutSource, /Aparência|Aparencia/, "Admin layout deve expor Aparencia");

const port = Number(process.env.PORT || (4240 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  SUPERADMIN_EMAIL: "superadmin.branding@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "tenant-branding-jwt-secret-long-value",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "tenant-branding-gateway-credentials-key"
};

const server = spawn(process.execPath, ["dist/server.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/public/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Servidor de branding nao iniciou.");
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

try {
  await waitForServer();
  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const superHeaders = { Authorization: `Bearer ${superToken}` };
  const createAdmin = await json("/api/superadmin/tenants/tenant-cliente-a/admins", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({ nome: "Admin Branding A", email: "admin.branding.a@test.local", password: "SenhaTenant123!" })
  });
  assert.equal(createAdmin.response.status, 201, "Superadmin cria admin do tenant");
  const tenantToken = await login("admin.branding.a@test.local", "SenhaTenant123!");
  const tenantHeaders = { Authorization: `Bearer ${tenantToken}` };

  const updateTenant = await json("/api/admin/branding", {
    method: "PUT",
    headers: tenantHeaders,
    body: JSON.stringify({ header_name: "Marca Tenant A", primary_color: "#00d66b", secondary_color: "#0f2d1d", cta_color: "#22c55e", slogan: "Tenant A premium" })
  });
  assert.equal(updateTenant.response.status, 200, "Tenant admin altera proprio branding");
  assert.equal(updateTenant.body.header_name, "Marca Tenant A");

  const publicBranding = await json("/api/public/branding", { headers: { "x-forwarded-host": "cliente-a.meudominio.com" } });
  assert.equal(publicBranding.response.status, 200, "Branding publico carrega por dominio do tenant");
  assert.equal(publicBranding.body.header_name, "Marca Tenant A");
  assert.deepEqual(Object.keys(publicBranding.body).sort(), ["colors", "favicon_url", "footer_text", "header_name", "logo_mime_type", "logo_url", "slogan", "support_whatsapp", "theme_mode"].sort());

  const crossTenant = await json("/api/superadmin/tenants/tenant-cliente-b/branding", { method: "PUT", headers: tenantHeaders, body: JSON.stringify({ header_name: "Ataque" }) });
  assert.equal(crossTenant.response.status, 403, "Admin tenant nao altera outro tenant via superadmin");

  const superUpdate = await json("/api/superadmin/tenants/tenant-cliente-b/branding", { method: "PUT", headers: superHeaders, body: JSON.stringify({ header_name: "Marca Tenant B" }) });
  assert.equal(superUpdate.response.status, 200, "Superadmin altera qualquer tenant");
  assert.equal(superUpdate.body.header_name, "Marca Tenant B");

  console.log("PASS: branding por tenant, publico seguro, admin proprio e superadmin validados.");
} finally {
  server.kill();
}

import assert from "node:assert/strict";
import { createServer } from "node:net";
import { spawn } from "node:child_process";

async function findAvailablePort() {
  if (process.env.PORT) return Number(process.env.PORT);
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

const port = await findAvailablePort();
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  SUPERADMIN_EMAIL: "superadmin.tenant-admins@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuper123!",
  JWT_SECRET: "test-superadmin-tenant-admins-secret",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-superadmin-tenant-admins-gateway-key"
};
const server = spawn(process.execPath, ["dist/server.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
let serverOutput = "";
server.stdout.on("data", chunk => { serverOutput += chunk.toString(); });
server.stderr.on("data", chunk => { serverOutput += chunk.toString(); });

async function wait() {
  for (let i = 0; i < 120; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      if (response.status > 0) return;
    } catch {
      // Server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor nao iniciou.\n${serverOutput.slice(-2000)}`);
}

async function json(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  return { response, body: await response.json().catch(() => ({})) };
}

async function login(email, password) {
  const { response, body } = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  assert.equal(response.status, 200, `Login falhou para ${email}: ${JSON.stringify(body)}`);
  return body.token;
}

function assertNoSecrets(body, label) {
  const serialized = JSON.stringify(body);
  assert.ok(!/senha_hash|passwordHash|token|access_token|refresh_token|oldPassword|senhaAtual/i.test(serialized), `${label} nao deve expor senha/hash/token`);
}

try {
  await wait();
  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const superHeaders = { Authorization: `Bearer ${superToken}` };

  const usersBefore = await json("/api/superadmin/users", { headers: superHeaders });
  assert.equal(usersBefore.response.status, 200);
  const superadmin = usersBefore.body.find(user => user.role === "superadmin");
  assert.ok(superadmin?.id, "Superadmin deve existir para validar protecao contra edicao como admin tenant.");

  const createdTenant = await json("/api/superadmin/tenants", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({
      nome: "Cliente Com Admin Inicial",
      slug: "cliente-admin-inicial",
      plano: "pro",
      status: "active",
      admin: {
        nome: "Admin Inicial",
        email: "admin.inicial@test.local",
        password: "SenhaInicial123!"
      }
    })
  });
  assert.equal(createdTenant.response.status, 201, `Criacao de tenant com admin inicial deve funcionar: ${JSON.stringify(createdTenant.body)}`);
  assert.equal(createdTenant.body.admin.admin.tenant_id, createdTenant.body.id, "Admin inicial deve receber tenant_id correto.");
  assert.equal(createdTenant.body.admin.admin.email, "admin.inicial@test.local");
  assert.equal(createdTenant.body.admin.temporaryPassword, "SenhaInicial123!", "Senha temporaria deve ser retornada somente na criacao.");
  assertNoSecrets(createdTenant.body.admin.admin, "admin inicial sanitizado");
  await login("admin.inicial@test.local", createdTenant.body.admin.temporaryPassword);

  const initialAdmins = await json(`/api/superadmin/tenants/${createdTenant.body.id}/admins`, { headers: superHeaders });
  assert.equal(initialAdmins.response.status, 200);
  assert.ok(initialAdmins.body.some(admin => admin.email === "admin.inicial@test.local"), "Admin inicial deve aparecer no detalhe/lista do tenant.");
  assert.ok(!JSON.stringify(initialAdmins.body).includes("temporaryPassword"), "Listagem nao deve reexibir senha temporaria.");

  const usersAfterInitial = await json("/api/superadmin/users", { headers: superHeaders });
  assert.equal(usersAfterInitial.response.status, 200);
  assert.ok(!JSON.stringify(usersAfterInitial.body).includes("temporaryPassword"), "Usuarios globais nao devem reexibir senha temporaria.");

  const duplicateInitialAdmin = await json("/api/superadmin/tenants", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({
      nome: "Cliente Email Duplicado",
      slug: "cliente-email-duplicado-admin",
      plano: "pro",
      admin: {
        nome: "Admin Duplicado",
        email: "admin.inicial@test.local",
        password: "SenhaInicial123!"
      }
    })
  });
  assert.equal(duplicateInitialAdmin.response.status, 400, "Email do admin inicial deve ser unico.");

  const createA = await json("/api/superadmin/tenants/tenant-cliente-a/admins", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({ nome: "Admin Cliente A", email: "admin.tenant-a@test.local", password: "SenhaTenantA123!", role: "tenant_admin" })
  });
  assert.equal(createA.response.status, 201, `Superadmin deve criar admin A: ${JSON.stringify(createA.body)}`);
  assert.equal(createA.body.admin.tenant_id, "tenant-cliente-a");
  assertNoSecrets(createA.body.admin, "admin criado");

  const createB = await json("/api/superadmin/tenants/tenant-cliente-b/admins", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({ nome: "Admin Cliente B", email: "admin.tenant-b@test.local", password: "SenhaTenantB123!", role: "tenant_admin" })
  });
  assert.equal(createB.response.status, 201, `Superadmin deve criar admin B: ${JSON.stringify(createB.body)}`);
  assert.equal(createB.body.admin.tenant_id, "tenant-cliente-b");

  const listA = await json("/api/superadmin/tenants/tenant-cliente-a/admins", { headers: superHeaders });
  const listB = await json("/api/superadmin/tenants/tenant-cliente-b/admins", { headers: superHeaders });
  assert.equal(listA.response.status, 200);
  assert.equal(listB.response.status, 200);
  assert.ok(listA.body.some(admin => admin.email === "admin.tenant-a@test.local"), "cliente-a lista seu admin");
  assert.ok(!listA.body.some(admin => admin.email === "admin.tenant-b@test.local"), "cliente-a nao lista admin do cliente-b");
  assert.ok(listB.body.some(admin => admin.email === "admin.tenant-b@test.local"), "cliente-b lista seu admin");
  assert.ok(!listB.body.some(admin => admin.email === "admin.tenant-a@test.local"), "cliente-b nao lista admin do cliente-a");

  const updated = await json(`/api/superadmin/tenants/tenant-cliente-a/admins/${createA.body.admin.id}`, {
    method: "PATCH",
    headers: superHeaders,
    body: JSON.stringify({ nome: "Admin Cliente A Editado", email: "admin.tenant-a.editado@test.local" })
  });
  assert.equal(updated.response.status, 200, `Superadmin deve alterar email do admin A: ${JSON.stringify(updated.body)}`);
  assert.equal(updated.body.admin.email, "admin.tenant-a.editado@test.local");
  assert.equal(updated.body.admin.tenant_id, "tenant-cliente-a");

  const crossTenantEdit = await json(`/api/superadmin/tenants/tenant-cliente-a/admins/${createB.body.admin.id}`, {
    method: "PATCH",
    headers: superHeaders,
    body: JSON.stringify({ email: "admin-b-ataque@test.local" })
  });
  assert.equal(crossTenantEdit.response.status, 404, "Superadmin nao deve editar admin de outro tenant pela URL errada.");

  const duplicateEmail = await json(`/api/superadmin/tenants/tenant-cliente-a/admins/${createA.body.admin.id}`, {
    method: "PATCH",
    headers: superHeaders,
    body: JSON.stringify({ email: "admin.tenant-b@test.local" })
  });
  assert.equal(duplicateEmail.response.status, 409, "Alteracao de email deve validar unicidade global.");

  const disabled = await json(`/api/superadmin/tenants/tenant-cliente-a/admins/${createA.body.admin.id}`, {
    method: "PATCH",
    headers: superHeaders,
    body: JSON.stringify({ ativo: false })
  });
  assert.equal(disabled.response.status, 200);
  assert.equal(disabled.body.admin.ativo, false, "Ativar/desativar deve afetar o admin do tenant.");

  const enabled = await json(`/api/superadmin/tenants/tenant-cliente-a/admins/${createA.body.admin.id}`, {
    method: "PATCH",
    headers: superHeaders,
    body: JSON.stringify({ ativo: true })
  });
  assert.equal(enabled.response.status, 200);
  assert.equal(enabled.body.admin.ativo, true);

  const reset = await json(`/api/superadmin/tenants/tenant-cliente-a/admins/${createA.body.admin.id}/reset-password`, {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({})
  });
  assert.equal(reset.response.status, 200, `Reset deve funcionar: ${JSON.stringify(reset.body)}`);
  assert.ok(reset.body.temporaryPassword?.length >= 8, "Reset deve retornar senha temporaria nova.");
  assertNoSecrets(reset.body, "reset de senha");
  await login("admin.tenant-a.editado@test.local", reset.body.temporaryPassword);

  const editSuperadminAsTenantAdmin = await json(`/api/superadmin/tenants/tenant-cliente-a/admins/${superadmin.id}`, {
    method: "PATCH",
    headers: superHeaders,
    body: JSON.stringify({ email: "superadmin.editado@test.local" })
  });
  assert.equal(editSuperadminAsTenantAdmin.response.status, 404, "Superadmin nao pode ser editado como admin de tenant.");

  const supportStart = await json("/api/superadmin/tenants/tenant-cliente-a/impersonate/start", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({ reason: "Suporte solicitado pelo cliente para revisar administradores" })
  });
  assert.equal(supportStart.response.status, 201, "Acesso assistido deve continuar funcionando.");
  const supportEnd = await json("/api/superadmin/impersonate/end", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({ sessionId: supportStart.body.session.id })
  });
  assert.equal(supportEnd.response.status, 200, "Saida do acesso assistido deve continuar funcionando.");
  const logs = await json("/api/superadmin/audit-logs", { headers: superHeaders });
  assert.ok(logs.body.some(log => log.action === "IMPERSONATION_START" && log.resource_id === supportStart.body.session.id), "Inicio do acesso assistido deve ser auditado.");
  assert.ok(logs.body.some(log => log.action === "IMPERSONATION_END" && log.resource_id === supportStart.body.session.id), "Saida do acesso assistido deve ser auditada.");
  assert.ok(logs.body.some(log => log.action === "TENANT_ADMIN_UPDATED" && log.resource_id === createA.body.admin.id), "Edicao de admin deve ser auditada.");
  assert.ok(logs.body.some(log => log.action === "TENANT_ADMIN_PASSWORD_RESET" && log.resource_id === createA.body.admin.id), "Reset de senha deve ser auditado.");

  console.log("PASS: gestao de administradores por tenant, isolamento, reset seguro e acesso assistido auditado.");
} finally {
  server.kill();
}

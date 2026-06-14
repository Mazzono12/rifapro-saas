import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const port = Number(process.env.PORT || (3860 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  SUPERADMIN_EMAIL: "superadmin.plan@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  PUBLIC_BASE_URL: baseUrl,
  ADMIN_BASE_URL: baseUrl,
  STORAGE_DRIVER: "memory",
  RIFAPRO_TEST_MODE: "hard",
  JWT_SECRET: "superadminPlanPersistenceJwtValueForHardening20260604",
  SESSION_SECRET: "superadminPlanPersistenceSessionValueForHardening20260604",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "superadminPlanPersistenceGatewayValueForHardening20260604"
};

const expectedPlans = [
  ["starter", "Básico"],
  ["pro", "Profissional"],
  ["premium", "Premium"],
  ["enterprise", "Empresa"],
  ["white-label", "White Label"]
];

const serverSource = readFileSync("server.ts", "utf8");
const planResourcesSource = readFileSync("src/pages/superadmin/SuperAdminTenantPlanResources.tsx", "utf8");
const clientsSource = readFileSync("src/pages/superadmin/SuperAdminClients.tsx", "utf8");

assert.ok(serverSource.includes('app.put("/api/superadmin/tenants/:tenantId/plan"'), "Endpoint de troca de plano deve existir.");
assert.ok(serverSource.includes('supabaseAdmin.from("tenants").update'), "Troca de plano deve persistir na tabela tenants quando Supabase estiver configurado.");
assert.ok(serverSource.includes("persistTenantPlanRecord"), "Troca de plano deve aguardar persistencia antes da resposta.");
assert.ok(planResourcesSource.includes("body: JSON.stringify({ planId, status, reason })"), "Plano e Recursos deve enviar planId interno.");
assert.ok(planResourcesSource.includes("value={plan.id}") && planResourcesSource.includes("formatPlanName(plan)"), "Select de Plano e Recursos deve usar ID interno e label comercial.");
assert.ok(clientsSource.includes("value={form.plano}") && clientsSource.includes("formatPlanName(plan)"), "Edição de cliente deve usar ID interno e label comercial.");

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
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function assertPlanPayload(payload, planId, context) {
  assert.equal(payload.plan?.id, planId, `${context}: plan.id deve persistir como ID interno ${planId}.`);
  assert.equal(payload.tenant?.plano, planId, `${context}: tenant.plano deve persistir como ID interno ${planId}.`);
  assert.equal(payload.plan?.nome, expectedPlans.find(([id]) => id === planId)?.[1], `${context}: nome comercial deve ser exibido.`);
}

try {
  await waitForServer();

  const login = await json("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: env.SUPERADMIN_EMAIL, password: env.SUPERADMIN_PASSWORD })
  });
  assert.equal(login.response.status, 200, "Login superadmin deve funcionar.");
  const headers = { Authorization: `Bearer ${login.body.token}` };

  const plans = await json("/api/superadmin/plans", { headers });
  assert.equal(plans.response.status, 200, "Catalogo de planos deve carregar.");
  assert.deepEqual(plans.body.map(plan => plan.id), expectedPlans.map(([id]) => id), "Catalogo visual deve manter IDs internos canonicos.");
  assert.deepEqual(plans.body.map(plan => plan.nome), expectedPlans.map(([, name]) => name), "Catalogo visual deve exibir apenas nomes comerciais.");

  const created = await json("/api/superadmin/tenants", {
    method: "POST",
    headers,
    body: JSON.stringify({
      nome: "Cliente Plano Persistente",
      slug: `cliente-plano-${port}`,
      plano: "starter",
      percentual_plataforma: 7.5,
      admin: { nome: "Admin Plano Inicial", email: `admin.plano.${port}@test.local`, password: "SenhaTenant123!" }
    })
  });
  assert.equal(created.response.status, 201, "Superadmin deve criar tenant com plano Basico.");
  assert.equal(created.body.plano, "starter", "Tenant inicial deve salvar Basico como starter.");

  for (const [planId] of expectedPlans.slice(1)) {
    const updated = await json(`/api/superadmin/tenants/${created.body.id}/plan`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ planId, status: "active", reason: `Teste hard ${planId}` })
    });
    assert.equal(updated.response.status, 200, `Troca para ${planId} deve retornar 200.`);
    assertPlanPayload(updated.body, planId, `PUT ${planId}`);

    const reloaded = await json(`/api/superadmin/tenants/${created.body.id}/plan`, { headers });
    assert.equal(reloaded.response.status, 200, `Reload do plano ${planId} deve retornar 200.`);
    assertPlanPayload(reloaded.body, planId, `GET apos ${planId}`);

    const overview = await json("/api/superadmin/overview", { headers });
    assert.equal(overview.response.status, 200, `Overview apos ${planId} deve retornar 200.`);
    const listedTenant = overview.body.tenants.find(tenant => tenant.id === created.body.id);
    assert.ok(listedTenant, "Tenant alterado deve aparecer na listagem sem recarga manual do servidor.");
    assert.equal(listedTenant.plano, planId, `Listagem deve refletir ${planId}.`);
    assert.equal(listedTenant.plan?.id, planId, `Listagem deve carregar plan.id ${planId}.`);
  }

  for (const [alias, canonical] of [["gratis", "starter"], ["profissional", "pro"], ["marca branca", "white-label"]]) {
    const updated = await json(`/api/superadmin/tenants/${created.body.id}/plan`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ planId: alias, status: "active", reason: `Teste alias ${alias}` })
    });
    assert.equal(updated.response.status, 200, `Alias interno ${alias} deve continuar aceito.`);
    assertPlanPayload(updated.body, canonical, `Alias ${alias}`);
  }

  console.log("PASS: troca de plano pelo Superadmin persiste IDs internos e exibe nomes comerciais.");
} finally {
  server.kill();
}

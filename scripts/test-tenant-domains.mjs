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
const env = { ...process.env, PORT: String(port), NODE_ENV: "production", RIFAPRO_TEST_MODE: "true", SUPABASE_URL: "", VITE_SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", SUPABASE_SERVICE_KEY: "", SUPERADMIN_EMAIL: "superadmin.domains@test.local", SUPERADMIN_PASSWORD: "SenhaSuper123!", JWT_SECRET: "test-tenant-domains-secret-long-value", GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-tenant-domains-gateway-key" };
const server = spawn(process.execPath, ["dist/server.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
let serverOutput = "";
server.stdout.on("data", chunk => { serverOutput += chunk.toString(); });
server.stderr.on("data", chunk => { serverOutput += chunk.toString(); });
async function wait() { for (let i = 0; i < 100; i++) { try { const r = await fetch(`${baseUrl}/api/public/health`); if (r.status === 200) return; } catch {} await new Promise(r => setTimeout(r, 100)); } throw new Error(`Servidor nao iniciou\n${serverOutput.slice(-2000)}`); }
async function json(path, options = {}) { const res = await fetch(`${baseUrl}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } }); return { response: res, body: await res.json().catch(() => ({})) }; }
async function login(email, password) { const { response, body } = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); assert.equal(response.status, 200); return body.token; }
async function createAdmin(superHeaders, tenantId, suffix) { const email = `admin.domains.${suffix}@test.local`; const { response } = await json("/api/superadmin/users", { method: "POST", headers: superHeaders, body: JSON.stringify({ nome: "Admin Domain", email, password: "SenhaTenant123!", role: "tenant_admin", tenant_id: tenantId }) }); assert.equal(response.status, 201); return login(email, "SenhaTenant123!"); }

try {
  await wait();
  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const superHeaders = { Authorization: `Bearer ${superToken}` };
  const tokenA = await createAdmin(superHeaders, "tenant-cliente-a", "a");
  const tokenB = await createAdmin(superHeaders, "tenant-cliente-b", "b");
  const headersA = { Authorization: `Bearer ${tokenA}` };
  const headersB = { Authorization: `Bearer ${tokenB}` };

  const created = await json("/api/admin/domains", { method: "POST", headers: headersA, body: JSON.stringify({ domain: "sorteios-a.test", type: "custom_domain" }) });
  assert.equal(created.response.status, 201);
  const duplicate = await json("/api/admin/domains", { method: "POST", headers: headersB, body: JSON.stringify({ domain: "sorteios-a.test", type: "custom_domain" }) });
  assert.equal(duplicate.response.status, 400, "dominio unico nao pode duplicar entre tenants");
  const verify = await json(`/api/admin/domains/${created.body.id}/verify`, { method: "POST", headers: headersA });
  assert.equal(verify.response.status, 200);
  const publicCustom = await json("/api/raffles", { headers: { "x-forwarded-host": "sorteios-a.test" } });
  assert.equal(publicCustom.response.status, 200, "custom domain resolve tenant verificado");
  const publicSub = await json("/api/raffles", { headers: { "x-forwarded-host": "cliente-a.meudominio.com" } });
  assert.equal(publicSub.response.status, 200, "subdominio resolve tenant");
  const domainsA = await json("/api/admin/domains", { headers: headersA });
  const domainsB = await json("/api/admin/domains", { headers: headersB });
  assert.ok(domainsA.body.some(item => item.domain === "sorteios-a.test"));
  assert.equal(domainsB.body.some(item => item.domain === "sorteios-a.test"), false, "tenant B nao ve dominio do tenant A");
  console.log("PASS: dominios por tenant, unicidade, subdominio e custom domain validados.");
} finally {
  server.kill();
}

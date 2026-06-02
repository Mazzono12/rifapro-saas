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
const env = { ...process.env, PORT: String(port), NODE_ENV: "production", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", SUPERADMIN_EMAIL: "superadmin.audit@test.local", SUPERADMIN_PASSWORD: "SenhaSuper123!", JWT_SECRET: "test-impersonation-secret", GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-impersonation-gateway-key" };
const server = spawn(process.execPath, ["dist/server.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
async function wait() { for (let i = 0; i < 60; i++) { try { const r = await fetch(`${baseUrl}/api/public/health`); if (r.status === 200) return; } catch {} await new Promise(r => setTimeout(r, 100)); } throw new Error("Servidor nao iniciou"); }
async function json(path, options = {}) { const res = await fetch(`${baseUrl}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } }); return { response: res, body: await res.json().catch(() => ({})) }; }
async function login(email, password) { const { response, body } = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); assert.equal(response.status, 200); return body.token; }

try {
  await wait();
  const token = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const headers = { Authorization: `Bearer ${token}` };
  const missingReason = await json("/api/superadmin/tenants/tenant-cliente-a/impersonate/start", { method: "POST", headers, body: JSON.stringify({ reason: "" }) });
  assert.equal(missingReason.response.status, 400, "acesso assistido exige motivo");
  const started = await json("/api/superadmin/tenants/tenant-cliente-a/impersonate/start", { method: "POST", headers, body: JSON.stringify({ reason: "Suporte solicitado pelo cliente para revisar painel" }) });
  assert.equal(started.response.status, 201);
  assert.ok(started.body.session.id);
  const adminContext = await json("/api/admin/domains", { headers: { ...headers, "X-Support-Session-Id": started.body.session.id } });
  assert.equal(adminContext.response.status, 200, "sessao assistida permite contexto admin do tenant");
  const ended = await json("/api/superadmin/impersonate/end", { method: "POST", headers, body: JSON.stringify({ sessionId: started.body.session.id }) });
  assert.equal(ended.response.status, 200);
  const logs = await json("/api/superadmin/audit-logs", { headers });
  assert.ok(logs.body.some(log => log.action === "IMPERSONATION_START" && log.resource_id === started.body.session.id), "inicio gera log");
  assert.ok(logs.body.some(log => log.action === "IMPERSONATION_END" && log.resource_id === started.body.session.id), "saida gera log");
  const deleteLogs = await fetch(`${baseUrl}/api/superadmin/audit-logs`, { method: "DELETE", headers });
  assert.notEqual(deleteLogs.status, 200, "logs criticos nao possuem delete");
  console.log("PASS: acesso assistido exige motivo, audita entrada/saida e nao apaga logs criticos.");
} finally {
  server.kill();
}

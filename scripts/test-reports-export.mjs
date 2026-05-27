import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.PORT || (3142 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
const env = { ...process.env, PORT: String(port), NODE_ENV: "production", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", SUPERADMIN_EMAIL: "superadmin.reports@test.local", SUPERADMIN_PASSWORD: "SenhaSuper123!", JWT_SECRET: "test-reports-secret", GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-reports-gateway-key" };
const server = spawn(process.execPath, ["dist/server.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
async function wait() { for (let i = 0; i < 60; i++) { try { const r = await fetch(`${baseUrl}/api/auth/session`); if (r.status >= 400) return; } catch {} await new Promise(r => setTimeout(r, 100)); } throw new Error("Servidor nao iniciou"); }
async function json(path, options = {}) { const res = await fetch(`${baseUrl}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } }); return { response: res, body: await res.json().catch(() => ({})) }; }
async function login(email, password) { const { response, body } = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); assert.equal(response.status, 200); return body.token; }

try {
  await wait();
  const token = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const headers = { Authorization: `Bearer ${token}` };
  const global = await fetch(`${baseUrl}/api/superadmin/reports/revenue/export?period=last30`, { headers });
  assert.equal(global.status, 200, "superadmin baixa relatorio global");
  assert.match(global.headers.get("content-type") || "", /text\/csv/);
  const globalCsv = await global.text();
  assert.match(globalCsv, /tenant,campanha,pedido,cliente,valor,status,gateway/);
  const tenant = await fetch(`${baseUrl}/api/superadmin/tenants/tenant-cliente-a/reports/revenue/export?status=paid`, { headers });
  assert.equal(tenant.status, 200, "superadmin baixa relatorio por tenant");
  const report = await json("/api/superadmin/reports/revenue?period=currentMonth&tenant_id=tenant-cliente-a", { headers });
  assert.equal(report.response.status, 200);
  assert.equal(report.body.filters.tenant_id, "tenant-cliente-a", "filtro por tenant preservado");
  console.log("PASS: exportacao CSV global/tenant e filtros de relatorio validados.");
} finally {
  server.kill();
}

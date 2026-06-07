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
const env = { ...process.env, PORT: String(port), NODE_ENV: "production", RIFAPRO_TEST_MODE: "hard", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", SUPERADMIN_EMAIL: "superadmin.reports@test.local", SUPERADMIN_PASSWORD: "SenhaSuper123!", JWT_SECRET: "test-reports-secret", GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-reports-gateway-key" };
const server = spawn(process.execPath, ["dist/server.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
async function wait() { for (let i = 0; i < 60; i++) { try { const r = await fetch(`${baseUrl}/api/public/health`); if (r.status === 200) return; } catch {} await new Promise(r => setTimeout(r, 100)); } throw new Error("Servidor nao iniciou"); }
async function json(path, options = {}) { const res = await fetch(`${baseUrl}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } }); return { response: res, body: await res.json().catch(() => ({})) }; }
async function login(email, password) { const { response, body } = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); assert.equal(response.status, 200); return body.token; }
async function createTenantAdmin(superHeaders, tenantId, email) {
  const { response } = await json("/api/superadmin/users", {
    method: "POST",
    headers: superHeaders,
    body: JSON.stringify({ nome: `Admin ${tenantId}`, email, password: "SenhaTenant123!", role: "tenant_admin", tenant_id: tenantId })
  });
  assert.equal(response.status, 201);
  return login(email, "SenhaTenant123!");
}

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

  const officialPdf = await json("/api/superadmin/reports/export", {
    method: "POST",
    headers,
    body: JSON.stringify({ reportType: "financial_global", format: "pdf", filters: { period: "last30" } })
  });
  assert.equal(officialPdf.response.status, 201, "superadmin gera PDF oficial");
  assert.match(officialPdf.body.file_hash, /^[a-f0-9]{64}$/);
  assert.ok(officialPdf.body.request_id, "relatorio oficial contem request_id");
  assert.ok(officialPdf.body.qr_validation_url, "relatorio oficial contem QR/URL validacao");
  const pdfDownload = await fetch(`${baseUrl}/api/superadmin/reports/${officialPdf.body.id}/download`, { headers });
  assert.equal(pdfDownload.status, 200, "superadmin baixa PDF oficial");
  assert.match(pdfDownload.headers.get("content-type") || "", /application\/pdf/);
  assert.equal(pdfDownload.headers.get("x-report-hash"), officialPdf.body.file_hash, "download preserva hash oficial");

  const officialCsv = await json("/api/superadmin/reports/export", {
    method: "POST",
    headers,
    body: JSON.stringify({ reportType: "sold_tickets", format: "csv", tenantId: "tenant-cliente-a", filters: { status: "paid" } })
  });
  assert.equal(officialCsv.response.status, 201, "CSV oficial gerado");
  const csvDownload = await fetch(`${baseUrl}/api/superadmin/reports/${officialCsv.body.id}/download`, { headers });
  assert.equal(csvDownload.status, 200);
  assert.match(csvDownload.headers.get("content-type") || "", /text\/csv/);

  const tokenA = await createTenantAdmin(headers, "tenant-cliente-a", "admin.report.a@test.local");
  const tokenB = await createTenantAdmin(headers, "tenant-cliente-b", "admin.report.b@test.local");
  const adminAHeaders = { Authorization: `Bearer ${tokenA}` };
  const adminBHeaders = { Authorization: `Bearer ${tokenB}` };
  const tenantReport = await json("/api/admin/reports/export", {
    method: "POST",
    headers: adminAHeaders,
    body: JSON.stringify({ reportType: "financial_tenant", format: "pdf", filters: { period: "last30" } })
  });
  assert.equal(tenantReport.response.status, 201, "admin tenant gera PDF proprio");
  const blocked = await fetch(`${baseUrl}/api/admin/reports/${tenantReport.body.id}/download`, { headers: adminBHeaders });
  assert.equal(blocked.status, 404, "tenant B nao baixa relatorio do tenant A");
  const allowed = await fetch(`${baseUrl}/api/admin/reports/${tenantReport.body.id}/download`, { headers: adminAHeaders });
  assert.equal(allowed.status, 200, "tenant A baixa relatorio proprio");

  const validation = await json(`/api/public/reports/validate/${officialPdf.body.request_id}`, { headers });
  assert.equal(validation.response.status, 200, "validacao publica do hash funciona");
  assert.equal(validation.body.file_hash, officialPdf.body.file_hash);

  console.log("PASS: exportacao CSV/PDF oficial, hash, isolamento tenant e filtros de relatorio validados.");
} finally {
  server.kill();
}

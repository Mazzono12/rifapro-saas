import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const mustContain = (file, terms) => {
  const content = readFileSync(file, "utf8");
  for (const term of terms) assert.ok(content.includes(term), `${file} deve conter ${term}`);
  return content;
};

const serverSource = mustContain("server.ts", [
  "app.get(\"/api/admin/whatsapp/config\"",
  "app.post(\"/api/admin/whatsapp/config\"",
  "app.post(\"/api/admin/whatsapp/test\"",
  "app.get(\"/api/admin/whatsapp/messages\"",
  "app.post(\"/api/admin/whatsapp/messages/:id/resend\"",
  "app.get(\"/api/superadmin/whatsapp/overview\"",
  "app.get(\"/api/superadmin/whatsapp/messages\"",
  "enqueueWhatsAppTicketConfirmation(purchase)",
  "buildTicketConfirmationIdempotencyKey",
  "maskPhone(message.phone)"
]);

mustContain("src/server/whatsapp/whatsappService.ts", [
  "normalizeBrazilianPhone",
  "maskPhone",
  "buildTicketConfirmationMessage",
  "whatsapp:ticket-confirmation:"
]);

mustContain("src/server/whatsapp/providers/mockWhatsAppProvider.ts", ["sendMockWhatsAppMessage"]);
mustContain("src/server/whatsapp/providers/metaCloudWhatsAppProvider.ts", ["graph.facebook.com", "WHATSAPP_ENABLE_PRODUCTION_SEND"]);
mustContain("src/pages/admin/AdminIntegrations.tsx", ["WhatsApp automático", "/api/admin/whatsapp/config", "/api/admin/whatsapp/test"]);
mustContain("src/pages/superadmin/SuperAdminIntegrations.tsx", ["WhatsApp global", "/api/superadmin/whatsapp/overview"]);
mustContain("supabase/migrations/22_whatsapp_auto_ticket_queue.sql", [
  "create table if not exists public.whatsapp_message_queue",
  "create table if not exists public.whatsapp_provider_configs",
  "enable row level security",
  "idempotency_key text unique"
]);

assert.doesNotMatch(serverSource, /SERVICE_ROLE_KEY.*message_body/i, "Mensagem WhatsApp nao deve usar service role no corpo.");

const port = Number(process.env.PORT || (3735 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  SUPERADMIN_EMAIL: "superadmin.whatsapp-queue@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "test-whatsapp-queue-jwt-secret-long-value",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-whatsapp-queue-gateway-key"
};
const server = spawn(process.execPath, ["dist/server.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
let serverOutput = "";
server.stdout.on("data", chunk => { serverOutput += chunk.toString(); });
server.stderr.on("data", chunk => { serverOutput += chunk.toString(); });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function json(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      if (response.status >= 400) return;
    } catch {
      await wait(100);
    }
  }
  throw new Error("Servidor de teste WhatsApp queue nao iniciou.");
}

async function login(email, password) {
  const { response, body } = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  assert.equal(response.status, 200);
  return body.token;
}

try {
  await waitForServer();
  const superToken = await login(env.SUPERADMIN_EMAIL, env.SUPERADMIN_PASSWORD);
  const superHeaders = { Authorization: `Bearer ${superToken}` };
  const createAdmin = async (tenantId, email) => {
    const created = await json("/api/superadmin/users", { method: "POST", headers: superHeaders, body: JSON.stringify({ nome: email, email, password: "SenhaTenant123!", role: "tenant_admin", tenant_id: tenantId }) });
    assert.equal(created.response.status, 201);
    return login(email, "SenhaTenant123!");
  };
  const tokenA = await createAdmin("tenant-cliente-a", "admin.whatsapp-queue-a@test.local");
  const tokenB = await createAdmin("tenant-cliente-b", "admin.whatsapp-queue-b@test.local");
  const headersA = { Authorization: `Bearer ${tokenA}` };
  const headersB = { Authorization: `Bearer ${tokenB}` };

  const saved = await json("/api/admin/whatsapp/config", { method: "POST", headers: headersA, body: JSON.stringify({ enabled: true, provider: "mock", environment: "sandbox", access_token: "token-ultra-secreto", webhook_verify_token: "verify-secreto" }) });
  assert.equal(saved.response.status, 200);
  assert.notEqual(saved.body.access_token, "token-ultra-secreto", "Token WhatsApp nao deve voltar em claro.");
  assert.notEqual(saved.body.webhook_verify_token, "verify-secreto", "Verify token nao deve voltar em claro.");

  const test = await json("/api/admin/whatsapp/test", { method: "POST", headers: headersA, body: JSON.stringify({ phone: "11999990000" }) });
  assert.equal(test.response.status, 200, "Mock deve enviar teste sandbox.");
  assert.equal(test.body.message.status, "sent");

  const invalid = await json("/api/admin/whatsapp/test", { method: "POST", headers: headersA, body: JSON.stringify({ phone: "123" }) });
  assert.equal(invalid.response.status, 502, "Telefone invalido deve falhar de forma controlada.");
  assert.equal(invalid.body.message.status, "failed");

  const messagesA = await json("/api/admin/whatsapp/messages", { headers: headersA });
  const messagesB = await json("/api/admin/whatsapp/messages", { headers: headersB });
  assert.ok(messagesA.body.length >= 2, "Tenant A ve sua fila.");
  assert.equal(messagesB.body.length, 0, "Tenant B nao ve fila do Tenant A.");

  const resendOwn = await json(`/api/admin/whatsapp/messages/${messagesA.body[0].id}/resend`, { method: "POST", headers: headersA });
  assert.ok([200, 502].includes(resendOwn.response.status), "Admin pode reenviar mensagem do proprio tenant.");
  const crossResend = await json(`/api/admin/whatsapp/messages/${messagesA.body[0].id}/resend`, { method: "POST", headers: headersB });
  assert.equal(crossResend.response.status, 404, "Admin nao reenvia mensagem de outro tenant.");

  const overview = await json("/api/superadmin/whatsapp/overview", { headers: superHeaders });
  assert.equal(overview.response.status, 200);
  assert.ok("sent" in overview.body.metrics, "Superadmin ve overview global.");
  const globalMessages = await json("/api/superadmin/whatsapp/messages", { headers: superHeaders });
  assert.equal(globalMessages.response.status, 200);
  assert.ok(globalMessages.body.length >= messagesA.body.length, "Superadmin ve fila global mascarada.");

  console.log("PASS: fila WhatsApp hard validada com RLS logico, tokens mascarados, retry/resend e superadmin.");
} catch (error) {
  console.error(serverOutput);
  throw error;
} finally {
  server.kill("SIGTERM");
}

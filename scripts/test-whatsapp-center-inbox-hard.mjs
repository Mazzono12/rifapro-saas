import assert from "node:assert/strict";
import fs from "node:fs";

const server = fs.readFileSync("server.ts", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");
const layout = fs.readFileSync("src/pages/admin/AdminLayout.tsx", "utf8");
const page = fs.readFileSync("src/pages/admin/AdminWhatsAppCenter.tsx", "utf8");
const migration = fs.readFileSync("supabase/migrations/47_whatsapp_center_inbox.sql", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

function includesAll(source, needles, label) {
  for (const needle of needles) {
    assert.ok(source.includes(needle), `${label}: ausente ${needle}`);
  }
}

function blockBetween(source, start, end) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, `Inicio ausente: ${start}`);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(b, -1, `Fim ausente: ${end}`);
  return source.slice(a, b);
}

includesAll(server, [
  "type WhatsAppContactRecord",
  "type WhatsAppConversationRecord",
  "type WhatsAppConversationMessageRecord",
  "type WhatsAppOptOutEventRecord",
  "let whatsappContacts",
  "let whatsappConversations",
  "let whatsappConversationMessages",
  "let whatsappOptOutEvents"
], "estruturas inbox");

includesAll(server, [
  "processWhatsAppCenterInboundWebhook(config.tenant_id, req.body)",
  "upsertWhatsAppContact(tenantId, phone",
  "ensureWhatsAppConversation(tenantId, contact",
  "direction: \"inbound\"",
  "conversation.unreadCount += 1",
  "serviceWindowExpiresAt",
  "24 * 60 * 60 * 1000"
], "webhook inbound");

includesAll(server, [
  "SAIR",
  "PARAR",
  "CANCELAR",
  "DESCADASTRAR",
  "STOP",
  "recordWhatsAppOptOut(tenantId, contact"
], "opt-out");

includesAll(server, [
  "const statuses = Array.isArray(value.statuses)",
  "statusValue",
  "metaMessageId",
  "type: \"status\""
], "status delivery/read/failed");

includesAll(server, [
  "app.get(\"/api/admin/whatsapp-center/conversations\"",
  "app.get(\"/api/admin/whatsapp-center/conversations/:id\"",
  "app.put(\"/api/admin/whatsapp-center/conversations/:id/status\"",
  "app.put(\"/api/admin/whatsapp-center/conversations/:id/assign\"",
  "app.post(\"/api/admin/whatsapp-center/conversations/:id/notes\"",
  "app.get(\"/api/admin/whatsapp-center/contacts/:id\"",
  "app.put(\"/api/admin/whatsapp-center/contacts/:id/consent\""
], "endpoints admin");

includesAll(server, [
  "requireWhatsAppCenterAccess",
  "\"superadmin\", \"admin\", \"operador\"",
  "Acesso restrito a admin ou operador",
  "const tenantId = resolveRequestTenantId(req)",
  "item.tenantId === tenantId",
  "conversation.tenantId === tenantId"
], "seguranca e tenant");

const noteEndpoint = blockBetween(server, "app.post(\"/api/admin/whatsapp-center/conversations/:id/notes\"", "app.get(\"/api/admin/whatsapp-center/contacts/:id\"");
includesAll(noteEndpoint, ["direction: \"internal_note\"", "status: \"internal\"", "schedulePersistentStateSave(\"whatsapp-center-note\")"], "nota interna");
assert.ok(!noteEndpoint.includes("sendMetaCloudWhatsAppMessage") && !noteEndpoint.includes("sendQueuedWhatsAppMessage") && !noteEndpoint.includes("queueN8nEvent"), "Nota interna nao pode enviar mensagem ou automacao.");

const webhookBlock = blockBetween(server, "app.post(\"/api/webhooks/meta/whatsapp\"", "app.get(\"/api/admin/audit-logs\"");
assert.ok(!webhookBlock.includes("queueN8nEvent") && !webhookBlock.includes("scheduleAutomation") && !webhookBlock.includes("crmContacts") && !webhookBlock.includes("sendQueuedWhatsAppMessage"), "Webhook da Central nao pode acionar n8n, automacoes, CRM ou fila promocional.");
assert.ok(!webhookBlock.includes("checkout") && !webhookBlock.includes("gateway") && !webhookBlock.includes("billing") && !webhookBlock.includes("affiliate"), "Webhook da Central nao deve tocar checkout/gateway/billing/afiliados.");

const centerBlock = blockBetween(server, "function requireWhatsAppCenterAccess", "function upsertWhatsAppCloudConfig");
assert.ok(!/access_token|webhook_verify_token|decryptWhatsAppCloudConfig/.test(centerBlock), "Central nao deve salvar/expor token.");
assert.ok(!centerBlock.includes("rawBody") && !centerBlock.includes("req.body") || centerBlock.includes("summarizeWhatsAppInbound"), "Central deve usar resumo sanitizado, nao payload bruto.");

includesAll(server, [
  "whatsappContacts,",
  "whatsappConversations,",
  "whatsappConversationMessages,",
  "whatsappOptOutEvents,",
  "case \"whatsappContacts\"",
  "case \"whatsappConversations\"",
  "case \"whatsappConversationMessages\"",
  "case \"whatsappOptOutEvents\""
], "persistencia");

includesAll(migration, [
  "create table if not exists public.whatsapp_contacts",
  "create table if not exists public.whatsapp_conversations",
  "create table if not exists public.whatsapp_conversation_messages",
  "create table if not exists public.whatsapp_opt_out_events",
  "enable row level security",
  "tenant_id = auth.jwt() ->> 'tenant_id'"
], "migration/RLS");

includesAll(app, [
  "AdminWhatsAppCenter",
  "path=\"whatsapp-center\"",
  "roles={[\"superadmin\", \"admin\", \"operador\"]}"
], "rotas frontend");

includesAll(layout, [
  "Central WhatsApp",
  "/admin/whatsapp-center"
], "menu frontend");

includesAll(page, [
  "Central WhatsApp",
  "/api/admin/whatsapp-center/conversations",
  "/api/admin/whatsapp-center/conversations/${activeConversation.id}/status",
  "/api/admin/whatsapp-center/conversations/${activeConversation.id}/assign",
  "/api/admin/whatsapp-center/conversations/${activeConversation.id}/notes",
  "Opt-out registrado",
  "Janela 24h",
  "Resposta manual sera liberada na proxima etapa."
], "tela inbox");

assert.ok(!page.includes("/api/admin/crm") && !page.includes("campanha") && !page.includes("n8n"), "Tela nao deve usar CRM/campanhas/n8n.");
assert.equal(pkg.scripts["test:whatsapp-center-inbox-hard"], "node scripts/test-whatsapp-center-inbox-hard.mjs", "script npm ausente");

console.log("[whatsapp-center-inbox-hard] ok");

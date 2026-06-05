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
  "app.post(\"/api/admin/whatsapp-center/conversations/:id/messages\"",
  "app.get(\"/api/admin/whatsapp-center/templates\"",
  "app.post(\"/api/admin/whatsapp-center/conversations/:id/template\"",
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

const noteEndpoint = blockBetween(server, "app.post(\"/api/admin/whatsapp-center/conversations/:id/notes\"", "app.post(\"/api/admin/whatsapp-center/conversations/:id/messages\"");
includesAll(noteEndpoint, ["direction: \"internal_note\"", "status: \"internal\"", "schedulePersistentStateSave(\"whatsapp-center-note\")"], "nota interna");
assert.ok(!noteEndpoint.includes("sendMetaCloudWhatsAppMessage") && !noteEndpoint.includes("sendQueuedWhatsAppMessage") && !noteEndpoint.includes("queueN8nEvent"), "Nota interna nao pode enviar mensagem ou automacao.");

const manualEndpoint = blockBetween(server, "app.post(\"/api/admin/whatsapp-center/conversations/:id/messages\"", "app.get(\"/api/admin/whatsapp-center/templates\"");
includesAll(manualEndpoint, [
  "item.id === req.params.id && item.tenantId === tenantId",
  "conversation.contactId && item.tenantId === tenantId",
  "contact.optOut",
  "A janela de atendimento expirou. Utilize um template aprovado.",
  "Mensagem vazia",
  "Mensagem excede o limite de 4000 caracteres",
  "Envio em massa nao permitido",
  "Envio para multiplos destinatarios nao permitido",
  "sendMetaCloudWhatsAppMessage",
  "direction: \"outbound\"",
  "type: \"text\"",
  "status: \"queued\"",
  "message.status = \"sent\"",
  "message.status = \"failed\"",
  "contact.lastOutboundAt",
  "conversation.updatedAt",
  "manual_reply_sent",
  "manual_reply_failed",
  "maskPhone(contact.phone)",
  "schedulePersistentStateSave(\"whatsapp-center-manual-reply\")"
], "resposta manual");
includesAll(manualEndpoint, ["metaAccessToken", "split(metaAccessToken).join(\"[masked]\")"], "mascara token no erro manual");
assert.ok(!/metadata:\s*\{[^}]*access_token/.test(manualEndpoint) && !/res\.[\s\S]{0,120}metaAccessToken/.test(manualEndpoint), "Endpoint manual nao deve logar ou expor token.");
assert.ok(!manualEndpoint.includes("rawBody") && !manualEndpoint.includes("payload bruto"), "Endpoint manual nao deve salvar payload bruto.");
assert.ok(!manualEndpoint.includes("queueN8nEvent") && !manualEndpoint.includes("scheduleAutomation") && !manualEndpoint.includes("crmContacts"), "Endpoint manual nao pode acionar n8n, automacoes ou CRM.");
assert.ok(!manualEndpoint.includes("checkout") && !manualEndpoint.includes("gateway") && !manualEndpoint.includes("billing") && !manualEndpoint.includes("affiliate"), "Endpoint manual nao deve tocar checkout/gateway/billing/afiliados.");

const templateEndpoint = blockBetween(server, "app.post(\"/api/admin/whatsapp-center/conversations/:id/template\"", "app.get(\"/api/admin/whatsapp-center/contacts/:id\"");
includesAll(templateEndpoint, [
  "item.id === req.params.id && item.tenantId === tenantId",
  "conversation.contactId && item.tenantId === tenantId",
  "contact.optOut",
  "Envio em massa nao permitido",
  "Template obrigatorio",
  "Template nao encontrado",
  "Template ainda nao esta aprovado para envio",
  "Componentes invalidos",
  "validateWhatsAppTemplateComponents(template, components)",
  "sendTemplate({",
  "availableTemplates: [template]",
  "direction: \"outbound\"",
  "type: \"template\"",
  "status: \"queued\"",
  "message.status = \"sent\"",
  "message.status = \"failed\"",
  "manual_template_sent",
  "manual_template_failed",
  "getTemplateButtons(template)",
  "sanitizeTemplateComponentsForLog(components)",
  "schedulePersistentStateSave(\"whatsapp-center-template-reply\")"
], "template manual");
includesAll(server, [
  "function validateWhatsAppTemplateComponents",
  "Botao nao aprovado neste template",
  "Componente duplicado no template",
  "Preencha todas as variaveis do template",
  "Este template nao aceita variaveis no corpo",
  "Botao de telefone nao aceita variaveis livres",
  "function getTemplateButtons",
  "PHONE_NUMBER",
  "QUICK_REPLY",
  "URL"
], "validacao template/botoes");
assert.ok(!/metadata:\s*\{[^}]*access_token/.test(templateEndpoint) && !/res\.[\s\S]{0,120}metaAccessToken/.test(templateEndpoint), "Endpoint template nao deve logar ou expor token.");
assert.ok(!templateEndpoint.includes("rawBody") && !templateEndpoint.includes("payload bruto"), "Endpoint template nao deve salvar payload bruto.");
assert.ok(!templateEndpoint.includes("queueN8nEvent") && !templateEndpoint.includes("scheduleAutomation") && !templateEndpoint.includes("crmContacts"), "Endpoint template nao pode acionar n8n, automacoes ou CRM.");
assert.ok(!templateEndpoint.includes("checkout") && !templateEndpoint.includes("gateway") && !templateEndpoint.includes("billing") && !templateEndpoint.includes("affiliate"), "Endpoint template nao deve tocar checkout/gateway/billing/afiliados.");

includesAll(server, [
  "interactive.button_reply",
  "type === \"button\"",
  "buttonReply.id",
  "buttonReply.title",
  "button.payload",
  "type: whatsappMessageType(message)"
], "webhook botoes inbound");

includesAll(server, [
  "entry.action === \"template_sent\"",
  "template_sent"
], "log envio template manual");

const webhookBlock = blockBetween(server, "app.post(\"/api/webhooks/meta/whatsapp\"", "app.get(\"/api/admin/audit-logs\"");
assert.ok(!webhookBlock.includes("queueN8nEvent") && !webhookBlock.includes("scheduleAutomation") && !webhookBlock.includes("crmContacts") && !webhookBlock.includes("sendQueuedWhatsAppMessage"), "Webhook da Central nao pode acionar n8n, automacoes, CRM ou fila promocional.");
assert.ok(!webhookBlock.includes("checkout") && !webhookBlock.includes("gateway") && !webhookBlock.includes("billing") && !webhookBlock.includes("affiliate"), "Webhook da Central nao deve tocar checkout/gateway/billing/afiliados.");

const centerBlock = blockBetween(server, "function requireWhatsAppCenterAccess", "function upsertWhatsAppCloudConfig");
assert.ok(!/metadata:\s*\{[^}]*access_token|webhook_verify_token|res\.[\s\S]{0,120}metaAccessToken/.test(centerBlock), "Central nao deve salvar/expor token.");
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
  "/api/admin/whatsapp-center/conversations/${activeConversation.id}/messages",
  "/api/admin/whatsapp-center/templates",
  "/api/admin/whatsapp-center/conversations/${activeConversation.id}/template",
  "Opt-out registrado",
  "Janela 24h",
  "Responder cliente",
  "A janela de atendimento expirou. Utilize um template aprovado.",
  "Fora da janela de 24h, somente templates aprovados podem ser enviados.",
  "Usar template",
  "Botoes aprovados",
  "Variaveis do template",
  "outboundStatusLabel",
  "enviado",
  "entregue",
  "lido",
  "falhou"
], "tela inbox");

const inboxPageBlock = blockBetween(page, "export function AdminWhatsAppCenter", "function AdminWhatsAppDashboard");
assert.ok(!inboxPageBlock.includes("/api/admin/crm") && !inboxPageBlock.includes("campanha") && !inboxPageBlock.includes("n8n"), "Tela de inbox nao deve usar CRM/campanhas/n8n.");
assert.equal(pkg.scripts["test:whatsapp-center-inbox-hard"], "node scripts/test-whatsapp-center-inbox-hard.mjs", "script npm ausente");

console.log("[whatsapp-center-inbox-hard] ok");

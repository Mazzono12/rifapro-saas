import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const provider = readFileSync("src/server/whatsapp/providers/metaCloudWhatsAppProvider.ts", "utf8");
const ui = readFileSync("src/pages/admin/AdminIntegrations.tsx", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

function includesAll(source, terms, label) {
  for (const term of terms) assert(source.includes(term), `${label}: ausente ${term}`);
}

function blockBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `bloco ausente: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `fim do bloco ausente: ${end}`);
  return source.slice(startIndex, endIndex);
}

includesAll(provider, ["class MetaWhatsAppCloudProvider", "testConnection()", "getPhoneNumberInfo()", "listTemplates()", "validateWebhook(", "handleWebhook("], "provider Meta Cloud");
includesAll(provider, ["requireCredentials(\"connection\")", "requireCredentials(\"phone\")", "requireCredentials(\"templates\")"], "provider exige credenciais antes da Meta API");
assert.ok(provider.indexOf("this.requireCredentials(\"connection\")") < provider.indexOf("this.graphGet(`${this.config.phone_number_id}"), "testConnection deve validar credenciais antes de chamar a Meta API.");
assert.ok(provider.indexOf("this.requireCredentials(\"templates\")") < provider.indexOf("this.graphGet(`${businessAccountId}/message_templates"), "listTemplates deve validar credenciais antes de chamar a Meta API.");

includesAll(server, [
  "WhatsAppCloudConfigRecord",
  "WhatsAppCloudLogRecord",
  "whatsappCloudConfigs",
  "whatsappCloudLogs",
  "createMetaWhatsAppCloudProvider",
  "recordWhatsAppCloudLog",
  "findWhatsAppCloudConfigByVerifyToken",
  "findWhatsAppCloudConfigByWebhookPayload"
], "modelo backend WhatsApp Cloud");

includesAll(server, [
  "/api/admin/whatsapp-cloud/settings",
  "/api/admin/whatsapp-cloud/test",
  "/api/admin/whatsapp-cloud/phone",
  "/api/admin/whatsapp-cloud/templates",
  "/api/webhooks/meta/whatsapp"
], "endpoints WhatsApp Cloud");

const adminCloudBlock = blockBetween(server, 'app.get("/api/admin/whatsapp-cloud/settings"', 'app.get("/api/admin/audit-logs"');
const upsertCloudBlock = blockBetween(server, "function upsertWhatsAppCloudConfig", "function buildPublicTicketUrl");
includesAll(adminCloudBlock + upsertCloudBlock, ["requestHasAdminSession(req, tenantId)", "resolveRequestTenantId(req)", "getWhatsAppCloudConfig(tenantId)", "sanitizeWhatsAppCloudConfig", "encryptGatewaySecret"], "endpoints admin seguros");
includesAll(adminCloudBlock, ["testConnection()", "getPhoneNumberInfo()", "listTemplates()"], "endpoints operacionais Cloud");
assert.ok(!adminCloudBlock.includes("sendQueuedWhatsAppMessage"), "Fundacao Cloud nao pode processar fila/envio.");
assert.ok(!adminCloudBlock.includes("sendMetaCloudWhatsAppMessage"), "Fundacao Cloud nao pode enviar mensagem real.");
assert.ok(!adminCloudBlock.includes("whatsappMessageQueue.unshift"), "Fundacao Cloud nao pode criar disparo de mensagem.");
assert.ok(!adminCloudBlock.includes("queueN8nEvent") && !adminCloudBlock.includes("n8nIntegration"), "Fundacao Cloud nao deve usar n8n.");
for (const sensitive of ["access_token: decryptGatewaySecret", "webhook_verify_token: decryptGatewaySecret"]) {
  assert.ok(!adminCloudBlock.includes(sensitive), `Endpoint admin nao deve retornar segredo aberto: ${sensitive}`);
}

const webhookBlock = blockBetween(server, 'app.get("/api/webhooks/meta/whatsapp"', 'app.get("/api/admin/audit-logs"');
includesAll(provider + webhookBlock, ["hub.verify_token", "validateWebhook", "hub.challenge", "result.challenge", "handleWebhook(req.body)", "res.status(200).json({ received: true"], "webhook Meta");
assert.ok(!webhookBlock.includes("sendQueuedWhatsAppMessage") && !webhookBlock.includes("queueN8nEvent"), "Webhook Meta nao pode disparar automacoes nesta etapa.");

const sanitizeBlock = blockBetween(server, "function sanitizeWhatsAppCloudConfig", "function sanitizeWhatsAppCloudLog");
includesAll(sanitizeBlock, ["maskGatewaySecret(config.access_token_encrypted)", "maskGatewaySecret(config.webhook_verify_token_encrypted)"], "mascaramento de token");

const logBlock = blockBetween(server, "function recordWhatsAppCloudLog", "function decryptWhatsAppCloudConfig");
includesAll(logBlock, ["maskSecretText(input.message", "maskLogValue(input.metadata"], "logs sem token claro");
assert.ok(!logBlock.includes("access_token") && !logBlock.includes("webhook_verify_token"), "Logs Cloud nao devem gravar tokens explicitamente.");

includesAll(server, ["whatsappCloudConfigs,", "whatsappCloudLogs,", "case \"whatsappCloudConfigs\"", "case \"whatsappCloudLogs\""], "persistencia Cloud");

includesAll(ui, [
  "WhatsApp Cloud API",
  "Ativar WhatsApp Cloud",
  "Nome da conta",
  "ID da Business Manager",
  "ID da Conta WhatsApp Business",
  "ID do Número de Telefone",
  "Token de Acesso",
  "Verify Token do Webhook",
  "URL do Webhook",
  "Salvar configuração",
  "Testar conexão",
  "Validar número",
  "Listar templates",
  "Copiar URL do webhook",
  "Nenhuma mensagem é enviada nesta etapa"
], "UI plug-and-play Cloud");
includesAll(ui, ["/api/admin/whatsapp-cloud/settings", "/api/admin/whatsapp-cloud/test", "/api/admin/whatsapp-cloud/phone", "/api/admin/whatsapp-cloud/templates"], "UI usa endpoints Cloud");
assert.ok(!blockBetween(ui, "WhatsApp Cloud API", "WhatsApp automático").includes("/api/admin/whatsapp/test"), "Secao Cloud nao deve chamar endpoint de envio/teste legado.");

assert.equal(pkg.scripts["test:whatsapp-cloud-foundation-hard"], "node scripts/test-whatsapp-cloud-foundation-hard.mjs", "script npm ausente");

console.log("[whatsapp-cloud-foundation-hard] ok");

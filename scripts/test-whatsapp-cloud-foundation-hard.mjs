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

includesAll(provider, ["class MetaWhatsAppCloudProvider", "testConnection()", "getPhoneNumberInfo()", "listTemplates()", "sendTemplateTest(", "validateWebhook(", "handleWebhook("], "provider Meta Cloud");
includesAll(provider, ["requireCredentials(\"connection\")", "requireCredentials(\"phone\")", "requireCredentials(\"templates\")"], "provider exige credenciais antes da Meta API");
assert.ok(provider.indexOf("this.requireCredentials(\"connection\")") < provider.indexOf("this.graphGet(`${this.config.phone_number_id}"), "testConnection deve validar credenciais antes de chamar a Meta API.");
assert.ok(provider.indexOf("this.requireCredentials(\"templates\")") < provider.indexOf("this.graphGet(`${businessAccountId}/message_templates"), "listTemplates deve validar credenciais antes de chamar a Meta API.");
const templateTestProviderBlock = blockBetween(provider, "async sendTemplateTest", "export async function sendMetaCloudWhatsAppMessage");
includesAll(templateTestProviderBlock, ["recipient_type: \"individual\"", "templateName", "availableTemplates", "APPROVED", "this.graphPost(`${this.config.phone_number_id}/messages`"], "envio individual por template");
assert.ok(!templateTestProviderBlock.includes("for (") && !templateTestProviderBlock.includes("while ("), "sendTemplateTest nao pode ter loop de envio.");

includesAll(server, [
  "WhatsAppCloudConfigRecord",
  "WhatsAppCloudLogRecord",
  "WhatsAppCloudTemplateRecord",
  "WhatsAppPixRecoverySettingsRecord",
  "whatsappCloudConfigs",
  "whatsappCloudLogs",
  "whatsappCloudTemplates",
  "whatsappPixRecoverySettings",
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
  "/api/admin/whatsapp-cloud/templates/sync",
  "/api/admin/whatsapp-cloud/templates/saved",
  "/api/admin/whatsapp-cloud/test-template",
  "/api/admin/whatsapp-cloud/pix-recovery/settings",
  "/api/admin/whatsapp-cloud/pix-recovery/preview",
  "/api/admin/whatsapp-cloud/pix-recovery/enqueue",
  "/api/admin/whatsapp-cloud/pix-recovery/run",
  "/api/admin/whatsapp-cloud/pix-recovery/queue",
  "/api/admin/whatsapp-cloud/pix-recovery/logs",
  "/api/webhooks/meta/whatsapp"
], "endpoints WhatsApp Cloud");

const adminCloudBlock = blockBetween(server, 'app.get("/api/admin/whatsapp-cloud/settings"', 'app.get("/api/admin/audit-logs"');
const upsertCloudBlock = blockBetween(server, "function upsertWhatsAppCloudConfig", "function buildPublicTicketUrl");
includesAll(adminCloudBlock + upsertCloudBlock, ["requestHasAdminSession(req, tenantId)", "resolveRequestTenantId(req)", "getWhatsAppCloudConfig(tenantId)", "sanitizeWhatsAppCloudConfig", "encryptGatewaySecret"], "endpoints admin seguros");
includesAll(adminCloudBlock, ["testConnection()", "getPhoneNumberInfo()", "listTemplates()", "sendTemplateTest({"], "endpoints operacionais Cloud");
includesAll(adminCloudBlock, ["normalizeWhatsAppCloudTemplateSnapshot", "getSavedWhatsAppCloudTemplates(tenantId)", "templates_synced", "template_test_requested", "template_test_sent"], "templates salvos e logs de teste");
includesAll(adminCloudBlock, ["Array.isArray(req.body?.to)", "Array.isArray(req.body?.recipients)", "Array.isArray(req.body?.phones)", "isValidBrazilianWhatsAppPhone(phone)", "!templateName", "maskPhone(phone)"], "bloqueios contra lote e telefone invalido");
const templateTestRouteBlock = blockBetween(server, 'app.post("/api/admin/whatsapp-cloud/test-template"', 'app.get("/api/admin/whatsapp-cloud/pix-recovery/settings"');
assert.ok(!templateTestRouteBlock.includes("whatsappMessageQueue.unshift") && !templateTestRouteBlock.includes("/api/admin/crm"), "Teste individual nao pode criar fila ou acionar CRM.");
const pixRecoveryBlock = blockBetween(server, 'app.get("/api/admin/whatsapp-cloud/pix-recovery/settings"', 'app.get("/api/admin/whatsapp-cloud/purchase-confirmation/settings"');
includesAll(pixRecoveryBlock, [
  "requestHasAdminSession(req, tenantId)",
  "sanitizeWhatsAppPixRecoverySettings",
  "listWhatsAppPixRecoveryCandidates",
  "enqueueWhatsAppPixRecoveryMessage",
  "processWhatsappPixRecoveryQueue",
  "getWhatsAppPixRecoveryQueue",
  "pix_recovery_settings_saved",
  "pix_recovery_preview",
  "pix_recovery_enqueued",
  "pix_recovery_sent",
  "pix_recovery_skipped"
], "recuperacao PIX Cloud segura");
includesAll(server, [
  "getApprovedWhatsAppTemplate(tenantId, candidate.templateName, candidate.language)",
  "![\"pending\", \"reserved\"].includes(orderCandidate.status)",
  "isValidBrazilianWhatsAppPhone(candidate.phone)",
  "whatsapp-cloud-pix-recovery:${tenantId}:${orderCandidate.orderType}:${orderCandidate.orderId}:${eventType}",
  "hasRecentWhatsAppPixRecoveryForCustomer",
  "countWhatsAppPixRecoveryToday",
  "settingsRecord.mode === \"automatic\"",
  "action: \"pix_recovery_preview\""
], "regras de recuperacao PIX");
assert.ok(!pixRecoveryBlock.includes("sendQueuedWhatsAppMessage"), "Recuperacao Cloud deve processar pela Cloud API oficial, nao pelo worker legado.");

const purchaseConfirmationBlock = blockBetween(server, 'app.get("/api/admin/whatsapp-cloud/purchase-confirmation/settings"', 'app.get("/api/webhooks/meta/whatsapp"');
const purchaseConfirmationCoreBlock = blockBetween(server, "function defaultWhatsAppPurchaseConfirmationSettings", "function decryptWhatsAppCloudConfig");
const confirmPurchaseBlock = blockBetween(server, "function confirmPurchase(purchase: PurchaseRecord)", "function creditAffiliateCommission");
const paymentReleaseBlock = blockBetween(server, "async function processPaymentReleaseJob", "async function processPaymentJob");
const manualConfirmBlock = blockBetween(server, "function manuallyConfirmPurchasePayment", "function recordPaymentWebhookLog");
includesAll(server, [
  "WhatsAppPurchaseConfirmationSettingsRecord",
  "WhatsAppPurchaseConfirmationEventType",
  "whatsappPurchaseConfirmationSettings",
  "handlePurchaseConfirmedWhatsAppCloudEvent",
  "processWhatsappPurchaseConfirmationQueue",
  "purchase_confirmed"
], "modelo de confirmacao automatica de compra");
includesAll(purchaseConfirmationBlock, [
  "/api/admin/whatsapp-cloud/purchase-confirmation/settings",
  "/api/admin/whatsapp-cloud/purchase-confirmation/test",
  "/api/admin/whatsapp-cloud/purchase-confirmation/queue",
  "/api/admin/whatsapp-cloud/purchase-confirmation/logs",
  "requestHasAdminSession(req, tenantId)",
  "resolveRequestTenantId(req)",
  "Array.isArray(req.body?.to)",
  "Array.isArray(req.body?.recipients)",
  "Array.isArray(req.body?.phones)"
], "endpoints de confirmacao exigem admin e bloqueiam lote");
includesAll(purchaseConfirmationCoreBlock + provider, [
  "sanitizeWhatsAppPurchaseConfirmationSettings",
  "upsertWhatsAppPurchaseConfirmationSettings",
  "getWhatsAppPurchaseConfirmationQueue",
  "countWhatsAppPurchaseConfirmationsToday",
  "buildWhatsAppPurchaseConfirmationComponents",
  "buildWhatsAppPurchaseConfirmationCandidate",
  "validateWhatsAppPurchaseConfirmationCandidate",
  "enqueueWhatsAppPurchaseConfirmationMessage",
  "processWhatsappPurchaseConfirmationQueue",
  "tenant_id === tenantId",
  "orderCandidate.tenantId !== tenantId",
  "orderCandidate.status !== \"paid\"",
  "orderCandidate.status === \"cancelled\"",
  "orderCandidate.orderType === \"raffle\" && purchaseHasRefundOrChargeback",
  "!orderCandidate.quantity || !orderCandidate.numbersLabel",
  "candidate.customer && candidate.customer.tenant_id !== tenantId",
  "getApprovedWhatsAppTemplate(tenantId, candidate.templateName, candidate.language)",
  "isValidBrazilianWhatsAppPhone(candidate.phone)",
  "whatsapp-cloud-purchase-confirmation:${tenantId}:${orderCandidate.orderType}:${orderCandidate.orderId}:purchase_confirmed",
  "message_type: \"whatsapp_cloud_purchase_confirmation\"",
  "event_type: validation.candidate.eventType",
  "status: \"queued\"",
  "status = \"sent\"",
  "? \"failed\" : \"queued\"",
  "status = \"skipped\"",
  "provider.sendTemplateTest({",
  "recipient_type: \"individual\"",
  "purchase_confirmation_event",
  "purchase_confirmation_enqueued",
  "purchase_confirmation_send_requested",
  "purchase_confirmation_sent",
  "purchase_confirmation_failed",
  "purchase_confirmation_skipped"
], "regras da confirmacao purchase_confirmed");
includesAll(purchaseConfirmationCoreBlock, [
  "{ type: \"text\", text: input.customerName",
  "{ type: \"text\", text: input.campaign",
  "{ type: \"text\", text: String(input.quantity",
  "{ type: \"text\", text: numbersText",
  "{ type: \"text\", text: `R$ ${Number(input.amount",
  "{ type: \"text\", text: input.link"
], "variaveis permitidas do template de confirmacao");
assert.ok(confirmPurchaseBlock.indexOf("purchase.status = \"paid\"") < confirmPurchaseBlock.indexOf("handlePurchaseConfirmedWhatsAppCloudEvent(purchase, \"confirmPurchase\")"), "Evento purchase_confirmed so pode ocorrer depois de marcar paid e liberar cotas.");
assert.ok(paymentReleaseBlock.includes("confirmPurchase(purchase)") && paymentReleaseBlock.includes("updatePaymentRecordStatus(job.tenant_id, job.gateway, job.purchaseId, \"paid\""), "Webhook PIX deve integrar com confirmacao definitiva e liberacao de cotas.");
assert.ok(manualConfirmBlock.includes("const confirmed = confirmPurchase(purchase)") && manualConfirmBlock.includes("purchase.linkedPurchases?.forEach(confirmPurchase)"), "Confirmacao manual admin deve passar pelo mesmo evento definitivo.");
assert.ok(!purchaseConfirmationBlock.includes("queueN8nEvent") && !purchaseConfirmationCoreBlock.includes("queueN8nEvent") && !purchaseConfirmationBlock.includes("n8nIntegration"), "Confirmacao de compra Cloud nao pode usar n8n.");
assert.ok(!purchaseConfirmationBlock.includes("/api/admin/crm") && !purchaseConfirmationCoreBlock.includes("updateCrmAutomationForCustomer") && !purchaseConfirmationCoreBlock.includes("crm/customers"), "Confirmacao de compra Cloud nao pode usar CRM.");
assert.ok(!purchaseConfirmationCoreBlock.includes("segment") && !purchaseConfirmationCoreBlock.includes("recipients") && !purchaseConfirmationCoreBlock.includes("forEach(phone"), "Confirmacao de compra nao pode aceitar segmentacao ou multiplos destinatarios.");
assert.ok(!purchaseConfirmationBlock.includes("access_token") && !purchaseConfirmationBlock.includes("webhook_verify_token"), "Endpoints de confirmacao nao devem expor tokens.");
assert.ok(!adminCloudBlock.includes("sendMetaCloudWhatsAppMessage"), "Cloud oficial nao deve usar envio legado.");
assert.ok(!adminCloudBlock.includes("queueN8nEvent") && !adminCloudBlock.includes("n8nIntegration"), "Fundacao Cloud nao deve usar n8n.");
assert.ok(!adminCloudBlock.includes("/api/admin/crm") && !adminCloudBlock.includes("crm/customers"), "Cloud nao pode acionar CRM livre.");
assert.ok(!pixRecoveryBlock.includes("segment") && !pixRecoveryBlock.includes("recipients"), "Recuperacao PIX nao pode aceitar segmentacao ou lista arbitraria.");
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

includesAll(server, ["whatsappCloudConfigs,", "whatsappCloudLogs,", "whatsappCloudTemplates,", "whatsappPixRecoverySettings,", "case \"whatsappCloudConfigs\"", "case \"whatsappCloudLogs\"", "case \"whatsappCloudTemplates\"", "case \"whatsappPixRecoverySettings\""], "persistencia Cloud");

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
  "Templates Oficiais",
  "Sincronizar templates",
  "Atualizar lista",
  "Enviar teste individual",
  "Número de teste",
  "Template",
  "Idioma",
  "Variáveis/componentes",
  "Enviar teste",
  "Envio permitido apenas para teste individual. Campanhas e disparos em massa serão configurados em etapa futura.",
  "Recuperação automática de PIX",
  "Ativar recuperação automática",
  "Template para PIX pendente",
  "Template para PIX vencido",
  "Tempo mínimo após geração do PIX",
  "Limite por cliente",
  "Limite diário por tenant",
  "Manual: apenas criar fila",
  "Automático: enviar pela fila",
  "Salvar automação",
  "Testar regra",
  "Criar fila",
  "Ver fila",
  "Ver logs",
  "Nenhuma mensagem é enviada nesta etapa"
], "UI plug-and-play Cloud");
includesAll(ui, [
  "Confirmações Automáticas",
  "Ativar confirmação automática",
  "Template de confirmação",
  "Manual",
  "Automático",
  "Limite diário",
  "Enviar somente compras pagas",
  "Testar evento",
  "Fila de confirmações",
  "Logs de confirmações",
  "Variáveis permitidas: nome, campanha, quantidade_cotas, numeros, valor, link_campanha"
], "UI de confirmacao automatica");
includesAll(ui, ["/api/admin/whatsapp-cloud/settings", "/api/admin/whatsapp-cloud/test", "/api/admin/whatsapp-cloud/phone", "/api/admin/whatsapp-cloud/templates", "/api/admin/whatsapp-cloud/templates/sync", "/api/admin/whatsapp-cloud/templates/saved", "/api/admin/whatsapp-cloud/test-template", "/api/admin/whatsapp-cloud/pix-recovery/settings", "/api/admin/whatsapp-cloud/pix-recovery/preview", "/api/admin/whatsapp-cloud/pix-recovery/enqueue", "/api/admin/whatsapp-cloud/pix-recovery/run", "/api/admin/whatsapp-cloud/pix-recovery/queue", "/api/admin/whatsapp-cloud/pix-recovery/logs", "/api/admin/whatsapp-cloud/purchase-confirmation/settings", "/api/admin/whatsapp-cloud/purchase-confirmation/test", "/api/admin/whatsapp-cloud/purchase-confirmation/queue", "/api/admin/whatsapp-cloud/purchase-confirmation/logs"], "UI usa endpoints Cloud");
assert.ok(!blockBetween(ui, "WhatsApp Cloud API", "WhatsApp automático").includes("/api/admin/whatsapp/test"), "Secao Cloud nao deve chamar endpoint de envio/teste legado.");
assert.ok(!blockBetween(ui, "WhatsApp Cloud API", "WhatsApp automático").includes("/api/admin/crm"), "Secao Cloud nao deve chamar CRM.");

assert.equal(pkg.scripts["test:whatsapp-cloud-foundation-hard"], "node scripts/test-whatsapp-cloud-foundation-hard.mjs", "script npm ausente");

console.log("[whatsapp-cloud-foundation-hard] ok");

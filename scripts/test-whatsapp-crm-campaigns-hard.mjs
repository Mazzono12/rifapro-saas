import assert from "node:assert/strict";
import fs from "node:fs";

const server = fs.readFileSync("server.ts", "utf8");
const page = fs.readFileSync("src/pages/admin/AdminWhatsAppCenter.tsx", "utf8");
const migration = fs.readFileSync("supabase/migrations/48_whatsapp_crm_campaigns.sql", "utf8");
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
  "type WhatsAppCrmCampaignSegment",
  "\"today\" | \"last_7_days\" | \"vip\" | \"recurring\" | \"pix_pending\" | \"pix_expired\" | \"raffle\" | \"fazendinha\" | \"number_mode\" | \"inactive_30_days\"",
  "type WhatsAppCrmCampaignStatus",
  "\"draft\" | \"ready\" | \"queued\" | \"sending\" | \"completed\" | \"cancelled\"",
  "let whatsappCrmCampaigns"
], "modelo Campanhas CRM");

includesAll(server, [
  "app.get(\"/api/admin/whatsapp-center/campaigns\"",
  "app.post(\"/api/admin/whatsapp-center/campaigns\"",
  "app.get(\"/api/admin/whatsapp-center/campaigns/:id\"",
  "app.post(\"/api/admin/whatsapp-center/campaigns/:id/preview\"",
  "app.post(\"/api/admin/whatsapp-center/campaigns/:id/enqueue\"",
  "app.post(\"/api/admin/whatsapp-center/campaigns/:id/cancel\"",
  "app.post(\"/api/admin/whatsapp-center/campaigns/queue/run\"",
  "app.get(\"/api/admin/whatsapp-center/campaigns/queue\"",
  "app.get(\"/api/admin/whatsapp-center/campaigns/logs\""
], "endpoints Campanhas CRM");

includesAll(server, [
  "requireWhatsAppCrmCampaignAccess",
  "\"superadmin\", \"admin\"",
  "Acesso restrito a admin",
  "const tenantId = resolveRequestTenantId(req)",
  "item.tenant_id === tenantId",
  "whatsappCrmCampaigns.find(item => item.id === req.params.id && item.tenant_id === tenantId)"
], "admin e tenant");

const createEndpoint = blockBetween(server, "app.post(\"/api/admin/whatsapp-center/campaigns\"", "app.get(\"/api/admin/whatsapp-center/campaigns/queue\"");
includesAll(createEndpoint, [
  "Lista manual nao permitida nesta fase",
  "isWhatsAppCrmCampaignSegment(segment)",
  "Template obrigatorio",
  "getApprovedWhatsAppTemplate(tenantId, templateName, language)",
  "Template aprovado nao encontrado",
  "Texto livre nao permitido em campanhas",
  "validateWhatsAppTemplateComponents(template, components)",
  "status: \"draft\"",
  "daily_tenant_limit",
  "cooldown_hours",
  "crm_campaign_created"
], "criacao segura");
assert.ok(!createEndpoint.includes("sendTemplate(") && !createEndpoint.includes("sendMetaCloudWhatsAppMessage"), "Criacao nao pode enviar WhatsApp.");

const previewEndpoint = blockBetween(server, "app.post(\"/api/admin/whatsapp-center/campaigns/:id/preview\"", "app.post(\"/api/admin/whatsapp-center/campaigns/:id/enqueue\"");
includesAll(previewEndpoint, [
  "buildWhatsAppCrmCampaignRecipients(req, campaign)",
  "campaign.predicted_recipients = recipients.length",
  "campaign.status = campaign.status === \"draft\" ? \"ready\" : campaign.status",
  "previewOnly: true",
  "maskPhone(item.phone)"
], "preview");
assert.ok(!previewEndpoint.includes("whatsappMessageQueue.unshift") && !previewEndpoint.includes("sendTemplate(") && !previewEndpoint.includes("sendMetaCloudWhatsAppMessage"), "Preview nao pode enviar nem enfileirar.");

const enqueueEndpoint = blockBetween(server, "app.post(\"/api/admin/whatsapp-center/campaigns/:id/enqueue\"", "app.post(\"/api/admin/whatsapp-center/campaigns/:id/cancel\"");
includesAll(enqueueEndpoint, [
  "campaign.status === \"cancelled\"",
  "getApprovedWhatsAppTemplate(tenantId, campaign.template_name, campaign.language)",
  "buildWhatsAppCrmCampaignRecipients(req, campaign)",
  "`whatsapp-crm-campaign:${tenantId}:${campaign.id}:${recipient.phone}:${campaign.template_name}`",
  "whatsappMessageQueue.some(item => item.idempotency_key === idempotencyKey)",
  "queued >= campaign.daily_tenant_limit",
  "countWhatsAppCrmCampaignSentToday(tenantId) + queued >= campaign.daily_tenant_limit",
  "hasRecentWhatsAppCrmCampaignForPhone(tenantId, recipient.phone, campaign.cooldown_hours)",
  "message_type: \"whatsapp_crm_campaign\"",
  "message_body: \"\"",
  "status: \"queued\"",
  "campaign.status = \"queued\"",
  "crm_campaign_enqueued"
], "enqueue");
assert.ok(!enqueueEndpoint.includes("sendTemplate(") && !enqueueEndpoint.includes("sendMetaCloudWhatsAppMessage"), "Enqueue nao pode enviar imediatamente.");

const cancelEndpoint = blockBetween(server, "app.post(\"/api/admin/whatsapp-center/campaigns/:id/cancel\"", "app.post(\"/api/admin/whatsapp-center/campaigns/queue/run\"");
includesAll(cancelEndpoint, [
  "campaign.status = \"cancelled\"",
  "item.status = \"skipped\"",
  "Campanha cancelada antes do envio",
  "crm_campaign_cancelled"
], "cancelamento");

const runEndpoint = blockBetween(server, "app.post(\"/api/admin/whatsapp-center/campaigns/queue/run\"", "app.get(\"/api/admin/whatsapp-center/contacts/:id\"");
includesAll(runEndpoint, [
  "const tenantId = resolveRequestTenantId(req)",
  "getWhatsAppCrmCampaignQueue(tenantId)",
  "item.status === \"queued\"",
  "campaign.status === \"cancelled\"",
  "countWhatsAppCrmCampaignSentToday(tenantId) >= campaign.daily_tenant_limit",
  "hasRecentWhatsAppCrmCampaignForPhone(tenantId, message.phone, campaign.cooldown_hours, message.id)",
  "provider.sendTemplate({",
  "availableTemplates: templates",
  "message.status = \"sent\"",
  "message.status = message.attempts >= message.max_attempts ? \"failed\" : \"queued\"",
  "campaign.status = \"completed\"",
  "crm_campaign_sent",
  "crm_campaign_failed",
  "crm_campaign_skipped"
], "processamento manual");

includesAll(server, [
  "function buildWhatsAppCrmCampaignRecipients",
  "filterCrmBuyerCustomers(buildCrmBuyerCustomers(req), { search: \"\", segment: campaign.segment })",
  "normalizeBrazilianPhone(customer.whatsapp)",
  "isValidBrazilianWhatsAppPhone(recipient.phone)",
  "seenPhones.has(recipient.phone)",
  "const contact = whatsappContacts.find(item => item.tenantId === tenantId && item.phone === recipient.phone)",
  "return !contact?.optOut"
], "destinatarios CRM sem opt-out");

includesAll(server, [
  "function countWhatsAppCrmCampaignSentToday",
  "function hasRecentWhatsAppCrmCampaignForPhone",
  "message.id !== excludeMessageId",
  "whatsappCrmCampaigns,",
  "case \"whatsappCrmCampaigns\""
], "limites e persistencia");

const campaignServerBlock = blockBetween(server, "app.get(\"/api/admin/whatsapp-center/campaigns\"", "app.get(\"/api/admin/whatsapp-center/contacts/:id\"");
assert.ok(!campaignServerBlock.includes("queueN8nEvent") && !campaignServerBlock.includes("n8n") && !campaignServerBlock.includes("Evolution"), "Campanhas CRM nao podem usar n8n/Evolution.");
assert.ok(!campaignServerBlock.includes("checkout") && !campaignServerBlock.includes("gateway") && !campaignServerBlock.includes("billing") && !campaignServerBlock.includes("affiliate"), "Campanhas CRM nao devem tocar checkout/gateway/billing/afiliados.");
assert.ok(!campaignServerBlock.includes("req.body?.recipients") || campaignServerBlock.includes("Lista manual nao permitida nesta fase"), "Campanhas CRM devem bloquear lista arbitraria.");

includesAll(migration, [
  "create table if not exists public.whatsapp_crm_campaigns",
  "segment in ('today', 'last_7_days', 'vip', 'recurring', 'pix_pending', 'pix_expired', 'raffle', 'fazendinha', 'number_mode', 'inactive_30_days')",
  "status in ('draft', 'ready', 'queued', 'sending', 'completed', 'cancelled')",
  "idx_whatsapp_message_queue_crm_idempotency",
  "enable row level security",
  "tenant_id = auth.jwt() ->> 'tenant_id'"
], "migration/RLS");

includesAll(page, [
  "Campanhas CRM",
  "/api/admin/whatsapp-center/campaigns",
  "/api/admin/whatsapp-center/campaigns/${id}/preview",
  "/api/admin/whatsapp-center/campaigns/${id}/enqueue",
  "/api/admin/whatsapp-center/campaigns/${id}/cancel",
  "/api/admin/whatsapp-center/campaigns/queue/run",
  "/api/admin/whatsapp-center/campaigns/queue",
  "/api/admin/whatsapp-center/campaigns/logs",
  "Template aprovado",
  "Componentes JSON",
  "Preview destinatarios",
  "Fila",
  "Logs",
  "rascunho",
  "pronta",
  "enfileirada",
  "em envio",
  "concluida",
  "cancelada"
], "frontend");
assert.ok(!page.includes("body: reply") || page.includes("conversations/${activeConversation.id}/messages"), "Campanhas CRM nao devem expor texto livre.");
assert.equal(pkg.scripts["test:whatsapp-crm-campaigns-hard"], "node scripts/test-whatsapp-crm-campaigns-hard.mjs", "script npm ausente");

console.log("[whatsapp-crm-campaigns-hard] ok");

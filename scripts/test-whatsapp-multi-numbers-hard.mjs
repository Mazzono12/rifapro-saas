import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => readFileSync(path.join(root, file), "utf8");

const server = read("server.ts");
const app = read("src/App.tsx");
const adminPage = read("src/pages/admin/AdminWhatsAppCenter.tsx");
const superPage = read("src/pages/superadmin/SuperAdminWhatsAppNumbers.tsx");
const superLayout = read("src/pages/superadmin/SuperAdminLayout.tsx");
const migrationPath = "supabase/migrations/54_whatsapp_multi_numbers.sql";
const migration = read(migrationPath);
const pkg = JSON.parse(read("package.json"));

function mustInclude(source, value, message) {
  assert.ok(source.includes(value), message || `Esperado encontrar: ${value}`);
}

assert.ok(existsSync(path.join(root, migrationPath)), "Migration 54_whatsapp_multi_numbers.sql deve existir.");

[
  "create table if not exists public.whatsapp_cloud_numbers",
  "create table if not exists public.whatsapp_routing_settings",
  "phone_number_id text not null",
  "status in ('active', 'inactive', 'blocked', 'error')",
  "quality_rating in ('unknown', 'green', 'yellow', 'red')",
  "idx_whatsapp_cloud_numbers_tenant_id",
  "idx_whatsapp_cloud_numbers_phone_number_id",
  "idx_whatsapp_cloud_numbers_status",
  "idx_whatsapp_cloud_numbers_is_default",
  "enable row level security",
  "tenant_id = coalesce(auth.jwt() ->> 'tenant_id'",
  "auth.jwt() ->> 'role' = 'superadmin'"
].forEach(value => mustInclude(migration, value, `Migration multi-numeros incompleta: ${value}`));

[
  "type WhatsAppCloudNumberRecord",
  "let whatsappCloudNumbers",
  "whatsappRoutingSettings",
  "function selectWhatsAppSendingNumber",
  "function isWhatsAppAutomaticEligibleNumber",
  "function getWhatsAppQueueSendingNumberLogMetadata",
  "function attachWhatsAppSendingNumberToQueueJob",
  "function assignWhatsAppSendingNumberToQueueJob",
  "function getSelectedWhatsAppNumberForQueueJob",
  "whatsappRoutingMode === \"default_number\"",
  "getWhatsAppRoutingSettings(message.tenant_id).whatsappRoutingMode === \"default_number\"",
  "assignWhatsAppSendingNumberToQueueJob(message, selected)",
  "Numero WhatsApp padrao indisponivel",
  "dailySentCount",
  "qualityRank",
  "hasRecentWhatsAppNumberError",
  "decryptWhatsAppCloudNumberConfig",
  "markWhatsAppNumberSendSuccess",
  "markWhatsAppNumberSendError"
].forEach(value => mustInclude(server, value, `Backend/helper ausente: ${value}`));

[
  'number.status === "active"',
  "number.dailySentCount < number.dailyLimit",
  "!hasRecentWhatsAppNumberError(number)",
  '(number.qualityRating === "green" || number.qualityRating === "yellow")',
  ".filter(isWhatsAppAutomaticEligibleNumber)",
  "qualityRank(left.qualityRating) - qualityRank(right.qualityRating) ||\n        left.dailySentCount - right.dailySentCount ||",
  "Nenhum numero WhatsApp saudavel (qualidade green/yellow) disponivel",
  "if (existing && isWhatsAppAutomaticEligibleNumber(existing))"
].forEach(value => mustInclude(server, value, `Selecao automatica multi-numero incompleta: ${value}`));

assert.ok(
  !server.includes(".filter(number => number.status === \"active\")\n      .filter(number => number.dailySentCount < number.dailyLimit)\n      .filter(number => !hasRecentWhatsAppNumberError(number))"),
  "Modo automatic nao pode voltar a aceitar numeros red/unknown implicitamente."
);

const defaultNumberBlock = server.slice(
  server.indexOf('if (routing.whatsappRoutingMode === "default_number")'),
  server.indexOf("const eligible = numbers")
);
mustInclude(defaultNumberBlock, "const number = numbers.find(item => item.isDefault)", "Modo default_number deve usar somente o numero padrao.");
mustInclude(defaultNumberBlock, "if (!number) throw new Error", "Modo default_number deve bloquear se nao houver padrao.");
assert.ok(!defaultNumberBlock.includes("eligible") && !defaultNumberBlock.includes("filter(isWhatsAppAutomaticEligibleNumber)"), "Modo default_number nao pode fazer fallback automatico.");

[
  'action: "crm_campaign_enqueued"',
  "firstQueuedCampaignMessage ? getWhatsAppQueueSendingNumberLogMetadata(firstQueuedCampaignMessage)",
  'action: "pix_recovery_enqueued"',
  "templateName: message.template_name, ...getWhatsAppQueueSendingNumberLogMetadata(message)",
  'action: "purchase_confirmation_enqueued"',
  'action: "whatsapp_automation_scheduled"',
  "scheduledAt, ...getWhatsAppQueueSendingNumberLogMetadata(queueMessage)"
].forEach(value => mustInclude(server, value, `Log de enqueue/agendamento sem numero remetente: ${value}`));

[
  'app.get("/api/admin/whatsapp-center/numbers"',
  'app.post("/api/admin/whatsapp-center/numbers"',
  'app.put("/api/admin/whatsapp-center/numbers/:id"',
  'app.post("/api/admin/whatsapp-center/numbers/:id/test"',
  'app.post("/api/admin/whatsapp-center/numbers/:id/validate"',
  'app.post("/api/admin/whatsapp-center/numbers/:id/set-default"',
  'app.post("/api/admin/whatsapp-center/numbers/:id/sync-templates"',
  'app.put("/api/admin/whatsapp-center/routing"',
  'app.get("/api/superadmin/whatsapp-center/numbers"'
].forEach(value => mustInclude(server, value, `Endpoint ausente: ${value}`));

[
  "whatsappCloudNumbers.find(number => number.phoneNumberId",
  "findWhatsAppCloudNumberByWebhookPayload",
  "processWhatsAppCenterInboundWebhook(config.tenant_id, req.body, resolvedNumber)",
  "sendingNumberId",
  "phoneNumberId",
  "phoneNumber"
].forEach(value => mustInclude(server, value, `Webhook/log multi-numero incompleto: ${value}`));

[
  "selectWhatsAppSendingNumber(tenantId, \"manual_reply\")",
  "selectWhatsAppSendingNumber(tenantId, \"manual_template\")",
  "attachWhatsAppSendingNumberToQueueJob(queueMessage, \"crm_campaign\")",
  "attachWhatsAppSendingNumberToQueueJob(queueMessage, \"crm_automation\")",
  "attachWhatsAppSendingNumberToQueueJob(message, \"pix_recovery\")",
  "attachWhatsAppSendingNumberToQueueJob(message, \"purchase_confirmation\")",
  "getSelectedWhatsAppNumberForQueueJob(message, \"crm_campaign\")",
  "getSelectedWhatsAppNumberForQueueJob(message, \"crm_automation\")",
  "getSelectedWhatsAppNumberForQueueJob(message, \"pix_recovery\")",
  "getSelectedWhatsAppNumberForQueueJob(message, \"purchase_confirmation\")"
].forEach(value => mustInclude(server, value, `Fluxo de envio nao usa helper: ${value}`));

[
  "Números WhatsApp",
  "/api/admin/whatsapp-center/numbers",
  "/api/admin/whatsapp-center/routing",
  "Automático",
  "Número padrão",
  "Definir padrão",
  "Sincronizar templates",
  "Testar",
  "Validar"
].forEach(value => mustInclude(adminPage, value, `UI admin incompleta: ${value}`));

[
  "/api/superadmin/whatsapp-center/numbers",
  "WhatsApp Enterprise",
  "Enviados hoje",
  "Erro recente"
].forEach(value => mustInclude(superPage + superLayout + app, value, `UI superadmin incompleta: ${value}`));

[
  "accessTokenEncrypted",
  "appSecretEncrypted",
  "verifyTokenEncrypted",
  "accessToken: number.accessTokenEncrypted ? \"configured\" : \"\"",
  "maskLogValue",
  "maskSecretText"
].forEach(value => mustInclude(server, value, `Token por numero deve ficar mascarado: ${value}`));

assert.ok(!server.includes("queueN8nEvent") || !server.includes("selectWhatsAppSendingNumber(tenantId, \"n8n"), "Multi-numeros nao pode usar n8n.");
assert.ok(!server.toLowerCase().includes("evolution"), "Multi-numeros nao pode usar Evolution.");
assert.ok(!server.includes('app.put("/api/admin/whatsapp-center/numbers/:tenantId'), "Admin nao pode escolher tenant por parametro.");

[
  'app.post("/api/raffles/:id/buy"',
  'app.post("/api/webhooks/mercadopago"',
  "recordPlatformCommissionForPaidOrder",
  "creditAffiliateCommission"
].forEach(value => mustInclude(server, value, `Fluxo protegido ausente/alterado: ${value}`));

assert.equal(pkg.scripts["test:whatsapp-multi-numbers-hard"], "node scripts/test-whatsapp-multi-numbers-hard.mjs");

console.log("whatsapp-multi-numbers-hard: ok");

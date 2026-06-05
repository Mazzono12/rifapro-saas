import assert from "node:assert/strict";
import fs from "node:fs";

const server = fs.readFileSync("server.ts", "utf8");
const page = fs.readFileSync("src/pages/admin/AdminWhatsAppCenter.tsx", "utf8");
const migration = fs.readFileSync("supabase/migrations/49_whatsapp_crm_automations.sql", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

function includesAll(source, needles, label) {
  for (const needle of needles) assert.ok(source.includes(needle), `${label}: ausente ${needle}`);
}

function blockBetween(source, start, end) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, `Inicio ausente: ${start}`);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(b, -1, `Fim ausente: ${end}`);
  return source.slice(a, b);
}

includesAll(server, [
  "type WhatsAppAutomationType",
  "\"new_buyer\" | \"vip_buyer\" | \"abandoned_pix\" | \"inactive_customer\" | \"post_raffle\" | \"top_buyers\" | \"birthday\"",
  "type WhatsAppAutomationExecutionStatus",
  "type WhatsAppAutomationRuleRecord",
  "type WhatsAppAutomationExecutionRecord",
  "let whatsappAutomationRules",
  "let whatsappAutomationExecutions"
], "modelo automacoes CRM");

includesAll(server, [
  "app.get(\"/api/admin/whatsapp-center/automations\"",
  "app.post(\"/api/admin/whatsapp-center/automations\"",
  "app.put(\"/api/admin/whatsapp-center/automations/:id\"",
  "app.delete(\"/api/admin/whatsapp-center/automations/:id\"",
  "app.get(\"/api/admin/whatsapp-center/automations/logs\"",
  "app.post(\"/api/admin/whatsapp-center/automations/run\""
], "endpoints automacoes CRM");

includesAll(server, [
  "requireWhatsAppCrmCampaignAccess",
  "\"superadmin\", \"admin\"",
  "Acesso restrito a admin",
  "const tenantId = resolveRequestTenantId(req)",
  "rule.tenantId === tenantId",
  "item.tenantId === tenantId"
], "admin obrigatorio e tenant isolado");

const automationBlock = blockBetween(server, "app.get(\"/api/admin/whatsapp-center/automations\"", "app.get(\"/api/admin/whatsapp-center/contacts/:id\"");
includesAll(automationBlock, [
  "getApprovedWhatsAppTemplate(tenantId, template, language)",
  "Template APPROVED obrigatorio",
  "Texto livre nao permitido em automacoes CRM",
  "customerHasWhatsAppOptOut",
  "countWhatsAppAutomationsSentToday",
  "hasRecentWhatsAppAutomationForCustomer",
  "scheduleWhatsAppAutomationExecutions(req, rule)",
  "provider.sendTemplate({",
  "availableTemplates: templates",
  "execution.status = \"sent\"",
  "execution.status = \"skipped\"",
  "execution.status = \"failed\""
], "regras de envio seguro");
assert.ok(!automationBlock.includes("queueN8nEvent") && !automationBlock.includes("n8n") && !automationBlock.includes("Evolution"), "n8n/Evolution nao podem ser usados em automacoes CRM.");
assert.ok(!automationBlock.includes("checkout") && !automationBlock.includes("gateway") && !automationBlock.includes("billing") && !automationBlock.includes("affiliate"), "Automacoes CRM nao devem tocar checkout/gateways/billing/afiliados.");

includesAll(server, [
  "new_buyer: [1440, 4320, 10080]",
  "abandoned_pix: [30, 360, 1440, 4320]",
  "inactive_customer: [43200, 86400, 129600]",
  "rule.type === \"new_buyer\"",
  "rule.type === \"vip_buyer\"",
  "rule.type === \"abandoned_pix\"",
  "rule.type === \"inactive_customer\"",
  "rule.type === \"post_raffle\"",
  "rule.type === \"top_buyers\"",
  "rule.type === \"birthday\"",
  "vipMode === \"purchase_count\"",
  "topCriterion === \"quantity\"",
  "birthDate"
], "sete automacoes nativas");

includesAll(server, [
  "const idempotencyKey = `${rule.tenantId}:${rule.id}:${recipient.customerId}:${scheduledAt}`",
  "whatsappAutomationExecutions.some(item => item.idempotencyKey === idempotencyKey)",
  "message_type: \"whatsapp_crm_automation\"",
  "event_type: `automation_${rule.type}`",
  "whatsappAutomationRules,",
  "whatsappAutomationExecutions,",
  "case \"whatsappAutomationRules\"",
  "case \"whatsappAutomationExecutions\""
], "idempotencia, fila e persistencia");

includesAll(migration, [
  "create table if not exists public.whatsapp_automation_rules",
  "create table if not exists public.whatsapp_automation_executions",
  "type in ('new_buyer', 'vip_buyer', 'abandoned_pix', 'inactive_customer', 'post_raffle', 'top_buyers', 'birthday')",
  "idx_whatsapp_automation_execution_idempotency",
  "on public.whatsapp_automation_executions(tenant_id, rule_id, customer_id, scheduled_at)",
  "enable row level security",
  "tenant_id = auth.jwt() ->> 'tenant_id'"
], "migration automacoes");

includesAll(page, [
  "Automações CRM",
  "/api/admin/whatsapp-center/automations",
  "/api/admin/whatsapp-center/automations/${rule.id}",
  "/api/admin/whatsapp-center/automations/logs",
  "/api/admin/whatsapp-center/automations/run",
  "Comprador Novo",
  "Comprador VIP",
  "PIX Abandonado",
  "Cliente Inativo",
  "Pós-Sorteio",
  "Top Compradores",
  "Aniversário",
  "Template aprovado",
  "Gatilho",
  "Próximas execuções",
  "Histórico",
  "As automações criam execuções programadas e filas com segurança.",
  "Nesta etapa, o envio é processado ao clicar em Executar fila.",
  "Para execução automática contínua, configure um orquestrador/cron chamando /api/admin/whatsapp-center/automations/run."
], "frontend automacoes");
assert.ok(!page.includes("chatbot") && !page.includes("IA"), "UI nao deve implementar IA/chatbot.");

assert.equal(pkg.scripts["test:whatsapp-crm-automations-hard"], "node scripts/test-whatsapp-crm-automations-hard.mjs", "script npm ausente");

console.log("[whatsapp-crm-automations-hard] ok");

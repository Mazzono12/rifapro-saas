import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const layout = readFileSync("src/pages/admin/AdminLayout.tsx", "utf8");
const ui = readFileSync("src/pages/admin/AdminAutomations.tsx", "utf8");
const migration = readFileSync("supabase/migrations/27_tenant_automation_center.sql", "utf8");

function includesAll(source, terms, label) {
  for (const term of terms) assert(source.includes(term), `${label}: ausente ${term}`);
}

includesAll(server, ["AutomationFlowRecord", "AutomationRunRecord", "automationFlows", "automationRuns", "automationTemplates"], "modelo automacoes");
includesAll(server, ["abandoned_pix_recovery", "payment_confirmed_ticket", "post_purchase_thanks", "raffle_ending_reminder", "winner_announcement", "affiliate_invite", "inactive_customer_reactivation", "birthday_message", "vip_customer_offer", "failed_payment_retry"], "templates automacoes");
includesAll(server, ["scheduleAutomation(\"abandoned_pix_recovery\"", "scheduleAutomation(\"post_purchase_thanks\"", "scheduleAutomation(\"payment_confirmed_ticket\"", "executeAutomationRun", "processDueAutomationRuns"], "gatilhos automacoes");
includesAll(server, ["/api/admin/automations", "/api/admin/automations/:id", "/api/admin/automations/:id/toggle", "/api/admin/automations/runs", "/api/admin/automations/process-due"], "endpoints automacoes");
includesAll(server, ["tenantHasFeature(input.tenant_id, \"automations\")", "{ pattern: /^\\/automations/, feature: \"automations\" }", "adminCanAccessTenant", "idempotency_key", "WhatsApp provider inativo para este tenant"], "seguranca automacoes");
includesAll(server, ["enqueueAutomationWhatsApp", "sendQueuedWhatsAppMessage", "crmContactOverrides", "AUTOMATION_EVENT", "AUTOMATION_FLOW_UPDATED"], "acoes automacoes");
includesAll(server, ["automationFlows,", "automationRuns,", "case \"automationFlows\"", "case \"automationRuns\""], "persistencia automacoes");

includesAll(app, ["AdminAutomations", "path=\"automacoes\""], "rota UI automacoes");
includesAll(layout, ["Automações", "/admin/automacoes"], "menu automacoes");
includesAll(ui, ["Central de Automacoes", "Automações", "Criar automação", "Histórico de execuções", "Processar fila", "/api/admin/automations"], "UI automacoes");

includesAll(migration, ["automation_flows", "automation_runs", "conditions jsonb", "actions jsonb", "delay_minutes", "max_runs_per_customer", "enable row level security", "public.can_access_tenant"], "migration automacoes");

console.log("[tenant-automations] ok");

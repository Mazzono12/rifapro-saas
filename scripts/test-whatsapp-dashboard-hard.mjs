import assert from "node:assert/strict";
import fs from "node:fs";

const server = fs.readFileSync("server.ts", "utf8");
const page = fs.readFileSync("src/pages/admin/AdminWhatsAppCenter.tsx", "utf8");
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
  "app.get(\"/api/admin/whatsapp-center/dashboard\"",
  "requireWhatsAppCrmCampaignAccess",
  "buildWhatsAppCenterDashboard(tenantId)",
  "const tenantId = resolveRequestTenantId(req)"
], "endpoint dashboard");

const dashboardBlock = blockBetween(server, "function buildWhatsAppCenterDashboard", "function getApprovedWhatsAppTemplate");
includesAll(dashboardBlock, [
  "whatsappConversationMessages.filter(message => message.tenantId === tenantId",
  "whatsappMessageQueue.filter(message => message.tenant_id === tenantId",
  "whatsappCrmCampaigns.filter(campaign => campaign.tenant_id === tenantId",
  "whatsappConversations.filter(conversation => conversation.tenantId === tenantId",
  "whatsappOptOutEvents.filter(event => event.tenantId === tenantId",
  "sentToday",
  "delivered",
  "read",
  "failures",
  "deliveryRate",
  "readRate",
  "whatsappDashboardEffectiveQueueStatus(tenantId, message)",
  "pixRecoveredCount",
  "pixRecoveredValue",
  "pixRecoveryRate",
  "campaignsSent",
  "openConversations",
  "pendingConversations",
  "resolvedConversations",
  "last7Days",
  "pixRecoveryLast30Days",
  "templates:",
  "campaigns:",
  "conversations:"
], "metricas e agregacoes");

includesAll(server, [
  "getWhatsAppPixRecoveryQueue(tenantId)",
  "message.status === \"sent\"",
  "whatsappDashboardOrderAmount(tenantId, message)",
  "candidate.status === \"paid\" || candidate.paymentStatus === \"paid\"",
  "buildWhatsAppOrderCandidate(order)",
  "findWhatsAppOrderSource(tenantId, message.order_id, orderType)",
  "Number(recoveredPix.reduce"
], "recuperacao PIX paga");

includesAll(dashboardBlock, [
  "buildWhatsAppDashboardDaySeries(7)",
  "buildWhatsAppDashboardDaySeries(30)",
  "enviados",
  "entregues",
  "lidos",
  "falhas",
  "recuperacoes",
  "valor"
], "graficos");

includesAll(dashboardBlock, [
  "addTemplate",
  "templateStats",
  "message.type === \"template\"",
  "message.template_name",
  "envios",
  "entregues",
  "lidos"
], "ranking templates");

includesAll(dashboardBlock, [
  "getWhatsAppCrmCampaignQueue(tenantId, campaign.id)",
  "destinatarios",
  "enviados",
  "entregues: queue.filter(message => [\"delivered\", \"read\"].includes(queueStatus(message))).length",
  "lidos: queue.filter(message => queueStatus(message) === \"read\").length",
  "status: campaign.status"
], "ranking campanhas");

const routeBlock = blockBetween(server, "app.get(\"/api/admin/whatsapp-center/dashboard\"", "app.get(\"/api/admin/whatsapp-center/conversations\"");
assert.ok(!routeBlock.includes("access_token") && !routeBlock.includes("webhook_verify_token") && !routeBlock.includes("rawBody") && !routeBlock.includes("req.body"), "Endpoint nao deve expor token nem payload bruto.");
assert.ok(!dashboardBlock.includes("schedulePersistentStateSave") && !dashboardBlock.includes("whatsappMessageQueue.unshift") && !dashboardBlock.includes("sendTemplate(") && !dashboardBlock.includes("sendMetaCloudWhatsAppMessage"), "Dashboard deve ser somente leitura.");

for (const forbidden of ["checkout", "gateway", "billing", "affiliate", "queueN8nEvent", "n8nIntegration", "/api/admin/crm"]) {
  assert.ok(!dashboardBlock.includes(forbidden) && !routeBlock.includes(forbidden), `Dashboard nao deve tocar ${forbidden}.`);
}

includesAll(page, [
  "Dashboard WhatsApp",
  "/api/admin/whatsapp-center/dashboard",
  "AdminWhatsAppDashboard",
  "Resultados comerciais",
  "Enviadas hoje",
  "Entregues",
  "Lidas",
  "Recuperacoes PIX",
  "Valor recuperado",
  "Campanhas",
  "Opt-outs",
  "Ultimos 7 dias",
  "Recuperacao PIX",
  "Campanhas com melhor desempenho",
  "Templates mais usados",
  "ResponsiveContainer",
  "AreaChart",
  "BarChart"
], "UI dashboard");

assert.ok(!blockBetween(page, "function AdminWhatsAppDashboard", "function DashboardTable").includes("token"), "UI dashboard nao deve exibir token.");
assert.equal(pkg.scripts["test:whatsapp-dashboard-hard"], "node scripts/test-whatsapp-dashboard-hard.mjs", "script npm ausente");

console.log("[whatsapp-dashboard-hard] ok");

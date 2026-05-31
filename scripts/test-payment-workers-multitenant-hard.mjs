import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");

for (const token of [
  "payment_webhook_jobs.find(job => job.tenant_id === input.tenant_id && job.provider === input.provider",
  "payment_reconciliation_jobs.find(job => job.tenant_id === input.tenant_id && job.provider === input.provider",
  "payment_release_jobs.find(job => job.tenant_id === input.tenant_id && job.gateway === input.gateway",
  "payments.find(item =>\n        item.tenant_id === job.tenant_id",
  "purchases.find(item => item.tenant_id === job.tenant_id && item.purchaseId === job.purchaseId)",
  "numberModePurchases.find(item => item.tenant_id === job.tenant_id && item.id === job.purchaseId)",
  "fazendinhaCompras.find(item => item.tenant_id === job.tenant_id && item.id === job.purchaseId)",
  "buildPaymentQueuesDashboard(resolveRequestTenantId(req))",
  "filterTenant(paymentLogs)",
  "filterTenant(webhookLogs)",
  "filterTenant(gatewayHealth)"
]) {
  assert.ok(server.includes(token), `Isolamento multitenant ausente em worker: ${token}`);
}

const dlqBlock = server.slice(server.indexOf("function movePaymentJobToDeadLetter"), server.indexOf("function enqueuePaymentWebhookJob"));
assert.ok(dlqBlock.includes("item.tenant_id === job.tenant_id"), "DLQ deve ser idempotente por tenant.");
assert.ok(dlqBlock.includes("tenant_id: job.tenant_id"), "DLQ deve persistir tenant_id.");

const dashboardBlock = server.slice(server.indexOf("function buildPaymentQueuesDashboard"), server.indexOf("app.post(\"/api/webhooks/asaas\""));
assert.ok(dashboardBlock.includes("tenantId ? items.filter(item => item.tenant_id === tenantId)"), "Dashboard de filas deve filtrar por tenant_id.");

mkdirSync("reports/hard", { recursive: true });
writeFileSync("reports/hard/payment-workers-multitenant-hard.json", JSON.stringify({
  ok: true,
  checked: ["tenant_scoped_jobs", "tenant_scoped_release", "tenant_scoped_dashboard", "tenant_scoped_dlq"]
}, null, 2));

console.log("✅ payment workers multitenant hard passed");

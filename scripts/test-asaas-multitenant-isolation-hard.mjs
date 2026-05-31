import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(join(root, file), "utf8");

const server = read("server.ts");
const migration = read("supabase/migrations/42_asaas_production_hardening.sql");

function blockBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.ok(startIndex >= 0, `Bloco nao encontrado: ${start}`);
  const endIndex = end ? source.indexOf(end, startIndex + start.length) : -1;
  return source.slice(startIndex, endIndex >= 0 ? endIndex : undefined);
}

function has(source, snippet, label) {
  assert.ok(source.includes(snippet), `${label}: faltando ${snippet}`);
}

const configBlock = blockBetween(server, "function getAsaasGatewayConfig", "function getAsaasProvider");
for (const snippet of [
  "getDefaultPaymentGatewayConfig(tenantId)",
  "provider !== \"asaas\" || !config.enabled",
  "apiKey",
  "webhookToken",
  "releaseMode"
]) has(configBlock, snippet, "Config Asaas deve ser por tenant");

const attachBlock = blockBetween(server, "async function attachAsaasPixToOrder", "async function attachPay2mPixToOrder");
for (const snippet of [
  "getAsaasProvider(input.tenantId)",
  "const customerGatewayKey = `${input.tenantId}:asaas:${asaas.config.environment}`",
  "externalReference: orderId",
  "tenant_id: input.tenantId",
  "provider: \"asaas\"",
  "asaas_payment_id: asaasPaymentId",
  "provider_payment_id: asaasPaymentId",
  "recordPaymentWebhookLog({ tenant_id: input.tenantId"
]) has(attachBlock, snippet, "Criacao Asaas deve preservar tenant");

const webhookBlock = blockBetween(server, "app.post(\"/api/webhooks/asaas\"", "app.post(\"/api/admin/payments/asaas/reconcile\"");
for (const snippet of [
  "const tenant = getRequestTenant(req)",
  "const tenantId = tenant?.id || \"unknown\"",
  "getAsaasGatewayConfig(tenant.id)",
  "item.tenant_id === tenantId && String(item.provider) === \"asaas\" && item.id === eventKey",
  "tenant_id: tenantId",
  "provider: \"asaas\" as IntegrationProviderId",
  "provider_payment_id: asaasPaymentId",
  "item.tenant_id === tenantId",
  "item.provider === \"asaas\"",
  "item.provider_payment_id === asaasPaymentId || item.asaas_payment_id === asaasPaymentId",
  "Asaas pago sem payment interno tenant-scoped; baixa bloqueada",
  "enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: payment?.order_id",
  "updatePaymentRecordStatus(tenantId, gateway",
  "recordPaymentWebhookLog({ tenant_id: tenantId"
]) has(webhookBlock, snippet, "Webhook Asaas deve isolar por tenant");

assert.ok(!webhookBlock.includes("enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: purchaseIdToConfirm"), "Webhook Asaas nao pode baixar usando apenas externalReference.");

const reconcileBlock = blockBetween(server, "app.post(\"/api/admin/payments/asaas/reconcile\"", "app.post(\"/api/webhooks/pay2m\"");
for (const snippet of [
  "const tenantId = resolveRequestTenantId(req)",
  "item.tenant_id === tenantId && item.provider === \"asaas\"",
  "getAsaasProvider(tenantId)",
  "asaas.provider.getPayment(payment.provider_payment_id || payment.asaas_payment_id || reference)",
  "enqueuePaymentJob({ tenant_id: tenantId, gateway: \"asaas\", purchaseId: payment.order_id",
  "updatePaymentRecordStatus(tenantId, \"asaas\"",
  "recordPaymentWebhookLog({ tenant_id: tenantId"
]) has(reconcileBlock, snippet, "Reconciliacao Asaas deve ser tenant scoped");

const queueBlock = blockBetween(server, "function buildPaymentIdempotencyKey", "function markPaymentJob");
for (const snippet of [
  "input.gateway === \"asaas\"",
  "asaasPaymentId",
  "asaasStatus",
  "return `${input.tenant_id}:${input.gateway}:event:${String(explicitEventId)}`",
  "paymentQueue.find(job => job.tenant_id === input.tenant_id && job.idempotencyKey === idempotencyKey)"
]) has(queueBlock, snippet, "Idempotencia Asaas deve incluir tenant/provider/payment/status");

const processBlock = blockBetween(server, "async function processPaymentJob", "app.post(\"/api/webhooks/asaas\"");
for (const snippet of [
  "purchases.find(p => p.tenant_id === job.tenant_id && p.purchaseId === purchaseId)",
  "numberModePurchases.find(item => item.tenant_id === job.tenant_id && item.id === purchaseId)",
  "fazendinhaCompras.find(item => item.tenant_id === job.tenant_id && item.id === purchaseId)",
  "updatePaymentRecordStatus(job.tenant_id, job.gateway, purchaseId"
]) has(processBlock, snippet, "Baixa/liberacao Asaas deve respeitar tenant da fila");

for (const snippet of [
  "on public.payments (tenant_id, provider, provider_payment_id)",
  "on public.webhook_events (tenant_id, provider, provider_payment_id, status)",
  "on public.webhook_events (tenant_id, provider, event_id)"
]) has(migration, snippet, "Indices Asaas devem separar tenants");

console.log("PASS: Asaas isolado por tenant em configuracao, cobranca, webhook, idempotencia, reconciliacao e liberacao.");

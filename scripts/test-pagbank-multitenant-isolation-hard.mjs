import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(join(root, file), "utf8");

const server = read("server.ts");
const migration = read("supabase/migrations/41_pagbank_pix_gateway.sql");

function blockBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.ok(startIndex >= 0, `Bloco nao encontrado: ${start}`);
  const endIndex = end ? source.indexOf(end, startIndex + start.length) : -1;
  return source.slice(startIndex, endIndex >= 0 ? endIndex : undefined);
}

function has(source, snippet, label) {
  assert.ok(source.includes(snippet), `${label}: faltando ${snippet}`);
}

const configBlock = blockBetween(server, "function getPagbankGatewayConfig", "function getPagbankProvider");
for (const snippet of [
  "getDefaultPaymentGatewayConfig(tenantId)",
  "provider !== \"pagbank\" || !config.enabled",
  "token",
  "webhookToken"
]) has(configBlock, snippet, "Config PagBank deve ser por tenant");

const attachBlock = blockBetween(server, "async function attachPagbankPixToOrder", "async function attachActiveGatewayPixToOrder");
for (const snippet of [
  "getPagbankProvider(input.tenantId)",
  "tenant_id: input.tenantId",
  "referenceId: orderId",
  "provider: \"pagbank\"",
  "provider_payment_id: pagbankOrderId",
  "provider_reference: orderId",
  "buildTenantPublicUrl(input.tenantId, \"/api/webhooks/pagbank\")",
  "recordPaymentWebhookLog({ tenant_id: input.tenantId"
]) has(attachBlock, snippet, "Criacao PagBank deve preservar tenant");

const webhookBlock = blockBetween(server, "app.post(\"/api/webhooks/pagbank\"", "app.post(\"/api/admin/payments/pagbank/reconcile\"");
for (const snippet of [
  "const tenant = getRequestTenant(req)",
  "const tenantId = tenant?.id || \"unknown\"",
  "getPagbankGatewayConfig(tenant.id)",
  "item.tenant_id === tenantId && String(item.provider) === \"pagbank\" && item.id === eventKey",
  "tenant_id: tenantId",
  "provider: \"pagbank\" as IntegrationProviderId",
  "provider_payment_id: parsed.orderId",
  "reference_id: parsed.referenceId",
  "item.tenant_id === tenantId",
  "item.provider === \"pagbank\"",
  "purchases.find(item => item.tenant_id === tenantId && item.purchaseId === payment.order_id)",
  "numberModePurchases.find(item => item.tenant_id === tenantId && item.id === payment.order_id)",
  "fazendinhaCompras.find(item => item.tenant_id === tenantId && item.id === payment.order_id)",
  "raffles.find(item => item.tenant_id === tenantId && item.id === purchase.raffleId)",
  "enqueuePaymentJob({ tenant_id: tenantId, gateway",
  "updatePaymentRecordStatus(tenantId, gateway, payment.order_id",
  "recordPaymentWebhookLog({ tenant_id: tenantId"
]) has(webhookBlock, snippet, "Webhook PagBank deve isolar por tenant");

const reconcileBlock = blockBetween(server, "app.post(\"/api/admin/payments/pagbank/reconcile\"", "// Universal Webhook for Payment Gateways");
for (const snippet of [
  "const tenantId = resolveRequestTenantId(req)",
  "item.tenant_id === tenantId && item.provider === \"pagbank\"",
  "getPagbankProvider(tenantId)",
  "enqueuePaymentJob({ tenant_id: tenantId, gateway: \"pagbank\"",
  "updatePaymentRecordStatus(tenantId, \"pagbank\"",
  "recordPaymentWebhookLog({ tenant_id: tenantId"
]) has(reconcileBlock, snippet, "Reconciliacao PagBank deve ser tenant scoped");

const queueBlock = blockBetween(server, "function buildPaymentIdempotencyKey", "function markPaymentJob");
for (const snippet of [
  "input.gateway === \"pagbank\"",
  "pagbankOrder?.id",
  "pagbankOrder?.reference_id",
  "return `${input.tenant_id}:${input.gateway}:event:${String(explicitEventId)}`",
  "paymentQueue.find(job => job.tenant_id === input.tenant_id && job.idempotencyKey === idempotencyKey)"
]) has(queueBlock, snippet, "Idempotencia PagBank deve incluir tenant/provider/order/reference/status");

const processBlock = blockBetween(server, "async function processPaymentJob", "app.post(\"/api/webhooks/asaas\"");
for (const snippet of [
  "purchases.find(p => p.tenant_id === job.tenant_id && p.purchaseId === purchaseId)",
  "numberModePurchases.find(item => item.tenant_id === job.tenant_id && item.id === purchaseId)",
  "fazendinhaCompras.find(item => item.tenant_id === job.tenant_id && item.id === purchaseId)",
  "updatePaymentRecordStatus(job.tenant_id, job.gateway, purchaseId"
]) has(processBlock, snippet, "Baixa/liberacao PagBank deve respeitar tenant da fila");

for (const snippet of [
  "on public.payments (tenant_id, provider, provider_payment_id)",
  "on public.payments (tenant_id, provider, provider_reference)",
  "on public.webhook_events (tenant_id, provider, provider_payment_id, reference_id, status, coalesce(end_to_end, 'no-e2e'))"
]) has(migration, snippet, "Indices PagBank devem separar tenants");

const pagbankFinds = server.match(/payments\.find\([\s\S]{0,360}?provider === "pagbank"[\s\S]{0,360}?\);/g) || [];
assert.ok(pagbankFinds.length >= 2, "Auditoria deve encontrar consultas de payments PagBank.");
for (const query of pagbankFinds) {
  assert.match(query, /tenant_id === (tenantId|payment\.tenant_id|input\.tenantId)/, `payments.find PagBank sem tenant_id:\n${query}`);
}

console.log("PASS: PagBank isolado por tenant em configuracao, cobranca, webhook, idempotencia, reconciliacao e liberacao.");

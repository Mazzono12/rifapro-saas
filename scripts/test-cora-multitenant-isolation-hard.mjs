import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const migration = readFileSync("supabase/migrations/43_cora_pix_gateway.sql", "utf8");

function blockBetween(start, end) {
  const startIndex = server.indexOf(start);
  assert.ok(startIndex >= 0, `Bloco nao encontrado: ${start}`);
  const endIndex = end ? server.indexOf(end, startIndex + start.length) : -1;
  return server.slice(startIndex, endIndex >= 0 ? endIndex : undefined);
}

const configBlock = blockBetween("function getCoraGatewayConfig", "function getCoraProvider");
for (const needle of [
  "getDefaultPaymentGatewayConfig(tenantId)",
  "provider !== \"cora\" || !config.enabled",
  "clientId",
  "clientSecret",
  "certificate",
  "privateKey",
  "webhookToken"
]) assert.ok(configBlock.includes(needle), `Config Cora deve ser isolada por tenant: ${needle}`);

const attachBlock = blockBetween("async function attachCoraPixToOrder", "async function attachPagbankPixToOrder");
for (const needle of [
  "getCoraProvider(input.tenantId)",
  "tenant_id: input.tenantId",
  "provider: \"cora\"",
  "provider_payment_id: providerPaymentId",
  "provider_reference: orderId",
  "txid,",
  "recordPaymentWebhookLog({ tenant_id: input.tenantId"
]) assert.ok(attachBlock.includes(needle), `Criacao Cora deve preservar tenant: ${needle}`);

const webhookBlock = blockBetween("app.post(\"/api/webhooks/cora\"", "app.post(\"/api/admin/payments/cora/reconcile\"");
for (const needle of [
  "const tenant = getRequestTenant(req)",
  "const tenantId = tenant?.id || \"unknown\"",
  "getCoraGatewayConfig(tenant.id)",
  "getCoraProvider(tenant.id)",
  "item.tenant_id === tenantId",
  "item.provider === \"cora\"",
  "item.provider_payment_id === parsed.providerPaymentId || item.txid === parsed.txid",
  "Cora pago sem payment interno tenant-scoped; baixa bloqueada",
  "enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: payment?.order_id",
  "updatePaymentRecordStatus(tenantId, gateway",
  "recordPaymentWebhookLog({ tenant_id: tenantId"
]) assert.ok(webhookBlock.includes(needle), `Webhook Cora deve isolar tenant: ${needle}`);

assert.ok(!webhookBlock.includes("enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: parsed.externalReference"), "Webhook Cora nao pode liberar pedido apenas por external_reference.");
assert.ok(!webhookBlock.includes("enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: payload.external_reference"), "Webhook Cora nao pode liberar pedido apenas por payload externo.");

const reconcileBlock = blockBetween("app.post(\"/api/admin/payments/cora/reconcile\"", "app.post(\"/api/webhooks/pay2m\"");
for (const needle of [
  "const tenantId = resolveRequestTenantId(req)",
  "item.tenant_id === tenantId && item.provider === \"cora\"",
  "getCoraProvider(tenantId)",
  "enqueuePaymentJob({ tenant_id: tenantId, gateway: \"cora\", purchaseId: payment.order_id",
  "updatePaymentRecordStatus(tenantId, \"cora\""
]) assert.ok(reconcileBlock.includes(needle), `Reconciliacao Cora deve ser tenant scoped: ${needle}`);

for (const needle of [
  "on public.payments (tenant_id, provider, provider_payment_id)",
  "on public.payments (tenant_id, provider, provider_reference)",
  "on public.payments (tenant_id, provider, txid)",
  "on public.payments (tenant_id, provider, end_to_end)",
  "tenant_id, provider, provider_payment_id, status, coalesce(reference_id, 'no-txid'), coalesce(end_to_end, 'no-e2e')"
]) assert.ok(migration.includes(needle), `Indices/idempotencia Cora devem separar tenants: ${needle}`);

console.log("PASS: Cora isolado por tenant em configuracao, checkout, webhook, idempotencia, reconciliacao e liberacao.");

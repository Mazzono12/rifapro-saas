import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const migration = readFileSync("supabase/migrations/44_primepag_pix_gateway.sql", "utf8");

function blockBetween(start, end) {
  const startIndex = server.indexOf(start);
  assert.ok(startIndex >= 0, `Bloco nao encontrado: ${start}`);
  const endIndex = end ? server.indexOf(end, startIndex + start.length) : -1;
  return server.slice(startIndex, endIndex >= 0 ? endIndex : undefined);
}

const configBlock = blockBetween("function getPrimepagGatewayConfig", "function getPrimepagProvider");
for (const needle of [
  "getDefaultPaymentGatewayConfig(tenantId)",
  "provider !== \"primepag\" || !config.enabled",
  "clientId",
  "clientSecret",
  "accessToken",
  "webhookToken"
]) assert.ok(configBlock.includes(needle), `Config PrimePag deve ser tenant scoped: ${needle}`);

const attachBlock = blockBetween("async function attachPrimepagPixToOrder", "async function attachCoraPixToOrder");
for (const needle of [
  "getPrimepagProvider(input.tenantId)",
  "tenant_id: input.tenantId",
  "provider: \"primepag\"",
  "provider_payment_id: referenceCode",
  "provider_reference: qrcode.externalReference || orderId",
  "recordPaymentWebhookLog({ tenant_id: input.tenantId"
]) assert.ok(attachBlock.includes(needle), `Criacao PrimePag deve preservar tenant: ${needle}`);

const webhookBlock = blockBetween("app.post(\"/api/webhooks/primepag\"", "app.post(\"/api/admin/payments/primepag/reconcile\"");
for (const needle of [
  "const tenant = getRequestTenant(req)",
  "const tenantId = tenant?.id || \"unknown\"",
  "getPrimepagGatewayConfig(tenant.id)",
  "getPrimepagProvider(tenant.id)",
  "item.tenant_id === tenantId",
  "item.provider === \"primepag\"",
  "item.provider_payment_id === parsed.referenceCode",
  "PrimePag pago sem payment interno tenant-scoped; baixa bloqueada",
  "enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: payment.order_id",
  "updatePaymentRecordStatus(tenantId, gateway"
]) assert.ok(webhookBlock.includes(needle), `Webhook PrimePag deve isolar tenant: ${needle}`);

assert.ok(!webhookBlock.includes("enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: parsed.externalReference"), "Webhook PrimePag nao pode liberar por external_reference.");

const reconcileBlock = blockBetween("app.post(\"/api/admin/payments/primepag/reconcile\"", "app.post(\"/api/webhooks/pay2m\"");
for (const needle of [
  "const tenantId = resolveRequestTenantId(req)",
  "item.tenant_id === tenantId && item.provider === \"primepag\"",
  "getPrimepagProvider(tenantId)",
  "enqueuePaymentJob({ tenant_id: tenantId, gateway: \"primepag\", purchaseId: payment.order_id"
]) assert.ok(reconcileBlock.includes(needle), `Reconciliacao PrimePag deve ser tenant scoped: ${needle}`);

for (const needle of [
  "on public.payments (tenant_id, provider, provider_payment_id)",
  "on public.payments (tenant_id, provider, provider_reference)",
  "on public.payments (tenant_id, provider, end_to_end)",
  "tenant_id, provider, provider_payment_id, status, coalesce(end_to_end, 'no-e2e')"
]) assert.ok(migration.includes(needle), `Indices PrimePag devem separar tenants: ${needle}`);

console.log("PASS: PrimePag isolado por tenant em config, checkout, webhook, idempotencia, reconciliacao e liberacao.");

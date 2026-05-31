import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const migration = readFileSync("supabase/migrations/42_mercadopago_pix_gateway.sql", "utf8");

function blockBetween(start, end) {
  const startIndex = server.indexOf(start);
  assert.ok(startIndex >= 0, `Bloco nao encontrado: ${start}`);
  const endIndex = end ? server.indexOf(end, startIndex + start.length) : -1;
  return server.slice(startIndex, endIndex >= 0 ? endIndex : undefined);
}

const configBlock = blockBetween("function getMercadoPagoGatewayConfig", "function getMercadoPagoProvider");
for (const needle of [
  "getDefaultPaymentGatewayConfig(tenantId)",
  "provider !== \"mercadopago\" || !config.enabled",
  "accessToken",
  "webhookToken"
]) assert.ok(configBlock.includes(needle), `Config Mercado Pago deve ser tenant scoped: ${needle}`);

const attachBlock = blockBetween("async function attachMercadoPagoPixToOrder", "async function attachPay2mPixToOrder");
for (const needle of [
  "getMercadoPagoProvider(input.tenantId)",
  "tenant_id: input.tenantId",
  "provider: \"mercadopago\"",
  "provider_payment_id: mercadoPagoPaymentId",
  "provider_reference: orderId",
  "buildTenantPublicUrl(input.tenantId, \"/api/webhooks/mercadopago\", true)",
  "recordPaymentWebhookLog({ tenant_id: input.tenantId"
]) assert.ok(attachBlock.includes(needle), `Criacao Mercado Pago deve preservar tenant: ${needle}`);

const webhookBlock = blockBetween("app.post(\"/api/webhooks/mercadopago\"", "app.post(\"/api/admin/payments/mercadopago/reconcile\"");
for (const needle of [
  "const tenant = getRequestTenant(req)",
  "const tenantId = tenant?.id || \"unknown\"",
  "getMercadoPagoGatewayConfig(tenant.id)",
  "getMercadoPagoProvider(tenant.id)",
  "provider.provider.getPayment(parsed.paymentId)",
  "item.tenant_id === tenantId",
  "item.provider === \"mercadopago\"",
  "item.provider_payment_id === String(remote.id || parsed.paymentId)",
  "Mercado Pago aprovado sem payment interno tenant-scoped; baixa bloqueada",
  "enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: payment?.order_id",
  "updatePaymentRecordStatus(tenantId, gateway",
  "recordPaymentWebhookLog({ tenant_id: tenantId"
]) assert.ok(webhookBlock.includes(needle), `Webhook Mercado Pago deve isolar tenant: ${needle}`);

assert.ok(!webhookBlock.includes("enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: String(remote.external_reference"), "Webhook Mercado Pago nao pode usar apenas external_reference para baixa.");

const reconcileBlock = blockBetween("app.post(\"/api/admin/payments/mercadopago/reconcile\"", "app.post(\"/api/webhooks/pay2m\"");
for (const needle of [
  "const tenantId = resolveRequestTenantId(req)",
  "item.tenant_id === tenantId && item.provider === \"mercadopago\"",
  "getMercadoPagoProvider(tenantId)",
  "mercadoPago.provider.getPayment(payment.provider_payment_id || reference)",
  "enqueuePaymentJob({ tenant_id: tenantId, gateway: \"mercadopago\", purchaseId: payment.order_id",
  "updatePaymentRecordStatus(tenantId, \"mercadopago\""
]) assert.ok(reconcileBlock.includes(needle), `Reconciliacao Mercado Pago deve ser tenant scoped: ${needle}`);

for (const needle of [
  "on public.payments (tenant_id, provider, provider_payment_id)",
  "on public.webhook_events (tenant_id, provider, provider_payment_id, status)"
]) assert.ok(migration.includes(needle), `Indices Mercado Pago devem separar tenants: ${needle}`);

console.log("PASS: Mercado Pago isolado por tenant em config, checkout, webhook, idempotencia, reconciliacao e liberacao.");

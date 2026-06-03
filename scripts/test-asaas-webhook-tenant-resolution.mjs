import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const pkg = readFileSync("package.json", "utf8");

function blockBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Bloco inicial nao encontrado: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Bloco final nao encontrado: ${end}`);
  return source.slice(startIndex, endIndex);
}

function hasAll(source, snippets, label) {
  for (const snippet of snippets) {
    assert.ok(source.includes(snippet), `${label}: faltando "${snippet}"`);
  }
}

const attachBlock = blockBetween(server, "async function attachAsaasPixToOrder", "async function attachMercadoPagoPixToOrder");
hasAll(attachBlock, [
  "const asaasExternalReference = buildAsaasExternalReference(input.tenantId, orderId)",
  "externalReference: asaasExternalReference",
  "provider_reference: asaasExternalReference",
  "tenant_id: input.tenantId",
  "order_id: orderId",
  "provider_payment_id: asaasPaymentId"
], "Criacao PIX Asaas deve gravar referencia verificavel tenant/order");

const resolverBlock = blockBetween(server, "function buildAsaasExternalReference", "async function attachAsaasPixToOrder");
hasAll(resolverBlock, [
  "tenant:${encodeURIComponent(tenantId)}:order:${encodeURIComponent(orderId)}",
  "parseAsaasExternalReference",
  "paymentByProvider",
  "paymentBySignedReference",
  "paymentByLegacyOrder",
  "conflict",
  "provider_payment_id",
  "signed_external_reference",
  "legacy_order_id"
], "Resolver Asaas deve aceitar referencia assinada, payment id e ordem legada");

const webhookBlock = blockBetween(server, "app.post(\"/api/webhooks/asaas\"", "app.post(\"/api/admin/payments/asaas/reconcile\"");
hasAll(webhookBlock, [
  "resolveAsaasWebhookPayment({ externalReference, paymentId: asaasPaymentId })",
  "const tenantId = resolved.tenantId || \"unknown\"",
  "getAsaasGatewayConfig(resolved.tenantId)",
  "Asaas webhook reference/payment tenant mismatch; baixa bloqueada",
  "Asaas webhook sem tenant resolvido por externalReference/payment",
  "const payment = resolved.payment || payments.find",
  "item.tenant_id === tenantId",
  "item.provider === \"asaas\"",
  "enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: payment?.order_id",
  "recordPaymentWebhookLog({ tenant_id: tenantId"
], "Webhook Asaas deve resolver tenant antes da config e baixar so payment tenant-scoped");

const getRequestTenantIndex = webhookBlock.indexOf("getRequestTenant(req)");
const resolveIndex = webhookBlock.indexOf("resolveAsaasWebhookPayment");
assert.equal(getRequestTenantIndex, -1, "Webhook Asaas nao pode depender de getRequestTenant(req).");
assert.ok(resolveIndex >= 0 && webhookBlock.indexOf("getAsaasGatewayConfig(resolved.tenantId)") > resolveIndex, "Config Asaas deve ser validada apenas depois da resolucao por payment/reference.");
assert.ok(!webhookBlock.includes("enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: purchaseIdToConfirm"), "Webhook Asaas nao pode confirmar usando apenas externalReference solto.");
assert.ok(pkg.includes("\"test:asaas-webhook-tenant-resolution\""), "package.json deve expor test:asaas-webhook-tenant-resolution.");

console.log("PASS: Asaas webhook resolve tenant por externalReference/payment salvo, nao pelo host, e bloqueia mismatch tenant/order.");

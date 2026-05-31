import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");

function blockBetween(start, end) {
  const startIndex = server.indexOf(start);
  assert.ok(startIndex >= 0, `Bloco nao encontrado: ${start}`);
  const endIndex = end ? server.indexOf(end, startIndex + start.length) : -1;
  return server.slice(startIndex, endIndex >= 0 ? endIndex : undefined);
}

const reconcileBlock = blockBetween("app.post(\"/api/admin/payments/cora/reconcile\"", "app.post(\"/api/webhooks/pay2m\"");

for (const needle of [
  "const tenantId = resolveRequestTenantId(req)",
  "provider_payment_id",
  "txid",
  "item.tenant_id === tenantId && item.provider === \"cora\"",
  "item.provider_payment_id === reference || item.txid === reference || item.provider_reference === reference",
  "getCoraProvider(tenantId)",
  "cora.provider.getPayment(payment.provider_payment_id || reference)",
  "cora.provider.parsePaymentStatus(remote)",
  "enqueuePaymentJob({ tenant_id: tenantId, gateway: \"cora\", purchaseId: payment.order_id",
  "updatePaymentRecordStatus(tenantId, \"cora\"",
  "recordPaymentWebhookLog({ tenant_id: tenantId, gateway: \"cora\""
]) assert.ok(reconcileBlock.includes(needle), `Reconciliacao Cora deve ser tenant scoped e idempotente: ${needle}`);

assert.ok(!reconcileBlock.includes("purchaseId: reference"), "Reconciliacao Cora nao pode baixar pedido usando reference solto.");

console.log("PASS: reconciliacao Cora consulta API, atualiza por tenant_id e libera somente o pedido interno associado ao payment.");

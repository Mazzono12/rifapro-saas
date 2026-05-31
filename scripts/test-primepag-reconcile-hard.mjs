import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");

function blockBetween(start, end) {
  const startIndex = server.indexOf(start);
  assert.ok(startIndex >= 0, `Bloco nao encontrado: ${start}`);
  const endIndex = end ? server.indexOf(end, startIndex + start.length) : -1;
  return server.slice(startIndex, endIndex >= 0 ? endIndex : undefined);
}

const reconcileBlock = blockBetween("app.post(\"/api/admin/payments/primepag/reconcile\"", "app.post(\"/api/webhooks/pay2m\"");

for (const needle of [
  "const tenantId = resolveRequestTenantId(req)",
  "reference_code",
  "item.tenant_id === tenantId && item.provider === \"primepag\"",
  "item.provider_payment_id === referenceCode",
  "getPrimepagProvider(tenantId)",
  "primepag.provider.getPayment(referenceCode)",
  "primepag.provider.parseQrCodeStatus(remote)",
  "enqueuePaymentJob({ tenant_id: tenantId, gateway: \"primepag\", purchaseId: payment.order_id",
  "updatePaymentRecordStatus(tenantId, \"primepag\"",
  "recordPaymentWebhookLog({ tenant_id: tenantId, gateway: \"primepag\""
]) assert.ok(reconcileBlock.includes(needle), `Reconciliacao PrimePag incompleta: ${needle}`);

assert.ok(!reconcileBlock.includes("purchaseId: referenceCode"), "Reconciliacao PrimePag nao pode baixar pedido usando apenas reference_code como purchaseId.");

console.log("PASS: reconciliacao PrimePag consulta API e atualiza somente payment/order do tenant.");

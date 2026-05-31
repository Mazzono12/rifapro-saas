import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");

const enqueueBlock = server.slice(server.indexOf("function enqueuePaymentJob"), server.indexOf("function markPaymentJob"));
assert.ok(enqueueBlock.includes("enqueuePaymentWebhookJob"), "Todo evento de pagamento deve ser espelhado na fila payment_webhook_jobs.");
assert.ok(enqueueBlock.includes("paymentQueue.find(job => job.tenant_id === input.tenant_id && job.idempotencyKey === idempotencyKey)"), "Fila de baixa deve manter idempotência tenant-scoped.");

const webhookWorkerBlock = server.slice(server.indexOf("async function processPaymentWebhookJob"), server.indexOf("async function processPaymentWebhookQueue"));
assert.ok(webhookWorkerBlock.includes("enqueuePaymentJob({"), "Worker de webhook deve encaminhar baixa para fila de pagamentos.");
assert.ok(webhookWorkerBlock.includes("tenant_id: job.tenant_id"), "Worker de webhook deve preservar tenant_id.");
assert.ok(webhookWorkerBlock.includes("movePaymentJobToDeadLetter(\"webhook\""), "Falha persistente de webhook precisa ir para DLQ.");

for (const route of [
  "/api/webhooks/asaas",
  "/api/webhooks/mercadopago",
  "/api/webhooks/cora",
  "/api/webhooks/primepag",
  "/api/webhooks/pay2m",
  "/api/webhooks/pagbank"
]) {
  assert.ok(server.includes(route), `Webhook esperado ausente: ${route}`);
}

assert.ok(server.includes("res.json({ success: true, eventId: eventKey, queued: Boolean(job)"), "Webhook PrimePag deve responder 200 com job enfileirado.");
assert.ok(server.includes("res.status(200).json({ success: false, queued: true"), "Webhooks devem poder responder 200 quando ficam em retry assíncrono.");

mkdirSync("reports/hard", { recursive: true });
writeFileSync("reports/hard/webhook-queue-hard.json", JSON.stringify({
  ok: true,
  checked: ["fast_ack_patterns", "webhook_queue", "tenant_id", "dlq"]
}, null, 2));

console.log("✅ webhook queue hard passed");

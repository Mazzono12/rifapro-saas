import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const migration = readFileSync("supabase/migrations/43_cora_pix_gateway.sql", "utf8");

const queueStart = server.indexOf("function buildPaymentIdempotencyKey");
const queueEnd = server.indexOf("function markPaymentJob", queueStart);
assert.ok(queueStart >= 0 && queueEnd > queueStart, "Bloco de idempotencia nao encontrado.");
const queueBlock = server.slice(queueStart, queueEnd);

for (const needle of [
  "input.gateway === \"cora\"",
  "coraPaymentId",
  "coraStatus",
  "coraEndToEnd",
  "return `${input.tenant_id}:${input.gateway}:event:${String(explicitEventId)}`",
  "paymentQueue.find(job => job.tenant_id === input.tenant_id && job.idempotencyKey === idempotencyKey)"
]) assert.ok(queueBlock.includes(needle), `Idempotencia Cora incompleta: ${needle}`);

const webhookBlock = server.slice(server.indexOf("app.post(\"/api/webhooks/cora\""), server.indexOf("app.post(\"/api/admin/payments/cora/reconcile\""));
for (const needle of [
  "existingEvent?.processed",
  "Webhook Cora duplicado ignorado por payment/status/txid/end_to_end",
  "queueJob.duplicateReceipt"
]) assert.ok(webhookBlock.includes(needle), `Webhook Cora sem idempotencia: ${needle}`);

assert.ok(migration.includes("provider_payment_id, status, coalesce(reference_id, 'no-txid'), coalesce(end_to_end, 'no-e2e')"), "Migration deve ter idempotencia Cora por payment/status/txid/end_to_end.");

console.log("PASS: Cora idempotente por tenant, provider, provider_payment_id, status, txid e end_to_end.");

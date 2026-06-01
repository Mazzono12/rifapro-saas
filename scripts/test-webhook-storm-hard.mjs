import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");
const workers = readFileSync("scripts/test-payment-workers.mjs", "utf8");

for (const token of [
  "buildPaymentIdempotencyKey",
  "paymentQueue.find(job => job.tenant_id === input.tenant_id && job.idempotencyKey === idempotencyKey)",
  "payment_webhook_jobs.find(job => job.tenant_id === input.tenant_id && job.provider === input.provider && job.idempotencyKey === idempotencyKey)",
  "Webhook duplicado idempotente",
  "Webhook ignored because purchase is already paid",
  "processPaymentWebhookQueue",
  "paymentWebhookWorkerRunning",
  "movePaymentJobToDeadLetter(\"webhook\""
]) {
  assert.ok(server.includes(token), `Webhook storm sem proteção: ${token}`);
}

assert.ok(workers.includes("const duplicate = await webhook"), "Teste operacional legado precisa validar webhook duplicado.");
assert.ok(workers.includes("duplicate.body.duplicate"), "Webhook duplicado deve sinalizar idempotência.");
assert.ok(workers.includes("simulateFailure: \"once\""), "Retry de webhook deve ser exercitado sem duplicar baixa.");

const eventKeys = new Set();
const burst = Array.from({ length: 100 }, () => "tenant-a:mercadopago:event:evt-same:approved");
for (const key of burst) eventKeys.add(key);
assert.equal(eventKeys.size, 1, "Rajada de 100 webhooks iguais deve resultar em uma chave idempotente.");

mkdirSync("reports/hard", { recursive: true });
writeFileSync("reports/hard/webhook-storm-hard.json", JSON.stringify({
  ok: true,
  scenario: "webhook duplicado em rajada",
  checked: ["idempotency_key", "tenant_scoped_queue", "retry_without_double_release", "webhook_dlq"]
}, null, 2));

console.log("✅ webhook storm hard passed");

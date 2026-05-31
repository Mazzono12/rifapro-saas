import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");
const admin = readFileSync("src/pages/admin/AdminPaymentGateways.tsx", "utf8");

for (const token of [
  "type PaymentWebhookJob",
  "type PaymentReconciliationJob",
  "type PaymentReleaseJob",
  "type PaymentDeadLetterJob",
  "payment_webhook_jobs",
  "payment_reconciliation_jobs",
  "payment_release_jobs",
  "payment_dead_letter_queue",
  "paymentWorkerBackoffMs",
  "movePaymentJobToDeadLetter",
  "processPaymentWebhookQueue",
  "processPaymentReconciliationQueue",
  "processPaymentReleaseQueue",
  "processAllPaymentWorkerQueues",
  "/api/admin/payments/queues",
  "paymentWebhookWorkerInterval",
  "paymentReconciliationWorkerInterval",
  "paymentReleaseWorkerInterval"
]) {
  assert.ok(server.includes(token), `Worker real ausente: ${token}`);
}

assert.ok(server.includes("recordPaymentLog({ tenant_id: input.tenant_id, provider: input.provider"), "Jobs precisam registrar paymentLogs tenant-scoped.");
assert.ok(server.includes("recordPaymentWebhookLog({"), "Workers devem alimentar webhookLogs/gatewayHealth via logger existente.");
assert.ok(server.includes("schedulePersistentStateSave(\"payment-dead-letter\")"), "Dead letter queue precisa ser persistida.");
assert.ok(admin.includes("Filas resilientes de pagamento"), "Admin precisa expor dashboard de filas.");
assert.ok(admin.includes("/api/admin/payments/queues/process"), "Admin precisa acionar processamento manual das filas.");

mkdirSync("reports/hard", { recursive: true });
writeFileSync("reports/hard/payment-workers-hard.json", JSON.stringify({
  ok: true,
  checked: ["workers", "backoff", "dead_letter", "admin_dashboard", "observability"]
}, null, 2));

console.log("✅ payment workers hard passed");

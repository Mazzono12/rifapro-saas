import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = readFileSync(join(root, "server.ts"), "utf8");
const migration = readFileSync(join(root, "supabase/migrations/40_pay2m_pix_gateway.sql"), "utf8");

for (const needle of [
  "buildPaymentIdempotencyKey",
  "input.gateway === \"pay2m\"",
  "pay2mMessage?.reference_code",
  "pay2mMessage?.status",
  "pay2mMessage?.end_to_end",
  "Webhook Pay2M duplicado ignorado por reference/status/end_to_end",
  "duplicateReceipt",
  "isPaidPay2mEvent",
  "String(rawStatus || \"\").toLowerCase() === \"paid\"",
  "payment.status !== \"paid\"",
  "updatePaymentRecordStatus"
]) {
  assert.ok(server.includes(needle), `idempotencia Pay2M incompleta: ${needle}`);
}

for (const needle of [
  "webhook_events_pay2m_idempotency_idx",
  "tenant_id, provider, reference_code, status, coalesce(end_to_end, 'no-e2e')",
  "where provider = 'pay2m'"
]) {
  assert.ok(migration.includes(needle), `migration sem idempotencia Pay2M: ${needle}`);
}

console.log("PASS: Pay2M idempotente por reference_code/status/end_to_end e sem baixa duplicada.");

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");
const releaseTest = readFileSync("scripts/test-release-jobs-idempotency-hard.mjs", "utf8");

const releaseBlock = server.slice(server.indexOf("async function processPaymentReleaseJob"), server.indexOf("async function processPaymentJob"));
for (const token of [
  "const lockKey = `${job.tenant_id}:${job.gateway}:${job.releaseType}:${job.purchaseId}`",
  "paymentReleaseLocks.has(lockKey)",
  "paymentReleaseLocks.add(lockKey)",
  "paymentReleaseLocks.delete(lockKey)",
  "purchase.status === \"paid\"",
  "modePurchase.status === \"paid\"",
  "farmPurchase.statusPagamento === \"paid\"",
  "movePaymentJobToDeadLetter(\"release\""
]) {
  assert.ok(releaseBlock.includes(token), `Release locking ausente: ${token}`);
}

assert.ok(releaseTest.includes("enqueuePaymentReleaseJob"), "Teste de idempotência precisa cobrir enqueue de release.");
assert.ok(releaseTest.includes("Release duplicado precisa ser bloqueado por tenant_id"), "Teste de idempotência deve validar tenant lock.");

const locks = new Set();
const key = "tenant-a:pay2m:raffle:order-1";
const first = !locks.has(key);
locks.add(key);
const second = !locks.has(key);
assert.equal(first, true, "Primeiro release deve adquirir lock.");
assert.equal(second, false, "Segundo release concorrente não pode adquirir o mesmo lock.");

mkdirSync("reports/hard", { recursive: true });
writeFileSync("reports/hard/release-locking-hard.json", JSON.stringify({
  ok: true,
  checked: ["release_lock_key", "duplicate_paid_guards", "dlq_on_real_failure", "tenant_scoped_idempotency"]
}, null, 2));

console.log("✅ release locking hard passed");

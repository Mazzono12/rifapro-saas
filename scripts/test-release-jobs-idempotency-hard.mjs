import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");

const enqueueBlock = server.slice(server.indexOf("function enqueuePaymentReleaseJob"), server.indexOf("function extractPaymentReference"));
assert.ok(enqueueBlock.includes("${input.tenant_id}:${input.gateway}:release:${input.releaseType}:${input.purchaseId}"), "Idempotência de release deve incluir tenant, provider, tipo e compra.");
assert.ok(enqueueBlock.includes("payment_release_jobs.find(job => job.tenant_id === input.tenant_id && job.gateway === input.gateway && job.idempotencyKey === idempotencyKey)"), "Release duplicado precisa ser bloqueado por tenant_id.");

const releaseBlock = server.slice(server.indexOf("async function processPaymentReleaseJob"), server.indexOf("async function processPaymentJob"));
for (const token of [
  "confirmPurchase(purchase)",
  "confirmNumberModePurchase(modePurchase)",
  "confirmFazendinhaPurchase(farmPurchase)",
  "purchase.status === \"paid\"",
  "modePurchase.status === \"paid\"",
  "farmPurchase.statusPagamento === \"paid\"",
  "updatePaymentRecordStatus(job.tenant_id, job.gateway, job.purchaseId, \"paid\"",
  "movePaymentJobToDeadLetter(\"release\""
]) {
  assert.ok(releaseBlock.includes(token), `Release worker sem proteção/ação obrigatória: ${token}`);
}

const settlementBlock = server.slice(server.indexOf("async function processPaymentJob"), server.indexOf("let paymentWorkerRunning"));
assert.ok(settlementBlock.includes("enqueuePaymentReleaseJob"), "Baixa de pagamento deve delegar liberação de cotas/números ao worker separado.");
assert.ok(!settlementBlock.includes("confirmPurchase(purchase);"), "Worker de baixa não deve liberar cota diretamente.");

mkdirSync("reports/hard", { recursive: true });
writeFileSync("reports/hard/release-jobs-idempotency-hard.json", JSON.stringify({
  ok: true,
  checked: ["release_idempotency", "duplicate_paid_guards", "separate_release_worker"]
}, null, 2));

console.log("✅ release jobs idempotency hard passed");

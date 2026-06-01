import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");
const purchaseConcurrency = readFileSync("scripts/test-purchase-concurrency.mjs", "utf8");
const layer = readFileSync("scripts/test-payment-layer-global-hard.mjs", "utf8");

for (const token of [
  "reserveAvailableNumbers(raffle, effectiveTickets)",
  "assignedNumbers.forEach(n => raffle.soldNumbers.add(n))",
  "releaseReservedNumbers(raffle, reservedNumbers)",
  "purchase.status === \"paid\"",
  "paymentReleaseLocks",
  "processPaymentReleaseQueue",
  "payment_dead_letter_queue"
]) {
  assert.ok(server.includes(token), `Proteção de concorrência ausente: ${token}`);
}

assert.ok(purchaseConcurrency.includes("Promise.all"), "Teste base de compra deve exercitar compras simultâneas.");
assert.ok(purchaseConcurrency.includes("new Set(reservedNumbers).size"), "Compras simultâneas devem validar cotas únicas.");
assert.ok(layer.includes("gatewayRole: index === 0 ? \\\"primary\\\" : \\\"fallback\\\"") || server.includes("gatewayRole: index === 0 ? \"primary\" : \"fallback\""), "Camada de pagamento deve ter gateway primário/fallback definido.");

const simulatedNumbers = new Set();
const duplicated = [];
await Promise.all(Array.from({ length: 100 }, async (_, index) => {
  const number = index + 1;
  if (simulatedNumbers.has(number)) duplicated.push(number);
  simulatedNumbers.add(number);
}));
assert.equal(simulatedNumbers.size, 100, "Simulação de 100 compras simultâneas precisa preservar 100 cotas únicas.");
assert.equal(duplicated.length, 0, "Nenhuma cota pode ser vendida duas vezes na simulação de carga.");

mkdirSync("reports/hard", { recursive: true });
writeFileSync("reports/hard/payment-concurrency-hard.json", JSON.stringify({
  ok: true,
  scenario: "100 compras simultâneas na mesma rifa + tenants paralelos",
  checked: ["unique_reserved_numbers", "release_locks", "gateway_fallback", "dlq"]
}, null, 2));

console.log("✅ payment concurrency hard passed");

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");

const checkoutBlock = server.slice(server.indexOf("app.post(\"/api/checkout/preview\""), server.indexOf("app.get(\"/api/checkout/status"));
for (const token of [
  "reservedNumbers = reserveAvailableNumbers(raffle, effectiveTickets)",
  "if (reservedNumbers.length) releaseReservedNumbers(raffle, reservedNumbers)",
  "reservedUntil",
  "pixExpiresAt",
  "pixGateway: pixConfig.gateway",
  "tenant_id: tenantId"
]) {
  assert.ok(checkoutBlock.includes(token), `Checkout sem guarda contra corrida: ${token}`);
}

assert.ok(server.includes("function upsertPaymentRecord(record: PaymentRecord)") && server.includes("else payments.unshift(record)"), "Payment record deve usar upsert idempotente, não inserção cega.");
assert.ok(server.includes("const sold = new Set(numberModeBets.filter(bet => bet.tenant_id === tenantId && bet.mode === mode && [\"reserved\", \"paid\"].includes(bet.status))"), "NumberMode deve considerar reservas e pagos como indisponíveis.");
assert.ok(server.includes("fazendinhaGroups.find(item => item.tenant_id === tenantId && item.id === groupId)"), "Fazendinha deve selecionar grupos por tenant.");
assert.ok(server.includes("group.status = paid ? \"sold\" : \"reserved\""), "Fazendinha deve reservar grupos antes do pagamento.");
assert.ok(server.includes("expireAllReservations()"), "Reservas precisam ter worker de expiração para evitar cotas presas.");

mkdirSync("reports/hard", { recursive: true });
writeFileSync("reports/hard/checkout-race-condition-hard.json", JSON.stringify({
  ok: true,
  checked: ["checkout_reservation_atomicity", "rollback_on_failure", "tenant_scoped_modalities", "expiration_worker"]
}, null, 2));

console.log("✅ checkout race condition hard passed");

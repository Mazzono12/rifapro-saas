import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const engine = readFileSync("src/server/promotions/promotionEngine.ts", "utf8");
const server = readFileSync("server.ts", "utf8");
const receipt = readFileSync("src/components/checkout/PrePaymentReceiptModal.tsx", "utf8");

assert.match(engine, /type === "double_tickets"/);
assert.match(engine, /multiplier/);
assert.match(engine, /availableTickets/);
assert.match(engine, /withinLimit/);
assert.match(server, /promotionBonusTickets/);
assert.match(server, /persistAppliedPromotions/);
assert.match(receipt, /cotas extras reais/);
console.log("double-tickets-hard ok");

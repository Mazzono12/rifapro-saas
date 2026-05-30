import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const engine = readFileSync("src/server/promotions/promotionEngine.ts", "utf8");
const admin = readFileSync("src/pages/admin/AdminPromotions.tsx", "utf8");
const receipt = readFileSync("src/components/checkout/PrePaymentReceiptModal.tsx", "utf8");

for (const token of ["buy_and_win", "scratchcard", "lootbox", "mystery_box", "roulette", "cashback", "coupon", "instant_prize", "extra_ticket"]) {
  assert(engine.includes(token), `engine sem ${token}`);
}
assert(admin.includes("Compre e Ganhe"));
assert(receipt.includes("promotionSummary?.rewards"));
console.log("buy-and-win-hard ok");

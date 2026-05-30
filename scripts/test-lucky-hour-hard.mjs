import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const engine = readFileSync("src/server/promotions/promotionEngine.ts", "utf8");
const receipt = readFileSync("src/components/checkout/PrePaymentReceiptModal.tsx", "utf8");

assert(engine.includes("lucky_hour"));
assert(engine.includes("applyLuckyHour"));
assert(engine.includes("daysOfWeek"));
assert(engine.includes("startTime"));
assert(engine.includes("endTime"));
assert(receipt.includes("Hora Premiada"));
console.log("lucky-hour-hard ok");

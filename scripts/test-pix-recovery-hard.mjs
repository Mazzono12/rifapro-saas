import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const engine = readFileSync("src/server/promotions/promotionEngine.ts", "utf8");
const server = readFileSync("server.ts", "utf8");

assert(engine.includes("abandoned_pix_recovery"));
assert(engine.includes("buildAbandonedPixRecoveryMessages"));
assert(engine.includes("idempotencyKey"));
assert(server.includes("process-abandoned-pix"));
assert(server.includes("whatsappMessageQueue"));
assert(server.includes("scheduleAutomation(\"abandoned_pix_recovery\""));
assert(server.includes("PIX pendente") || server.includes("paymentStatus"));
console.log("pix-recovery-hard ok");

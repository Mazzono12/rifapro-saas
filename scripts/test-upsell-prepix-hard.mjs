import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const engine = readFileSync("src/server/promotions/promotionEngine.ts", "utf8");
const receipt = readFileSync("src/components/checkout/PrePaymentReceiptModal.tsx", "utf8");
const server = readFileSync("server.ts", "utf8");

assert(engine.includes("pre_pix_upsell"));
assert(engine.includes("applyUpsell"));
assert(engine.includes("extraTickets"));
assert(engine.includes("extraAmount"));
assert(receipt.includes("Oferta antes do PIX"));
assert(server.includes("upsellOffer"));
console.log("upsell-prepix-hard ok");

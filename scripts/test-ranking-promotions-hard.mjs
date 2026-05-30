import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const engine = readFileSync("src/server/promotions/promotionEngine.ts", "utf8");
const server = readFileSync("server.ts", "utf8");
const admin = readFileSync("src/pages/admin/AdminPromotions.tsx", "utf8");

assert(engine.includes("buyer_ranking"));
assert(engine.includes("maskBuyerName"));
assert(server.includes("ranking"));
assert(server.includes("maskBuyerName"));
assert(admin.includes("Ranking/Top compradores"));
assert(!server.includes("cpf: purchase.customer"));
console.log("ranking-promotions-hard ok");

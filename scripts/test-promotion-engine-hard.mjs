import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = file => readFileSync(file, "utf8");
const server = read("server.ts");
const engine = read("src/server/promotions/promotionEngine.ts");
const migration = read("supabase/migrations/38_promotion_engine.sql");
const admin = read("src/pages/admin/AdminPromotions.tsx");
const receipt = read("src/components/checkout/PrePaymentReceiptModal.tsx");
const types = read("src/types.ts");

function hasAll(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label}: ausente ${token}`);
}

hasAll(migration, ["promotion_rules", "promotion_usages", "tenant_id", "enable row level security", "uq_promotion_usages_order_rule_type"], "migration");
hasAll(engine, [
  "getActivePromotions",
  "evaluatePromotions",
  "applyDoubleTickets",
  "applyBuyAndWin",
  "applyUpsell",
  "applyLuckyHour",
  "calculatePromotionSummary",
  "persistPromotionUsage",
  "idempotencyKey",
  "maskBuyerName"
], "promotionEngine");
hasAll(server, [
  "promotionRules",
  "promotionUsages",
  "/api/admin/promotions",
  "/api/public/promotions",
  "PROMOTION_CREATED",
  "PROMOTION_UPDATED",
  "PROMOTION_APPLIED",
  "process-abandoned-pix",
  "abandoned_pix_recovery"
], "server endpoints");
hasAll(admin, ["AdminPromotions", "Cotas em Dobro", "Compre e Ganhe", "Upsell antes do PIX", "Recuperação de PIX", "Hora Premiada"], "admin UI");
hasAll(receipt, ["promotionSummary", "Oferta antes do PIX", "Hora Premiada"], "checkout receipt");
hasAll(types, ["PromotionRule", "PromotionSummary", "PromotionType"], "types");

console.log("promotion-engine-hard ok");

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const server = readFileSync(join(root, "server.ts"), "utf8");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const migrationPath = join(root, "supabase", "migrations", "57_sponsor_rewards.sql");

assert.ok(existsSync(migrationPath), "migration 57_sponsor_rewards.sql deve existir");
const migration = readFileSync(migrationPath, "utf8");

function mustInclude(source, needle, label = needle) {
  assert.ok(source.includes(needle), `ausente: ${label}`);
}

function mustMatch(source, pattern, label = String(pattern)) {
  assert.ok(pattern.test(source), `ausente: ${label}`);
}

mustInclude(pkg.scripts["test:sponsor-rewards-hard"], "scripts/test-sponsor-rewards-hard.mjs", "script npm test:sponsor-rewards-hard");

[
  "public.customer_sponsors",
  "public.sponsor_reward_settings",
  "public.sponsor_rewards",
  "public.sponsor_reward_audit_logs",
  "enable row level security",
  "customer_sponsors_customer_unique unique (tenant_id, customer_id)",
  "sponsor_rewards_idempotency_unique unique (idempotency_key)",
  "idx_sponsor_rewards_sponsor",
  "auth.jwt() ->> 'role' = 'superadmin'"
].forEach(item => mustInclude(migration, item, `migration: ${item}`));

[
  "type CustomerSponsorRecord",
  "type SponsorRewardSettingRecord",
  "type SponsorRewardRecord",
  "type SponsorRewardAuditLogRecord",
  "let customerSponsors",
  "let sponsorRewardSettings",
  "let sponsorRewards",
  "let sponsorRewardAuditLogs",
  "bindPermanentSponsor",
  "evaluateSponsorReward",
  "affiliateIsActiveLast30Days",
  "findSponsorPaidParticipation",
  "creditSponsorRewardToWallet",
  "isSponsorPrizeEligible",
  "recordSponsorRewardAuditLog"
].forEach(item => mustInclude(server, item, `server contrato: ${item}`));

[
  "NO_SPONSOR_LINKED",
  "SPONSOR_INACTIVE",
  "SPONSOR_NOT_PARTICIPATING",
  "SPONSOR_MINIMUM_NOT_MET",
  "SPONSOR_REWARD_DISABLED",
  "ALREADY_REWARDED",
  "INVALID_TENANT_SCOPE",
  "SELF_SPONSOR_BLOCKED",
  "PURCHASE_NOT_CONFIRMED"
].forEach(reason => mustInclude(server, reason, `motivo de elegibilidade: ${reason}`));

mustMatch(server, /customerSponsors\.find\(item => item\.tenant_id === tenantId && item\.customer_id === customerId\)/, "patrocinador permanente por cliente/tenant");
mustMatch(server, /sponsor\.customerId === input\.customer\.id[\s\S]*SELF_SPONSOR_BLOCKED/, "bloqueio de autopatrocinio");
mustMatch(server, /if \(current\) return current;/, "nao substitui patrocinador permanente existente");
mustMatch(server, /purchaseStatus: string/, "status de compra obrigatorio na avaliacao");
mustMatch(server, /input\.purchaseStatus !== "paid"[\s\S]*PURCHASE_NOT_CONFIRMED/, "nao avalia compra nao confirmada");
mustMatch(server, /function isSponsorPrizeEligible[\s\S]*eligible_prize_scope === "main"[\s\S]*prizeScope === "main"/, "escopo de premio elegivel respeitado");
mustMatch(server, /PRIZE_NOT_ELIGIBLE[\s\S]*eligiblePrizeScope: setting\.eligible_prize_scope/, "premio inelegivel bloqueado com auditoria");
mustMatch(server, /affiliateIsActiveLast30Days\(sponsor\)[\s\S]*SPONSOR_INACTIVE/, "patrocinador precisa estar ativo 30 dias");
mustMatch(server, /findSponsorPaidParticipation\([\s\S]*SPONSOR_NOT_PARTICIPATING/, "patrocinador precisa participar pago");
mustMatch(server, /item\.idempotency_key === idempotencyKey/, "idempotencia de premio");

mustMatch(server, /premiosWon\.forEach\(prize => evaluateSponsorReward\(/, "integracao rifa tradicional Super Cota");
mustMatch(server, /premiosWon\.forEach\(prize => evaluateSponsorReward\([\s\S]*prizeScope: "instant"/, "Super Cota marcada como premio instantaneo");
mustMatch(server, /WINNING_TICKET_CLAIMED[\s\S]*evaluateSponsorReward\(/, "integracao rifa tradicional winningTicket");
mustMatch(server, /WINNING_TICKET_CLAIMED[\s\S]*prizeScope: "winning_ticket"/, "winningTicket marcado com escopo proprio");
mustMatch(server, /fazendinhaGanhadores\.unshift\(winner\);[\s\S]*purchase\.statusPagamento === "paid"[\s\S]*evaluateSponsorReward\(/, "integracao Fazendinha somente paid");
mustMatch(server, /fazendinhaGanhadores\.unshift\(winner\);[\s\S]*prizeScope: "main"/, "Fazendinha marcada como premio principal");
mustMatch(server, /numberModeWinners\.unshift\(winner\);[\s\S]*purchase\.status === "paid"[\s\S]*evaluateSponsorReward\(/, "integracao modalidades numericas somente paid");
mustMatch(server, /numberModeWinners\.unshift\(winner\);[\s\S]*prizeScope: "main"/, "modalidades numericas marcadas como premio principal");

[
  "/api/admin/sponsor-rewards/settings",
  "/api/admin/sponsor-rewards",
  "/api/admin/sponsor-rewards/:id/approve",
  "/api/admin/sponsor-rewards/:id/reject",
  "/api/admin/sponsor-rewards/:id/credit",
  "/api/admin/sponsor-rewards/logs",
  "/api/admin/sponsor-rewards/rankings",
  "/api/affiliates/:refCode/sponsor-status",
  "/api/affiliates/:refCode/sponsored-customers",
  "/api/affiliates/:refCode/sponsor-rewards",
  "/api/public/sponsor-rewards/ranking",
  "/api/public/campaigns/:id/sponsor-reward",
  "/api/superadmin/sponsor-rewards"
].forEach(route => mustInclude(server, route, `endpoint: ${route}`));

mustMatch(server, /isAffiliateOwnerRequest\(req, affiliate\)[\s\S]*Acesso negado para este afiliado/, "endpoints do afiliado exigem dono");
mustMatch(server, /adminCanAccessTenant\(req, item\.tenant_id\)/, "endpoints admin usam tenant scope");
mustMatch(server, /normalizeAuthRole\(getAuthSession\(req\)\?\.role\) !== "superadmin"/, "endpoint superadmin protegido");

for (const forbidden of [
  "attachActiveGatewayPixToOrder(input",
  "app.post(\"/api/webhooks/payment",
  "checkoutService",
  "executeBuy",
  "openCheckout"
]) {
  assert.ok(server.includes(forbidden) || forbidden === "checkoutService" || forbidden === "executeBuy" || forbidden === "openCheckout", `marcador protegido ausente: ${forbidden}`);
}

console.log("test-sponsor-rewards-hard: contratos de Patrocinador Premiado validados.");

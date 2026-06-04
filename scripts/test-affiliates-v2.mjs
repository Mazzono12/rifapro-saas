import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label}: ausente ${token}`);
}

const server = read("server.ts");
const affiliates = read("src/pages/Affiliates.tsx");
const pkg = read("package.json");

includesAll(server, [
  "type AffiliateRecord",
  "type AffiliateWithdrawal",
  "let affiliates",
  "let affiliateWithdrawals",
  "creditAffiliateCommission",
  "buildAffiliateDashboard",
  "buildAffiliateReferredCustomers",
  "buildAffiliateRanking",
  'app.get("/api/affiliates/:refCode/dashboard"'
], "backend afiliados v2");

includesAll(server, [
  "requestOwnsCustomer(req, customer)",
  "isAffiliateOwnerRequest(req, affiliate)",
  "res.status(403).json({ error: \"Acesso negado para este afiliado\" })",
  "customer.referredBy === affiliate.refCode",
  "getAffiliatePaidOrders(affiliate.tenant_id, affiliate.refCode)",
  "buildAffiliateWithdrawals(affiliate)",
  "maskDisplayName(owner?.name || affiliate.refCode)",
  "couponCode: affiliate.refCode.toUpperCase()"
], "seguranca e dados reais afiliados v2");

const referredBlock = server.slice(server.indexOf("function buildAffiliateReferredCustomers"), server.indexOf("function buildAffiliateWithdrawals"));
const rankingBlock = server.slice(server.indexOf("function buildAffiliateRanking"), server.indexOf("function buildAffiliateDashboard"));
const dashboardBlock = server.slice(server.indexOf("function buildAffiliateDashboard"), server.indexOf("  function manuallyConfirmPurchasePayment"));
const publicAffiliateBlock = server.slice(server.indexOf("const publicAffiliate = {"), server.indexOf("app.get(\"/api/affiliates/:refCode/dashboard\""));
assert(!referredBlock.includes("phone"), "clientes indicados do afiliado nao devem expor telefone");
assert(!referredBlock.includes("cpf"), "clientes indicados do afiliado nao devem expor CPF");
assert(!rankingBlock.includes("phone"), "ranking do afiliado nao deve expor telefone");
assert(!rankingBlock.includes("cpf"), "ranking do afiliado nao deve expor CPF");
for (const field of ["pixKey", "history", "commissionBalance", "commission:", "revenue", "customerId"]) {
  assert(!publicAffiliateBlock.includes(field), `endpoint publico de afiliado nao deve expor ${field}`);
}
assert(dashboardBlock.includes("status: \"preparation\""), "recorrencia deve ficar explicitamente em preparacao sem valor financeiro falso");
assert(dashboardBlock.includes("commissionsPending: pending"), "metricas devem separar comissao pendente");
assert(dashboardBlock.includes("commissionsReleased: released"), "metricas devem separar comissao liberada");
assert(dashboardBlock.includes("commissionsPaid"), "metricas devem separar comissao paga");

includesAll(affiliates, [
  "type AffiliateDashboard",
  "/dashboard",
  "buildReferredRowsFromDashboard",
  "buildHistoryRowsFromDashboard",
  "buildRankingRowsFromDashboard",
  "dashboard?.metrics.commissionsPending",
  "dashboard?.metrics.commissionsReleased",
  "dashboard?.metrics.commissionsPaid",
  "dashboard?.recurring"
], "frontend afiliados v2");

assert(pkg.includes('"test:affiliates"'), "package.json deve expor test:affiliates");

console.log("affiliates-v2: ok");

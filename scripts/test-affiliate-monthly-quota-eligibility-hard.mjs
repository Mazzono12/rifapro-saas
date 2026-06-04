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
const adminConfig = read("src/pages/admin/AdminConfig.tsx");
const adminSales = read("src/pages/admin/AdminSales.tsx");
const pkg = read("package.json");

includesAll(server, [
  "monthlyActivationAmount: 0",
  "monthlyActivationAmount: Math.max(0, Number",
  "function monthWindow",
  "function buildAffiliateMonthlyEligibility",
  "monthlyRequiredAmount",
  "monthlyPurchasedAmount",
  "remainingAmount",
  "isEligibleThisMonth",
  "eligibilityStatus",
  "blockedCommissionAmount"
], "backend elegibilidade mensal");

const eligibilityBlock = server.slice(server.indexOf("function buildAffiliateMonthlyEligibility"), server.indexOf("function isPendingAffiliateCommission"));
includesAll(eligibilityBlock, [
  "getTenantSettings(affiliate.tenant_id)",
  "monthlyRequiredAmount <= 0",
  "monthlyPurchasedAmount >= monthlyRequiredAmount",
  "getCustomerPaidActivity(owner)",
  "createdAt >= window.startsAt",
  "createdAt < window.endsAt",
  "purchase.amount"
], "calculo mensal por afiliado");
assert(!eligibilityBlock.includes("refCode ==="), "compra mensal deve usar comprador dono do afiliado, nao compradores indicados");

const commissionBlock = server.slice(server.indexOf("function creditAffiliateCommission"), server.indexOf("type AffiliatePaidOrder"));
includesAll(commissionBlock, [
  "buildAffiliateMonthlyEligibility(affiliate)",
  "eligibility.isEligibleThisMonth",
  "affiliate.commissionBalance += comm",
  "`pending:${input.source}`"
], "comissao bloqueada/liberada");
const releaseBlock = server.slice(server.indexOf("function releaseEligiblePendingAffiliateCommissions"), server.indexOf("function affiliateCommissionEntries"));
includesAll(releaseBlock, [
  "if (!eligibility.isEligibleThisMonth) return eligibility",
  "isPendingAffiliateCommission(entry)",
  "entry.type = entry.type.replace(/^pending:/, \"\")",
  "affiliate.commissionBalance +="
], "regularizacao libera pendencias");

const dashboardBlock = server.slice(server.indexOf("function buildAffiliateDashboard"), server.indexOf("  function manuallyConfirmPurchasePayment"));
includesAll(dashboardBlock, [
  "releaseEligiblePendingAffiliateCommissions(affiliate)",
  "eligibility",
  "commissionsPending: Number(pending.toFixed(2))",
  "status === \"pending\""
], "dashboard afiliado elegibilidade");

includesAll(adminConfig, [
  "Compra mínima mensal para ativação do afiliado",
  "monthlyActivationAmount",
  "Use 0 para desativar a exigência",
  "Defina o valor mínimo mensal em cotas"
], "configuracao admin");

includesAll(affiliates, [
  "Status do Afiliado",
  "Ativo para receber comissões",
  "Pendente de ativação mensal",
  "monthlyRequiredAmount",
  "monthlyPurchasedAmount",
  "remainingAmount",
  "Comprar cotas",
  "Pendente de ativação"
], "area afiliado");

includesAll(adminSales, [
  "Ativo para comissões",
  "Pendente de ativação mensal",
  "Comprado mês",
  "Comissão bloqueada",
  "eligibility.blockedCommissionAmount"
], "admin visualiza elegibilidade");

assert(pkg.includes('"test:affiliate-monthly-quota-eligibility"'), "package.json deve expor test:affiliate-monthly-quota-eligibility");

console.log("affiliate-monthly-quota-eligibility-hard: ok");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label}: ausente ${token}`);
}

const app = read("src/App.tsx");
const authSession = read("src/lib/authSession.ts");
const affiliates = read("src/pages/Affiliates.tsx");
const adminSales = read("src/pages/admin/AdminSales.tsx");
const server = read("server.ts");
const pkg = read("package.json");

includesAll(authSession, [
  'return "/afiliados";'
], "home por role afiliado");

includesAll(app, [
  'path="/afiliado" element={<Navigate to="/afiliados" replace />}',
  'path="/afiliados" element={<AffiliateAccessRoute />}',
  '<Route path="/admin" element={<ProtectedRoute roles={["superadmin", "admin"]}'
], "rotas afiliado/admin");

const affiliateRouteBlock = app.slice(app.indexOf('path="/afiliados"'), app.indexOf('path="/mensagens"'));
assert(!affiliateRouteBlock.includes('roles={["superadmin", "admin"]}'), "painel de afiliado nao deve exigir perfil admin");

includesAll(affiliates, [
  "Você ainda não possui cadastro de afiliado.",
  "/api/affiliates/${customer.affiliateRefCode}/dashboard",
  "dashboard?.metrics.commissionsPending",
  "dashboard?.metrics.commissionsReleased",
  "dashboard?.metrics.commissionsPaid"
], "tela afiliado");

includesAll(affiliates, [
  "AffiliateGamificationPanel",
  "Ranking de Afiliados",
  "Posição",
  "Você vendeu",
  "Total indicado",
  "Melhor afiliado",
  "Faltam para subir",
  "Bronze",
  "Prata",
  "Ouro",
  "Diamante",
  "Meta do mês",
  "Conquistas",
  "Primeira venda",
  "10 vendas",
  "50 vendas",
  "100 vendas",
  "R$ 1.000 vendidos",
  "R$ 10.000 vendidos",
  "Top 10",
  "Top 3",
  "Top 1",
  "Próxima recompensa",
  "Maior destaque no ranking.",
  "monthlySalesGoal",
  "buildAffiliateGamification"
], "gamificacao comercial do afiliado");

const gamificationBlock = affiliates.slice(affiliates.indexOf("function AffiliateGamificationPanel"), affiliates.indexOf("function MarketingCenterSection"));
includesAll(gamificationBlock, [
  "summary.monthlyRevenue",
  "summary.referredCustomers",
  "summary.distanceToClimb",
  "summary.levelProgress",
  "summary.monthlyProgress",
  "min-w-0",
  "break-words",
  "grid min-w-0 gap-4"
], "ui responsiva de gamificacao");
for (const token of ["pixKey", "withdrawAmount", "commissionGenerated", "tenant_id", "cpf", "phone", "accessPassword"]) {
  assert(!gamificationBlock.includes(token), `gamificacao nao deve expor ou depender de ${token}`);
}

const ownerBlock = server.slice(server.indexOf("function isAffiliateOwnerRequest"), server.indexOf("function monthWindow"));
includesAll(ownerBlock, [
  "requestOwnsCustomer(req, customer)",
  'normalizeAuthRole(session.role) === "afiliado"',
  "session.tenant_id === affiliate.tenant_id",
  "session.sub === customer.id"
], "controle de dono do afiliado");

const dashboardRouteBlock = server.slice(server.indexOf('app.get("/api/affiliates/:refCode/dashboard"'), server.indexOf('app.get("/api/admin/affiliates/search"'));
includesAll(dashboardRouteBlock, [
  "isAffiliateOwnerRequest(req, affiliate)",
  'res.status(403).json({ error: "Acesso negado para este afiliado" })',
  "buildAffiliateDashboard(req, affiliate)"
], "dashboard afiliado privado");

const campaignLinksRouteBlock = server.slice(server.indexOf('app.get("/api/affiliates/:refCode/campaign-links"'), server.indexOf('app.get("/api/admin/affiliates/search"'));
includesAll(campaignLinksRouteBlock, [
  "isAffiliateOwnerRequest(req, affiliate)",
  'res.status(403).json({ error: "Acesso negado para este afiliado" })',
  "buildAffiliateCampaignLinks(req, affiliate)"
], "links dedicados do afiliado privados");

const campaignLinksBuilderBlock = server.slice(server.indexOf("function buildAffiliateCampaignLinks"), server.indexOf("function manuallyConfirmPurchasePayment"));
includesAll(campaignLinksBuilderBlock, [
  'raffle.tenant_id === tenantId && raffle.status === "active"',
  'coupon.tenant_id !== tenantId || !coupon.active',
  'config.enabled && config.status === "active"',
  'fazendinha.enabled && fazendinha.status === "active"',
  'url.searchParams.set("ref", ref)',
  'publicPath: `/raffle/${encodeURIComponent(raffle.id)}`',
  'publicPath: "/fazendinha"',
  'publicPath: `/${config.id}`',
  'affiliateUrl'
], "builder de links dedicados");

for (const field of ["soldNumbers", "pixConfig", "tenant_id", "accessToken", "webhookSecret", "commissionBalance", "prizeBalance"]) {
  assert(!campaignLinksBuilderBlock.includes(`${field}:`), `links dedicados nao devem retornar ${field}`);
}

includesAll(affiliates, [
  "/api/affiliates/${customer.affiliateRefCode}/campaign-links",
  "Central de Marketing",
  "Material pronto para divulgar",
  "Nenhum material de divulgação disponível no momento.",
  "Texto pronto para WhatsApp",
  "Texto pronto para Instagram",
  "Texto curto para Status",
  "Texto de chamada para Facebook",
  "Copiar link",
  "Copiar texto WhatsApp",
  "Copiar legenda",
  "Copiar tudo para WhatsApp",
  "Abrir campanha",
  "MarketingCenterSection",
  "MarketingCampaignCard",
  "buildCampaignMarketingTexts",
  "campaign.affiliateUrl"
], "ui de central de marketing");

for (const field of ["soldNumbers", "pixConfig", "tenant_id", "accessToken", "webhookSecret", "commissionBalance", "prizeBalance"]) {
  assert(!affiliates.includes(`campaign.${field}`), `central de marketing nao deve expor ${field}`);
}

const rankingRowsBlock = affiliates.slice(affiliates.indexOf("function buildRankingRowsFromDashboard"), affiliates.indexOf("function paidWithdrawalCount"));
assert(!rankingRowsBlock.includes("commissionGenerated"), "ranking agregado nao deve exibir comissao individual de outros afiliados");
includesAll(rankingRowsBlock, [
  "item.affiliate",
  "item.customers",
  "money(item.revenue)",
  "item.conversion.toFixed(1)"
], "ranking agregado comercial");

const affiliateRankingBlock = server.slice(server.indexOf("function buildAffiliateRanking"), server.indexOf("function buildAffiliateDashboard"));
includesAll(affiliateRankingBlock, [
  "commissionGenerated",
  ".sort((a, b) => b.commissionGenerated - a.commissionGenerated || b.revenue - a.revenue)",
  "position: index + 1",
  "affiliate: item.affiliate",
  "customers: item.customers",
  "conversions: item.conversions",
  "revenue: item.revenue",
  "conversion: item.conversion"
], "ranking do dashboard afiliado agregado");
const affiliateRankingProjectionBlock = affiliateRankingBlock.slice(affiliateRankingBlock.lastIndexOf(".map((item, index)"));
assert(!affiliateRankingProjectionBlock.includes("...item"), "ranking do dashboard afiliado deve projetar campos permitidos explicitamente");
for (const field of ["commissionGenerated", "commissionBalance", "prizeBalance", "email", "phone", "customerId", "tenant_id", "refCode"]) {
  assert(!affiliateRankingProjectionBlock.includes(field), `ranking do dashboard afiliado nao deve retornar ${field}`);
}

const updateRouteBlock = server.slice(server.indexOf('app.put("/api/affiliates/:refCode"'), server.indexOf('app.post("/api/affiliates/:refCode/click"'));
includesAll(updateRouteBlock, [
  "isAffiliateOwnerRequest(req, affiliate)",
  'res.status(403).json({ error: "Acesso negado para este afiliado" })',
  "affiliate.pixKey = pixKey"
], "preferencias e saque do afiliado");

const dashboardBuilderBlock = server.slice(server.indexOf("function buildAffiliateDashboard"), server.indexOf("  function manuallyConfirmPurchasePayment"));
for (const field of ["cpf", "phone", "accessPassword"]) {
  assert(!dashboardBuilderBlock.includes(field), `dashboard do afiliado nao deve expor ${field}`);
}

includesAll(server, [
  'app.get("/api/admin/affiliates/search"',
  'app.get("/api/admin/affiliates/withdrawals"',
  'app.post("/api/admin/affiliates/manual"',
  'app.put("/api/admin/affiliates/:refCode/full"'
], "admin afiliados preservado");

const findOrCreateCustomerBlock = server.slice(server.indexOf("function findOrCreateCustomer"), server.indexOf("function getDefaultRafflePixConfig"));
assert(!findOrCreateCustomerBlock.includes("ensureAffiliateForCustomer(customer)"), "cadastro/compra pendente nao deve criar afiliado antes de pagamento confirmado");
const publicAffiliateRegisterBlock = server.slice(server.indexOf('app.post("/api/affiliates/register"'), server.indexOf('app.get("/api/affiliates/:refCode"'));
includesAll(publicAffiliateRegisterBlock, [
  'res.status(409).json({ error: "Afiliado ativado automaticamente apos a primeira compra confirmada" })',
  "publicAffiliateView(affiliates[key])"
], "registro publico legado nao cria afiliado sem compra paga");
assert(!publicAffiliateRegisterBlock.includes("affiliates[key] ="), "registro publico legado nao pode materializar afiliado");

const confirmPurchaseBlock = server.slice(server.indexOf("function confirmPurchase"), server.indexOf("function creditAffiliateCommission"));
includesAll(confirmPurchaseBlock, [
  "affiliate_auto_first_paid_purchase",
  "forceEnable: true",
  "purchase.status = \"paid\""
], "compra confirmada cria afiliado automaticamente");

const adminAffiliateSearchBlock = server.slice(server.indexOf('app.get("/api/admin/affiliates/search"'), server.indexOf('app.get("/api/admin/affiliates/withdrawals"'));
includesAll(adminAffiliateSearchBlock, [
  "Object.values(affiliates)",
  "adminCanAccessTenant(req, affiliate.tenant_id)",
  "releaseEligiblePendingAffiliateCommissions(affiliate)"
], "lista admin mostra afiliados tenant-scoped sem criar pendentes");
assert(!adminAffiliateSearchBlock.includes("ensureAffiliateForCustomer"), "busca admin nao pode criar afiliado pendente");

const commissionBlock = server.slice(server.indexOf("function creditAffiliateCommission"), server.indexOf("type AffiliatePaidOrder"));
includesAll(commissionBlock, [
  "resolveAffiliateCommissionRate(affiliate)",
  "affiliateIsEligibleForCampaignCommission(affiliate",
  "`ineligible:${input.source}`",
  "affiliate.history.some",
  "affiliate.commissionBalance += comm"
], "comissao personalizada/idempotente");
assert(!commissionBlock.includes("tenantScopedSettings.affiliateProgram.commissionRate"), "comissao deve passar pelo fallback personalizado/padrao");

const campaignEligibilityBlock = server.slice(server.indexOf("function affiliateOwnCampaignPaidAt"), server.indexOf("function isPendingAffiliateCommission"));
includesAll(campaignEligibilityBlock, [
  "purchase.raffleId === campaign.id",
  "purchase.status === \"paid\"",
  "purchase.statusPagamento === \"paid\"",
  "purchase.mode === campaign.id",
  "affiliate.tenant_id !== saleTenantId",
  "ownTime >= saleTime",
  "Afiliado ainda não participa desta campanha.",
  "Você já participa: comissões liberadas",
  "Compre para liberar comissão nesta campanha"
], "elegibilidade de comissao por campanha");

includesAll(server, [
  'campaign: { type: "raffle", id: purchase.raffleId }',
  'campaign: { type: "fazendinha", id: "fazendinha" }',
  'campaign: { type: "number_mode", id: purchase.mode }',
  "saleCreatedAt: purchase.createdAt",
  "saleCreatedAt: purchase.dataCompra"
], "contexto de campanha nas comissoes");

const adminAffiliateFullBlock = server.slice(server.indexOf('app.put("/api/admin/affiliates/:refCode/full"'), server.indexOf('app.put("/api/affiliates/:refCode"'));
includesAll(adminAffiliateFullBlock, [
  "normalizeAffiliateCommissionRate(req.body.affiliate.customCommissionRate)",
  "affiliate.useCustomCommission",
  "admin_affiliate_full_update"
], "admin altera comissao individual");

const publicAffiliateUpdateBlock = server.slice(server.indexOf('app.put("/api/affiliates/:refCode"'), server.indexOf('app.post("/api/affiliates/:refCode/withdrawals"'));
assert(!publicAffiliateUpdateBlock.includes("customCommissionRate"), "afiliado comum nao altera comissao personalizada");
assert(!publicAffiliateUpdateBlock.includes("useCustomCommission ="), "afiliado comum nao ativa comissao personalizada");

includesAll(adminSales, [
  "Usa comissão padrão",
  "Usa comissão personalizada",
  "Comissão personalizada (%)",
  "Essa alteração vale apenas para novas vendas indicadas.",
  "useCustomCommission",
  "customCommissionRate"
], "ui admin comissao personalizada");

includesAll(affiliates, [
  "commissionStatusLabel",
  "commissionEnabled"
], "painel afiliado indica participacao por campanha");

assert(pkg.includes('"test:affiliate-access-control"'), "package.json deve expor test:affiliate-access-control");

console.log("affiliate-access-control-hard: ok");

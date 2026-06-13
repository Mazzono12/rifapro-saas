import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const server = readFileSync(join(root, "server.ts"), "utf8");
const affiliatesPage = readFileSync(join(root, "src", "pages", "Affiliates.tsx"), "utf8");
const adminConfigPage = readFileSync(join(root, "src", "pages", "admin", "AdminConfig.tsx"), "utf8");
const adminSalesPage = readFileSync(join(root, "src", "pages", "admin", "AdminSales.tsx"), "utf8");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const migrationPath = join(root, "supabase", "migrations", "58_affiliate_levels.sql");
const configMigrationPath = join(root, "supabase", "migrations", "59_affiliate_level_configs.sql");

assert.ok(existsSync(migrationPath), "migration 58_affiliate_levels.sql deve existir para compatibilidade de status visual");
assert.ok(existsSync(configMigrationPath), "migration 59_affiliate_level_configs.sql deve existir para compatibilidade de status visual");
const migration = readFileSync(migrationPath, "utf8");
const configMigration = readFileSync(configMigrationPath, "utf8");

function mustInclude(source, needle, label = needle) {
  assert.ok(source.includes(needle), `ausente: ${label}`);
}

function mustNotInclude(source, needle, label = needle) {
  assert.ok(!source.includes(needle), `proibido: ${label}`);
}

function mustMatch(source, pattern, label = String(pattern)) {
  assert.ok(pattern.test(source), `ausente: ${label}`);
}

function functionBlock(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `funcao ausente: ${name}`);
  const next = source.indexOf("\n  function ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

mustInclude(pkg.scripts["test:affiliate-levels-hard"], "scripts/test-affiliate-levels-hard.mjs", "script npm registrado");

[
  "create table if not exists public.affiliate_levels",
  "create table if not exists public.affiliate_level_history",
  "current_level",
  "sales_points",
  "network_points",
  "sponsor_points",
  "next_level_points",
  "progress_percent",
  "enable row level security",
  "idx_affiliate_levels_tenant_points",
  "affiliate_levels_affiliate_unique unique (tenant_id, affiliate_id)"
].forEach(item => mustInclude(migration, item, `migration status visual: ${item}`));

[
  "create table if not exists public.affiliate_level_configs",
  "tenant_id text not null",
  "commission_rate numeric",
  "minimum_points numeric",
  "enabled boolean",
  "affiliate_level_configs_tenant_level_unique unique (tenant_id, level_id)",
  "enable row level security",
  "idx_affiliate_level_configs_tenant_points"
].forEach(item => mustInclude(configMigration, item, `migration config compat: ${item}`));

[
  "type AffiliateLevelId",
  "type AffiliateLevelStateRecord",
  "type AffiliateLevelHistoryRecord",
  "let affiliateLevels",
  "let affiliateLevelHistory",
  "defaultAffiliateLevelConfigs",
  "normalizeAffiliateLevelConfigs",
  "affiliateLevelCatalog(tenantId",
  "recalculateAffiliateLevel",
  "buildAffiliateLevelRanking",
  "affiliateLevelPublicView",
  "LEVEL_UP"
].forEach(item => mustInclude(server, item, `server status visual: ${item}`));

[
  ['id: "BRONZE"', "threshold: 0", "commissionRate: 0", "🥉"],
  ['id: "PRATA"', "threshold: 10000", "commissionRate: 0", "🥈"],
  ['id: "OURO"', "threshold: 50000", "commissionRate: 0", "🥇"],
  ['id: "DIAMANTE"', "threshold: 200000", "commissionRate: 0", "💎"],
  ['id: "IMPERADOR"', "threshold: 1000000", "commissionRate: 0", "👑"],
  ['id: "LENDARIO"', "threshold: 5000000", "commissionRate: 0", "🔥"]
].forEach(parts => parts.forEach(part => mustInclude(server, part, `status visual neutro: ${part}`)));

mustMatch(server, /salesPoints = Number\(paidOrders\.reduce[\s\S]*order\.amount/, "vendas confirmadas somam pontos visuais");
mustMatch(server, /directReferralPoints = directReferredCustomers\.size \* 500/, "indicados diretos geram pontos visuais");
mustMatch(server, /directPrizePoints = directPrizeCount \* 1000/, "premio de indicado direto gera pontos visuais");
mustMatch(server, /affiliateLevelHistory\.unshift\([\s\S]*old_level[\s\S]*new_level[\s\S]*points/, "historico visual criado no level up");
mustMatch(server, /createNotification\([\s\S]*type: "LEVEL_UP"[\s\S]*Você alcançou o nível/, "notificacao visual LEVEL_UP criada");
mustMatch(server, /sourceSettings\.affiliateLevelConfig = normalizeAffiliateLevelConfigs\(sourceSettings\.affiliateLevelConfig\)/, "settings normaliza status visual por tenant");
mustMatch(server, /affiliateLevelConfig: Array\.isArray\(req\.body\.affiliateLevelConfig\) \? req\.body\.affiliateLevelConfig : currentSettings\.affiliateLevelConfig/, "admin salva status visual por tenant");

const resolveBlock = functionBlock(server, "resolveAffiliateCommissionRate");
mustMatch(resolveBlock, /const customRate = affiliate\.customCommissionRate/, "comissao especial vem do afiliado");
mustMatch(resolveBlock, /return normalizeAffiliateCommissionRate\(customRate\)/, "comissao especial normalizada");
mustMatch(resolveBlock, /getTenantSettings\(affiliate\.tenant_id\)\.affiliateProgram\?\.commissionRate \?\? 10/, "fallback usa comissao padrao do tenant ou 10");
mustNotInclude(resolveBlock, "affiliateLevelDefinition", "nivel nao participa do calculo de comissao");
mustNotInclude(resolveBlock, ".commissionRate)", "commissionRate de nivel nao participa do calculo");

const creditBlock = functionBlock(server, "creditAffiliateCommission");
mustMatch(creditBlock, /isDirectAffiliateCustomer\(input\.tenantId, affiliate\.refCode, input\.buyerCustomerId\)/, "comissao somente para indicado direto");
mustMatch(creditBlock, /const commissionRate = resolveAffiliateCommissionRate\(affiliate\)/, "comissao usa helper central");
mustMatch(creditBlock, /source: affiliate\.customCommissionRate !== undefined && affiliate\.customCommissionRate !== null \? "custom_affiliate_rate" : "tenant_default_affiliate_rate"/, "snapshot informa fonte default/especial");
mustMatch(creditBlock, /const comm = Number\(\(purchase\.amount \* \(commissionRate \/ 100\)\)\.toFixed\(2\)\)/, "formula final da comissao");
mustMatch(creditBlock, /affiliate\.history\.push\(\{ amount: comm[\s\S]*commissionRate[\s\S]*commissionSnapshot/, "ledger registra taxa e snapshot");
mustNotInclude(creditBlock, "commissionLevel", "ledger novo nao registra nivel como fonte de comissao");

[
  "function getAffiliatePaidOrders",
  "item.customer?.referredBy === refCode",
  "function buildAffiliateSellerRanking",
  "affiliateOrderMatchesCampaign",
  "totalSold",
  "buyers",
  "app.get(\"/api/admin/affiliates/top-sellers\"",
  "app.get(\"/api/raffles/:id/top-sellers\"",
  "app.get(\"/api/public/raffles/:raffleId/top-sellers\""
].forEach(item => mustInclude(server, item, `top vendedores direto/campanha: ${item}`));

mustMatch(server, /buildAffiliateSellerRanking[\s\S]*getAffiliatePaidOrders\(tenantId, affiliate\.refCode\)[\s\S]*affiliateOrderMatchesCampaign\(order, campaign\)/, "Top Vendedores filtra vendas pagas diretas por campanha");
mustMatch(server, /buildAffiliateSellerRanking[\s\S]*b\.totalSold - a\.totalSold[\s\S]*b\.sales - a\.sales[\s\S]*b\.buyers - a\.buyers/, "Top Vendedores ordena por total vendido, vendas e compradores");

[
  "function getBuyerRanking",
  "purchase.tenant_id === tenantId",
  "purchase.raffleId === raffleId",
  "purchase.status === \"paid\"",
  "app.get(\"/api/raffles/:id/ranking\"",
  "app.get(\"/api/public/raffles/:raffleId/ranking\""
].forEach(item => mustInclude(server, item, `top compradores por campanha: ${item}`));

[
  "Comissão padrão do programa (%)",
  "Comissão especial",
  "Se comissão especial estiver vazia, usa a comissão padrão.",
  "Status visual do afiliado",
  "não alteram a comissão",
  "Top Vendedores",
  "Top Compradores",
  "updateAffiliateLevelConfig",
  "affiliateLevelConfig"
].forEach(item => mustInclude(adminConfigPage + adminSalesPage, item, `admin copy: ${item}`));

mustNotInclude(adminConfigPage, "Comissões por Nível", "admin nao deve vender comissao por nivel");
mustNotInclude(adminConfigPage, "`${level.label} %`", "admin nao edita percentual por nivel");
mustNotInclude(adminConfigPage, "updateAffiliateLevelConfig(level.id, { commissionRate:", "admin nao altera comissao por nivel");
mustMatch(adminConfigPage, /updateAffiliateLevelConfig\(level\.id, \{ threshold:/, "admin altera pontos minimos visuais");
mustMatch(adminConfigPage, /updateAffiliateLevelConfig\(level\.id, \{ enabled:/, "admin ativa/desativa status visual");

[
  "AffiliateCurrentLevelCard",
  "RankingByLevelCard",
  "data-affiliate-premium=\"current-level\"",
  "data-affiliate-premium=\"level-ranking\"",
  "affiliateLevel",
  "displayName",
  "progress_percent",
  "Status visual",
  "Status e Metas",
  "Top Vendedores",
  "Indicados diretos"
].forEach(item => mustInclude(affiliatesPage, item, `painel: ${item}`));

mustMatch(affiliatesPage, /buildFallbackAffiliateLevel\(Number\([\s\S]*settings\?\.affiliateLevelConfig\)/, "fallback do painel usa config de status recebida");
mustNotInclude(affiliatesPage, 'currentLevel === "BRONZE" ? 10', "painel nao deve carregar comissoes fixas por nivel");
mustNotInclude(affiliatesPage, "Comissão {level.commissionRate}%", "painel nao exibe comissao por nivel");

for (const forbidden of [
  "attachActiveGatewayPixToOrder(input",
  "app.post(\"/api/webhooks/payment/:gateway\"",
  "app.post(\"/api/checkout/preview\""
]) {
  assert.ok(server.includes(forbidden), `marcador protegido ausente: ${forbidden}`);
}

console.log("test-affiliate-levels-hard: comissao default/especial, status visual e rankings diretos por campanha validados.");

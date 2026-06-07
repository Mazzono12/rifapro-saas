import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const server = readFileSync(join(root, "server.ts"), "utf8");
const affiliatesPage = readFileSync(join(root, "src", "pages", "Affiliates.tsx"), "utf8");
const adminConfigPage = readFileSync(join(root, "src", "pages", "admin", "AdminConfig.tsx"), "utf8");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const migrationPath = join(root, "supabase", "migrations", "58_affiliate_levels.sql");
const configMigrationPath = join(root, "supabase", "migrations", "59_affiliate_level_configs.sql");

assert.ok(existsSync(migrationPath), "migration 58_affiliate_levels.sql deve existir");
assert.ok(existsSync(configMigrationPath), "migration 59_affiliate_level_configs.sql deve existir");
const migration = readFileSync(migrationPath, "utf8");
const configMigration = readFileSync(configMigrationPath, "utf8");

function mustInclude(source, needle, label = needle) {
  assert.ok(source.includes(needle), `ausente: ${label}`);
}

function mustMatch(source, pattern, label = String(pattern)) {
  assert.ok(pattern.test(source), `ausente: ${label}`);
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
].forEach(item => mustInclude(migration, item, `migration: ${item}`));

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
].forEach(item => mustInclude(server, item, `server: ${item}`));

[
  ['id: "BRONZE"', "threshold: 0", "commissionRate: 10", "🥉"],
  ['id: "PRATA"', "threshold: 10000", "commissionRate: 12", "🥈"],
  ['id: "OURO"', "threshold: 50000", "commissionRate: 14", "🥇"],
  ['id: "DIAMANTE"', "threshold: 200000", "commissionRate: 16", "💎"],
  ['id: "IMPERADOR"', "threshold: 1000000", "commissionRate: 18", "👑"],
  ['id: "LENDARIO"', "threshold: 5000000", "commissionRate: 20", "🔥"]
].forEach(parts => parts.forEach(part => mustInclude(server, part, `nivel: ${part}`)));

[
  "create table if not exists public.affiliate_level_configs",
  "tenant_id text not null",
  "commission_rate numeric",
  "minimum_points numeric",
  "enabled boolean",
  "affiliate_level_configs_tenant_level_unique unique (tenant_id, level_id)",
  "enable row level security",
  "idx_affiliate_level_configs_tenant_points"
].forEach(item => mustInclude(configMigration, item, `migration config: ${item}`));

mustMatch(server, /salesPoints = Number\(paidOrders\.reduce[\s\S]*order\.amount/, "vendas confirmadas somam 1 ponto por real");
mustMatch(server, /networkPoints = activeCustomers\.size \* 500/, "indicado ativo vale 500 pontos");
mustMatch(server, /sponsorPoints = sponsorPrizeCount \* 1000/, "premio patrocinador vale 1000 pontos");
mustMatch(server, /affiliateLevelHistory\.unshift\([\s\S]*old_level[\s\S]*new_level[\s\S]*points/, "historico criado no level up");
mustMatch(server, /createNotification\([\s\S]*type: "LEVEL_UP"[\s\S]*Você alcançou o nível/, "notificacao LEVEL_UP criada");
mustMatch(server, /sourceSettings\.affiliateLevelConfig = normalizeAffiliateLevelConfigs\(sourceSettings\.affiliateLevelConfig\)/, "settings normaliza comissoes por nivel");
mustMatch(server, /affiliateLevelDefinition\(affiliate\.tenant_id, levelState\.current_level\)\.commissionRate/, "comissao usa configuracao do tenant quando nao customizada");
mustMatch(server, /affiliateLevelConfig: Array\.isArray\(req\.body\.affiliateLevelConfig\) \? req\.body\.affiliateLevelConfig : currentSettings\.affiliateLevelConfig/, "admin salva config por tenant");
mustMatch(server, /commissionSnapshot = \{[\s\S]*source: affiliate\.useCustomCommission \? "custom_affiliate_rate" : "affiliate_level_config"[\s\S]*tenantId: affiliate\.tenant_id[\s\S]*commissionRate[\s\S]*\}/, "snapshot da comissao usada criado");
mustMatch(server, /affiliate\.history\.push\(\{ amount: comm[\s\S]*commissionRate[\s\S]*commissionLevel[\s\S]*commissionSnapshot/, "ledger registra snapshot em novas comissoes");
mustMatch(server, /creditAffiliateCommission[\s\S]*recalculateAffiliateLevel\(affiliate, "venda_confirmada"\)/, "rotina roda em venda/comissao confirmada");
mustMatch(server, /releaseEligiblePendingAffiliateCommissions[\s\S]*recalculateAffiliateLevel\(affiliate, "comissao_confirmada"\)/, "rotina roda ao liberar comissao pendente");
mustMatch(server, /sponsor_reward_approved[\s\S]*recalculateAffiliateLevel\(affiliate, "premio_patrocinador_confirmado"\)/, "rotina roda em premio patrocinador aprovado");
mustMatch(server, /app\.post\("\/api\/admin\/sponsor-rewards\/:id\/credit"[\s\S]*recalculateAffiliateLevel\(affiliate, "premio_patrocinador_confirmado"\)[\s\S]*sponsor_reward_credited/, "rotina roda em premio patrocinador creditado");
mustMatch(server, /app\.get\("\/api\/admin\/affiliate-levels\/ranking"/, "endpoint admin ranking por nivel");
mustMatch(server, /app\.get\("\/api\/public\/affiliate-levels\/ranking"/, "endpoint publico ranking por nivel");
mustMatch(server, /app\.get\("\/api\/affiliates\/:refCode\/level"/, "endpoint afiliado nivel");

[
  "Comissões por Nível",
  "As alterações valem apenas para novas comissões geradas após salvar.",
  'label: "Bronze"',
  'label: "Prata"',
  'label: "Ouro"',
  'label: "Diamante"',
  'label: "Imperador"',
  'label: "Lendário"',
  "`${level.label} %`",
  "updateAffiliateLevelConfig",
  "affiliateLevelConfig"
].forEach(item => mustInclude(adminConfigPage, item, `admin: ${item}`));

mustMatch(adminConfigPage, /normalizeAffiliateLevelConfig\(settings\.affiliateLevelConfig\)/, "admin carrega defaults/config salva");
mustMatch(adminConfigPage, /updateAffiliateLevelConfig\(level\.id, \{ commissionRate:/, "admin altera comissao por nivel");
mustMatch(adminConfigPage, /updateAffiliateLevelConfig\(level\.id, \{ threshold:/, "admin altera pontos minimos por nivel");
mustMatch(adminConfigPage, /updateAffiliateLevelConfig\(level\.id, \{ enabled:/, "admin ativa e desativa nivel");

[
  "AffiliateCurrentLevelCard",
  "RankingByLevelCard",
  "data-affiliate-premium=\"current-level\"",
  "data-affiliate-premium=\"level-ranking\"",
  "affiliateLevel",
  "displayName",
  "progress_percent",
  "🥉",
  "🥈",
  "🥇",
  "💎",
  "👑",
  "🔥"
].forEach(item => mustInclude(affiliatesPage, item, `painel: ${item}`));

mustMatch(affiliatesPage, /buildFallbackAffiliateLevel\(Number\([\s\S]*settings\?\.affiliateLevelConfig\)/, "fallback do painel usa config de niveis recebida");
assert.ok(!affiliatesPage.includes('currentLevel === "BRONZE" ? 10'), "painel nao deve carregar comissoes fixas por nivel");

for (const forbidden of [
  "attachActiveGatewayPixToOrder(input",
  "app.post(\"/api/webhooks/payment/:gateway\"",
  "app.post(\"/api/checkout/preview\""
]) {
  assert.ok(server.includes(forbidden), `marcador protegido ausente: ${forbidden}`);
}

console.log("test-affiliate-levels-hard: niveis, pontuacao, comissao, historico e rankings validados.");

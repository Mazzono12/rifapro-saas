import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(content, tokens, context) {
  for (const token of tokens) {
    assert.ok(content.includes(token), `${context}: esperado encontrar "${token}"`);
  }
}

function includesNone(content, tokens, context) {
  for (const token of tokens) {
    assert.equal(content.includes(token), false, `${context}: nao deve conter "${token}"`);
  }
}

const home = read("src/pages/Home.tsx");
const css = read("src/index.css");
const packageJson = read("package.json");
const server = read("server.ts");
const adminLayout = read("src/pages/admin/AdminLayout.tsx");
const adminInstantPrizes = read("src/pages/admin/AdminInstantPrizes.tsx");
const adminGamification = read("src/pages/admin/AdminGamification.tsx");
const lootboxEditor = read("src/components/admin/LootboxRulesEditor.tsx");
const types = read("src/types.ts");

includesAll(home, [
  "type HomeInstantRewardsData",
  "const emptyHomeRewards",
  "loadHomeInstantRewards(featuredRaffle)",
  "safeJson(`/api/raffles/${raffleId}/instant-prizes`)",
  "safeJson(`/api/public/raffles/${raffleId}/super-cotas`)",
  "safeJson(`/api/raffles/${raffleId}/gamification`)",
  "<HomeInstantRewards rewards={instantRewards} />",
  "<TopBuyers ranking={ranking} />",
  "showHomePrice",
  "raffle.showHomePrice !== false",
  "showHomeText",
  "raffle.showHomeText !== false",
  "<strong>{progress.toFixed(0)}%</strong>"
], "Home deve carregar premios reais/configurados e renderizar Top Compradores no fluxo principal.");

assert.ok(
  home.indexOf("className=\"cfx-home-title-lockup\"") < home.indexOf("className=\"cfx-home-price-strip\"") &&
    home.indexOf("className=\"cfx-home-price-strip\"") < home.indexOf("className=\"cfx-home-hero-actions\"") &&
    home.indexOf("className=\"cfx-home-hero-actions\"") < home.indexOf("cfx-live-card") &&
    home.indexOf("cfx-live-card") < home.indexOf("<TopBuyers ranking={ranking} />"),
  "Ordem correta dentro do Hero: nome, valor, CTA, contador e Top Compradores."
);

assert.equal(
  home.match(/<TopBuyers ranking=\{ranking\} \/>/g)?.length,
  1,
  "Top Compradores nao deve ser duplicado."
);

includesAll(home, [
  "SUPER COTAS PREMIADAS",
  "ROLETA PREMIADA",
  "RASPADINHA PREMIADA",
  "CAIXINHA PREMIADA",
  "Concorra a prêmios especiais com números exclusivos!",
  "VER PRÊMIOS DA ROLETA",
  "VER PRÊMIOS DA RASPADINHA",
  "VER PRÊMIOS DA CAIXINHA",
  "buildSuperCotaRewards(instantPrizesPayload, superCotasPayload)",
  "buildWheelRewards(raffle)",
  "buildScratchcardRewards(gamificationPayload)",
  "buildMysteryBoxRewards(raffle, gamificationPayload)"
], "Home deve ter as quatro secoes premium alimentadas por dados reais.");
includesAll(home, [
  "columns: { primary: \"Prêmio\", secondary: \"\", person: \"Ganhador\" }",
  "const showValueColumn = Boolean(columns.secondary)",
  "{showValueColumn && ("
], "Roleta e Caixinha devem ocultar valor, mantendo premio, ganhador e status.");

includesAll(home, [
  "columns: { primary: \"Número\", secondary: \"Prêmio\", person: \"Ganhador\" }",
  "manualWinnerName",
  "prize?.winnerName || prize?.ganhadorNome || prize?.nomeGanhador",
  "id === \"superCotas\" ? item.buyerName : maskBuyerName(item.buyerName)"
], "Super Cotas deve exibir GANHADOR e PREMIO a partir do payload real.");
includesNone(home, [
  "COMPRADOR",
  "Comprador",
  "PRÊMIO/VALOR",
  "Prêmio/Valor",
  "#{String(item.number)",
  "# {String(item.number)"
], "Home nao deve manter rotulos antigos nem prefixo # nos numeros de Super Cotas.");

includesAll(home, [
  "sections.length) return null",
  "filter(section => section.items.length > 0)",
  "asArray(instantPrizesPayload)",
  "Boolean(config?.rewardModes?.wheel || config?.experienceType === \"wheel\")",
  "asArray(config.wheelSegments)",
  "asArray(gamificationPayload?.scratchcard?.prizes)",
  "asArray(config.milestones)",
  "asArray(gamificationPayload?.mysteryBox?.boxes)"
], "Secoes devem sumir quando nao houver dados reais/configurados.");

includesAll(home, [
  "if (!wheelEnabled) return []",
  "const label = safeText(reward?.name || segment?.label, \"\")",
  "status: normalizeRewardStatus(reward?.status)"
], "Roleta configurada deve aparecer com paletas reais sem exigir premio monetario fake.");

includesAll(home, [
  "[home-instant-rewards]",
  "hasSuperCotas",
  "hasRoulette",
  "hasScratchcard",
  "hasLootbox"
], "Logs DEV devem expor quais secoes existem sem rodar em producao.");

includesNone(home, [
  "Array.from({ length",
  "mock",
  "fake",
  "exemplo",
  "João Silva",
  "Maria Souza",
  "R$ 150,00"
], "Home nao pode inventar premios, compradores ou valores.");

includesAll(home, [
  "const [visible, setVisible] = useState(10)",
  "items.slice(0, 50)",
  "cappedItems.slice(0, visible)",
  "visible < cappedItems.length && visible < 50",
  "Math.min(50, current + 10, cappedItems.length)",
  "{cta || \"MOSTRAR MAIS\"} (10)"
], "Expansao deve ser 10 inicial, +10 por clique, maximo 50.");

includesAll(home, [
  "maskBuyerName(item.buyerName)",
  "rewardWinnerName",
  "buyerName: rewardWinnerName(reward) || rewardWinnerName(segment)",
  "buyerName: rewardWinnerName(milestone)",
  "buyerName: rewardWinnerName(box)",
  "id === \"superCotas\" ? item.buyerName : maskBuyerName(item.buyerName)",
  "item.buyerName ? (id === \"superCotas\" ? item.buyerName : maskBuyerName(item.buyerName)) : \"—\"",
  "statusLabel(item.status)",
  "Disponível",
  "Resgatada",
  "Sorteada",
  "is-available",
  "is-claimed"
], "Nomes e status devem seguir contrato visual.");

includesAll(css, [
  ".cfx-instant-rewards",
  ".cfx-reward-section",
  "data-reward-tone=\"gold\"",
  "data-reward-tone=\"green\"",
  "data-reward-tone=\"pink\"",
  ".cfx-reward-summary",
  ".cfx-reward-total-badge",
  ".cfx-reward-list",
  ".cfx-reward-card",
  ".cfx-reward-more",
  "Home instant rewards: premium list layout",
  "Final home reward palette: neon blue system style with slimmer pills",
  "data-reward-id=\"superCotas\"",
  "data-reward-id=\"mysteryBox\"",
  ".cfx-reward-section[data-reward-id=\"scratchcard\"]",
  "grid-template-columns: minmax(0, 1fr) auto !important",
  "border-radius: 22px !important",
  "linear-gradient(100deg, rgba(5, 19, 37, .96), rgba(9, 19, 47, .94) 52%, rgba(7, 36, 58, .9))",
  "min-height: 42px !important",
  "background: linear-gradient(135deg, #0284c7, #06b6d4 48%, #2563eb) !important",
  "content: \"Ganhador: \"",
  "min-width: 92px !important",
  "grid-row: 1 / 3 !important",
  "repeat(2, minmax(0, 1fr))",
  "overflow: hidden",
  "text-overflow: ellipsis",
  "white-space: nowrap"
], "CSS deve usar lista premium mobile alinhada ao mockup, sem tabela apertada nem overflow horizontal.");
includesNone(home, [
  "cfx-home-remaining",
  "cotas restantes"
], "Home nao deve exibir texto de cotas restantes abaixo do Top Compradores.");
includesNone(css, [
  ".cfx-reward-section:not([data-reward-id=\"superCotas\"]) .cfx-reward-card div:nth-child(2),\n.cfx-reward-section:not([data-reward-id=\"superCotas\"]) .cfx-reward-card div:nth-child(3) {\n  display: none;"
], "Roleta, Raspadinha e Caixinha nao devem esconder valor/ganhador.");

assert.match(packageJson, /"test:home-instant-rewards-hard"/, "package.json deve registrar test:home-instant-rewards-hard.");

includesAll(server, [
  "app.get(\"/api/public/raffles/:raffleId/super-cotas\"",
  "const raffle = raffles.find(item => item.id === raffleId)",
  "const tenantId = raffle?.tenant_id || resolveRequestTenantId(req)",
  "const getPrizeWinnerName = (prize: any)",
  "winnerName: getPrizeWinnerName(p)",
  "winnerName: getPrizeWinnerName(prize)",
  ".filter(prize => prize.status === \"claimed\")"
], "Endpoint publico de Super Cotas deve resolver tenant pela rifa e retornar winnerName.");

includesAll(adminLayout, [
  "{ name: \"Super Cotas\", path: \"/admin/cotas\", icon: Star, group: \"Operação\" }"
], "Menu Admin deve expor Super Cotas.");

includesAll(adminInstantPrizes, [
  "Nome do Ganhador",
  "value={currentPrize.winnerName || ''}",
  "setCurrentPrize({...currentPrize, winnerName: e.target.value})",
  "body: JSON.stringify(currentPrize)",
  "<th className=\"font-semibold py-4 px-6 border-b border-white/5\">GANHADOR</th>",
  "{p.winnerName || '—'}"
], "Admin de Super Cotas deve criar, editar e listar Nome do Ganhador.");

includesAll(lootboxEditor, [
  "Nome do Ganhador",
  "winnerName: segment.reward?.winnerName || \"\"",
  "updateMilestone(index, \"winnerName\", value)",
  "updateSegmentReward(index, \"winnerName\", value)"
], "Admin de Roleta/Caixinha deve salvar Nome do Ganhador nos premios configurados.");

includesAll(adminGamification, [
  "Nome do Ganhador",
  "winnerName: \"\"",
  "updateItem(index, \"winnerName\", next)"
], "Admin de Raspadinha/Caixinha deve permitir Nome do Ganhador nos premios planejados.");

includesAll(types, [
  "winnerName?: string;",
  "scratchcard: { prizes:",
  "mysteryBox: { boxes:"
], "Tipos devem aceitar winnerName em premios instantaneos configurados.");

console.log("PASS: Home Instant Rewards validada com dados reais/configurados, 10/+10/max50, status, mascaramento e ordem correta.");

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

includesAll(home, [
  "type HomeInstantRewardsData",
  "const emptyHomeRewards",
  "loadHomeInstantRewards(featuredRaffle)",
  "safeJson(`/api/raffles/${raffleId}/instant-prizes`)",
  "safeJson(`/api/public/raffles/${raffleId}/super-cotas`)",
  "safeJson(`/api/raffles/${raffleId}/gamification`)",
  "<HomeInstantRewards rewards={instantRewards} />",
  "<TopBuyers ranking={ranking} />"
], "Home deve carregar premios reais/configurados e renderizar antes do Top Compradores");

assert.ok(
  home.indexOf("<HomeInstantRewards rewards={instantRewards} />") < home.indexOf("<TopBuyers ranking={ranking} />"),
  "Ordem correta: premios instantaneos antes do Top Compradores."
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
  "item.buyerName ? maskBuyerName(item.buyerName) : \"—\"",
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
  "data-reward-id=\"superCotas\"",
  "grid-template-columns: minmax(0, .88fr) minmax(0, 1fr) minmax(0, .82fr) auto",
  "overflow: hidden",
  "text-overflow: ellipsis",
  "white-space: nowrap"
], "CSS deve usar cards mobile premium alinhados ao mockup, sem tabela apertada nem overflow horizontal.");

assert.match(packageJson, /"test:home-instant-rewards-hard"/, "package.json deve registrar test:home-instant-rewards-hard.");

includesAll(server, [
  "app.get(\"/api/public/raffles/:raffleId/super-cotas\"",
  "const raffle = raffles.find(item => item.id === raffleId)",
  "const tenantId = raffle?.tenant_id || resolveRequestTenantId(req)"
], "Endpoint publico de Super Cotas deve resolver tenant pela rifa quando o host publico/local nao resolve tenant.");

console.log("PASS: Home Instant Rewards validada com dados reais/configurados, 10/+10/max50, status, mascaramento e ordem correta.");

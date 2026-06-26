import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pagePath = path.join(root, "src/pages/admin/AdminRaffles.tsx");
const typesPath = path.join(root, "src/types.ts");
const page = fs.readFileSync(pagePath, "utf8");
const types = fs.readFileSync(typesPath, "utf8");
let failures = 0;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { failures += 1; console.error(`FAIL ${label}`); }
}
function hasAll(source, items) { return items.every(item => source.includes(item)); }

const requiredFields = [
  "title", "name", "subtitle", "description", "status", "price", "totalNumbers", "quantity", "minPurchase", "drawDate", "salesEndDate", "reservationMinutes", "heroText", "homeTitle", "homeSubtitle", "imageUrl", "cardImage", "mediaUrl", "mediaType", "mediaAspect", "mediaFit", "checkoutMediaUrl", "checkoutMediaType", "checkoutMediaAspect", "checkoutMediaFit", "mainPrizeTitle", "mainPrizeImage", "mainPrizeDescription", "estimatedPrizeValue", "sponsorPrize", "gatewayMode", "campaignGateway", "pixExpirationMinutes", "releaseExpiredReservations", "enableSuperCotas", "enableCaixinha", "enableRoleta", "enableRaspadinha", "enableBilhetePremiado", "enableHoraPremiada", "enableChanceEmDobro", "enableTopCompradores", "enableTopVendedores", "rankingPrizes", "goalAmount", "goalText", "showProgressBar", "showPurchaseFeed", "showSocialProof", "featuredOnHome"
];

check("AdminRaffles usa campaignDraft central", page.includes("campaignDraft") && page.includes("setCampaignDraft"));
check("Salvar usa buildCampaignPayload(campaignDraft)", page.includes("const payload = buildCampaignPayload(campaignDraft)"));
check("Salvar usa API existente /api/admin/raffles", page.includes('fetch(isEdit ? `/api/admin/raffles/${campaignDraft.id}` : "/api/admin/raffles"'));
check("Nao existe estado antigo setDraft", !page.includes("setDraft("));
check("Campos obrigatorios aparecem no draft/payload", hasAll(page, requiredFields));
check("Campos de midia entram no payload", hasAll(page, ["imageUrl", "cardImage", "mediaUrl", "mediaType", "mediaAspect", "mediaFit"]));
check("Campos de checkoutMedia entram no payload", hasAll(page, ["checkoutMediaUrl", "checkoutMediaType", "checkoutMediaAspect", "checkoutMediaFit"]));
check("Campos de ranking/gamificacao entram no payload", hasAll(page, ["enableTopCompradores", "enableTopVendedores", "rankingPrizes", "enableSuperCotas", "enableCaixinha", "enableRoleta", "enableRaspadinha", "enableBilhetePremiado", "enableHoraPremiada", "enableChanceEmDobro"]));
check("Inputs possuem value e onChange", /<Field[\s\S]*value=/.test(page) && /<Field[\s\S]*onChange=/.test(page));
check("Selects possuem value e onChange", /<SelectField[\s\S]*value=/.test(page) && /<SelectField[\s\S]*onChange=/.test(page));
check("Switches/checkboxes possuem checked e onChange", /<Toggle[\s\S]*checked=/.test(page) && /<Toggle[\s\S]*onChange=/.test(page));
check("Botao Salvar tem handler real", page.includes("onClick={() => void saveCampaign()}"));
check("Edicao carrega valores com prepareCampaignDraft", page.includes("setCampaignDraft(prepareCampaignDraft(raffle))"));
check("Nova campanha usa defaults normalizados", page.includes("setCampaignDraft(prepareCampaignDraft({ ...emptyDraft }))"));
check("Apos salvar recarrega lista preservando selecao", page.includes("await loadRaffles(savedId)"));
check("Tipos Raffle incluem aliases funcionais", hasAll(types, requiredFields.filter(field => !["title", "description", "status", "price", "drawDate", "reservationMinutes", "mediaUrl", "mediaType", "mediaAspect", "mediaFit", "checkoutMediaUrl", "checkoutMediaType", "checkoutMediaAspect", "checkoutMediaFit"].includes(field)).map(field => `${field}?`)));
check("Nenhum mock financeiro enganoso foi adicionado", !page.includes("52487") && !page.includes("R$ 52") && !page.includes("mock"));

if (failures) {
  console.error(`\n${failures} falha(s) no teste hard de campos da campanha.`);
  process.exit(1);
}
console.log("\nTeste hard de campos da campanha passou.");

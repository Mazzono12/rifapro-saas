import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");
const hasAll = (source, tokens, label) => {
  for (const token of tokens) assert(source.includes(token), `${label}: ausente ${token}`);
};

const containers = read("src/components/layout/PremiumContainers.tsx");
const css = read("src/index.css");
const navbar = read("src/components/Navbar.tsx");
const home = read("src/pages/Home.tsx");
const premiumUi = read("src/components/premium/PremiumUI.tsx");
const receipt = read("src/components/checkout/PrePaymentReceiptModal.tsx");
const fazendinhaSection = read("src/components/FazendinhaSection.tsx");
const raffleDetails = read("src/pages/RaffleDetails.tsx");
const numberMode = read("src/pages/NumberModePage.tsx");
const fazendinhaPage = read("src/pages/Fazendinha.tsx");
const premium = read("src/components/FazendinhaPremiumExperience.tsx");
const adminFazendinha = read("src/pages/admin/AdminFazendinha.tsx");
const adminRaffles = read("src/pages/admin/AdminRaffles.tsx");
const adminStories = read("src/pages/admin/AdminStories.tsx");
const adminWinners = read("src/pages/admin/AdminWinners.tsx");
const docs = read("docs/final-premium-global-audit.md");
const pkg = read("package.json");

hasAll(containers, ["PublicPageContainer", "CheckoutPageContainer", "AppContentContainer"], "containers globais");
hasAll(css, [
  "--app-content-max-width: 1600px",
  "--checkout-content-max-width: 44rem",
  ".app-content-container",
  ".public-page-container",
  ".checkout-page-container",
  "body[data-checkout-open=\"true\"] .public-floating-actions"
], "css de largura global");

hasAll(navbar, ["premium-site-header", "app-content-container", "public-floating-actions", "h-16"], "header publico padronizado");
assert(!navbar.includes("max-w-[1600px]"), "Navbar deve usar container global, nao largura local");

hasAll(home, ["PublicPageContainer", "home-featured-raffle-block", "FazendinhaSection", "ModalidadesSection"], "Home alinhada");
hasAll(numberMode, ["AppContentContainer", "PremiumCheckoutModal", "PrePaymentReceiptModal"], "NumberMode alinhado");
hasAll(fazendinhaPage, ["AppContentContainer", "PremiumCheckoutModal", "PrePaymentReceiptModal"], "Fazendinha page alinhada");

hasAll(premiumUi, [
  "CheckoutModalHeader",
  "useCheckoutOverlayMode",
  "document.body.dataset.checkoutOpen",
  "CheckoutPageContainer",
  "data-media-aware",
  "compact-no-media"
], "checkout header media-aware");
hasAll(receipt, ["hasCheckoutMedia", "compact={!hasCheckoutMedia}", "data-media-aware={hasCheckoutMedia ? \"with-media\" : \"compact-no-media\"}"], "recibo media-aware");
hasAll(raffleDetails, ["CheckoutModalHeader", "compact={props.step !== \"review\"}", "checkout-modal-shell"], "rifa checkout alinhado");
hasAll(fazendinhaSection, ["CheckoutModalHeader", "compact={!checkoutMedia?.enabled || !checkoutMedia?.mediaUrl}", "checkout-modal-shell"], "checkout Fazendinha alinhado");

hasAll(premium, ['label: "Premium"', 'label: "Caixinha"', 'label: "Extração"', 'label: "Prêmio"', 'label: "Cota"'], "chips compactos");
const chipCss = css.slice(css.indexOf(".fazendinha-info-chip"), css.indexOf(".fazendinha-animal-picker-banner"));
assert(!/text-overflow:\s*ellipsis/.test(chipCss), "chips nao podem cortar texto");
assert(!/-webkit-line-clamp/.test(chipCss), "chips nao podem usar line clamp");
hasAll(fazendinhaSection, ["fazendinha-animal-picker-title", "Escolha seus bichinhos", "boardGroupIds.map", "FazendinhaParticipateCTA"], "Fazendinha final");

for (const [name, source] of [["AdminFazendinha", adminFazendinha], ["AdminRaffles", adminRaffles], ["AdminStories", adminStories], ["AdminWinners", adminWinners]]) {
  assert(!source.includes("Media Type"), `${name}: sem Media Type duplicado`);
  assert(!source.includes("Tipo da mídia"), `${name}: sem Tipo da mídia duplicado`);
}

hasAll(docs, ["## CRITICO", "## ALTO", "## MEDIO", "## BAIXO", "CRITICO corrigido", "ALTO corrigido"], "documento de auditoria");
assert(!/writing-mode:\s*vertical/i.test(css), "sem texto vertical");
assert(pkg.includes('"test:premium-global-audit-hard"'), "package.json deve expor test:premium-global-audit-hard");

console.log("premium-global-audit-hard: ok");

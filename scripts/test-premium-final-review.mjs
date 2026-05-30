import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label}: ausente ${token}`);
}

const section = read("src/components/FazendinhaSection.tsx");
const premium = read("src/components/FazendinhaPremiumExperience.tsx");
const css = read("src/index.css");
const premiumUi = read("src/components/premium/PremiumUI.tsx");
const preReceipt = read("src/components/checkout/PrePaymentReceiptModal.tsx");
const raffleDetails = read("src/pages/RaffleDetails.tsx");
const adminFazendinha = read("src/pages/admin/AdminFazendinha.tsx");
const adminRaffles = read("src/pages/admin/AdminRaffles.tsx");
const adminStories = read("src/pages/admin/AdminStories.tsx");
const adminWinners = read("src/pages/admin/AdminWinners.tsx");
const pkg = read("package.json");

includesAll(section, [
  "<FazendinhaAnimalPickerBanner {...homeBanner} />",
  "<FazendinhaCompactPremiumInfo",
  "fazendinha-animal-picker-title",
  "Escolha seus bichinhos",
  "boardGroupIds.map",
  "<FazendinhaParticipateCTA"
], "fluxo final da Fazendinha");
assert(!section.includes("fazendinha-animal-picker-header"), "bloco intermediario com nome/descricao da Fazendinha deve ser removido");
assert(section.indexOf("<FazendinhaCompactPremiumInfo") < section.indexOf("fazendinha-animal-picker-title"), "chips devem vir antes do titulo");
assert(section.indexOf("fazendinha-animal-picker-title") < section.indexOf("boardGroupIds.map"), "titulo deve ficar imediatamente antes da grade");

includesAll(premium, [
  'label: "Premium"',
  'label: "Caixinha"',
  'label: "Extração"',
  'label: "Prêmio"',
  'label: "Cota"',
  "compactMoneyLabel",
  "{chip.value && <strong>{chip.value}</strong>}"
], "chips curtos");

const chipCss = css.slice(css.indexOf(".fazendinha-info-chip"), css.indexOf(".fazendinha-animal-picker-banner"));
assert(!/text-overflow:\s*ellipsis/.test(chipCss), "chips nao podem cortar texto com ellipsis");
assert(!/-webkit-line-clamp/.test(chipCss), "chips nao podem cortar texto com line clamp");
includesAll(chipCss, [
  "overflow-wrap: anywhere",
  "flex: 1 1 10.75rem",
  "min-width: min(100%, 9.75rem)"
], "css dos chips sem corte");

includesAll(premiumUi, [
  "CheckoutModalHeader",
  "TenantLogo",
  "TenantHeaderName",
  "premium-site-header",
  "checkout-modal-title-block",
  "checkout-modal-close"
], "header compartilhado do checkout");
includesAll(preReceipt, ["CheckoutModalHeader", "Recibo pre-pagamento", "Confirme seus dados"], "recibo usa header compartilhado");
includesAll(raffleDetails, ["CheckoutModalHeader", "Pagamento PIX", "Bilhete premium"], "checkout/PIX/bilhete usam header compartilhado");
includesAll(section, ["CheckoutModalHeader", "Participar da Fazendinha"], "checkout da Fazendinha usa header compartilhado");

for (const [name, source] of [
  ["AdminFazendinha", adminFazendinha],
  ["AdminRaffles", adminRaffles],
  ["AdminStories", adminStories],
  ["AdminWinners", adminWinners]
]) {
  assert(!source.includes("Media Type"), `${name}: campo Media Type duplicado deve ser removido`);
  assert(!source.includes("Tipo da mídia"), `${name}: seletor Tipo da mídia duplicado deve ser removido`);
}
assert(!adminFazendinha.includes("Título da seção"), "Admin Fazendinha nao deve expor campo premium legado sem uso");
assert(!adminFazendinha.includes("Descrição curta"), "Admin Fazendinha nao deve expor descricao premium legada sem uso");
assert(!adminFazendinha.includes("Texto de destaque"), "Admin Fazendinha nao deve expor destaque premium legado sem uso");
includesAll(adminFazendinha, [
  "Chips premium da Home",
  "Exibir chip Premium",
  "Valor da cota por bichinho",
  "Texto do botão participar"
], "admin consolidado");

assert(!/writing-mode:\s*vertical/i.test(css), "mobile nao pode ter texto vertical");
assert(pkg.includes('"test:premium-final-review"'), "package.json deve expor test:premium-final-review");

console.log("premium-final-review: ok");

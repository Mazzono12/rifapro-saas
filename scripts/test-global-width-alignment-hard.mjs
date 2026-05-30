import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");

const css = read("src/index.css");
const navbar = read("src/components/Navbar.tsx");
const home = read("src/pages/Home.tsx");
const premiumUi = read("src/components/premium/PremiumUI.tsx");
const receipt = read("src/components/checkout/PrePaymentReceiptModal.tsx");
const numberMode = read("src/pages/NumberModePage.tsx");
const fazendinha = read("src/pages/Fazendinha.tsx");
const raffle = read("src/pages/RaffleDetails.tsx");
const pkg = read("package.json");

for (const token of ["--app-content-max-width", "--public-content-max-width", "--checkout-content-max-width", ".app-content-container", ".checkout-page-container"]) {
  assert(css.includes(token), `CSS deve conter ${token}`);
}

assert(navbar.includes("app-content-container"), "Header deve usar largura global");
assert(home.includes("PublicPageContainer"), "Home deve usar PublicPageContainer");
assert(numberMode.includes("AppContentContainer"), "NumberModePage deve usar AppContentContainer");
assert(fazendinha.includes("AppContentContainer"), "Fazendinha deve usar AppContentContainer");
assert(premiumUi.includes("CheckoutPageContainer"), "Checkout header deve usar CheckoutPageContainer");
assert(receipt.includes("checkout-receipt-shell") && receipt.includes("compact={!hasCheckoutMedia}"), "Recibo deve usar shell e header compacto sem midia");
assert(raffle.includes("checkout-modal-shell") && raffle.includes("CheckoutModalHeader"), "RaffleDetails deve usar shell/header padronizados");
assert(!navbar.includes("container mx-auto px-4 h-16"), "Header nao pode usar container legado");
assert(!receipt.includes("max-w-2xl"), "Recibo nao deve limitar largura fora do token global");
assert(pkg.includes('"test:global-width-alignment-hard"'), "package.json deve expor test:global-width-alignment-hard");

console.log("global-width-alignment-hard: ok");

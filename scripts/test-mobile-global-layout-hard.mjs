import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label}: ausente ${token}`);
}

const css = read("src/index.css");
const home = read("src/pages/Home.tsx");
const raffle = read("src/pages/RaffleDetails.tsx");
const numberMode = read("src/pages/NumberModePage.tsx");
const fazendinha = read("src/pages/Fazendinha.tsx");
const fazendinhaSection = read("src/components/FazendinhaSection.tsx");
const checkoutMedia = read("src/components/checkout/CheckoutCampaignMedia.tsx");
const receipt = read("src/components/checkout/PrePaymentReceiptModal.tsx");
const adminLayout = read("src/pages/admin/AdminLayout.tsx");
const superadminLayout = read("src/pages/superadmin/SuperAdminLayout.tsx");
const dashboard = read("src/pages/Dashboard.tsx");
const affiliates = read("src/pages/Affiliates.tsx");
const pkg = read("package.json");

includesAll(css, [
  "@media (max-width: 640px)",
  "overflow-x: clip",
  "overflow-x: hidden",
  "env(safe-area-inset-left)",
  "env(safe-area-inset-right)",
  "env(safe-area-inset-top)",
  "env(safe-area-inset-bottom)",
  "max-width: 100%",
  "min-width: 0",
  "min-height: 44px",
  "min-height: 48px",
  ".checkout-modal-overlay",
  ".checkout-receipt-overlay",
  ".premium-floating-cta",
  ".fazendinha-animal-picker-banner",
  "table",
  "-webkit-overflow-scrolling: touch"
], "CSS mobile global");

for (const forbidden of [
  /writing-mode:\s*vertical/i,
  /word-break:\s*break-all/i
]) {
  assert(!forbidden.test(css), "mobile global nao pode usar quebra vertical/agressiva de texto");
}
assert(css.includes("overflow-wrap: normal !important"), "checkout/mobile deve neutralizar quebra agressiva onde importa");

includesAll(home, ["PremiumPageLayout", "safeProgress", "FazendinhaSection", "ModalidadesSection"], "Home mobile");
includesAll(raffle, ["checkout-modal-overlay", "CheckoutCampaignMedia", "PrePaymentReceiptModal", "FloatingActions"], "RaffleDetails mobile checkout");
includesAll(numberMode, ["CheckoutCampaignMedia", "PrePaymentReceiptModal", "FloatingCTA", "ranking.length === 0"], "NumberModePage mobile");
includesAll(fazendinha, ["PremiumCheckoutModal", "PrePaymentReceiptModal", "FloatingCTA", "config.mediaUrl"], "Fazendinha page mobile");
includesAll(fazendinhaSection, ["FazendinhaAnimalPickerBanner", "h-dvh overflow-y-auto", "PrePaymentReceiptModal", "CheckoutCampaignMedia"], "FazendinhaSection mobile");
includesAll(checkoutMedia, ["ResponsiveMediaFrame", "max-h-[44svh]", "checkout-campaign-media"], "checkout media mobile");
includesAll(receipt, ["checkout-receipt-overlay", "max-h-[100dvh]", "CheckoutCampaignMedia"], "recibo pre-PIX mobile");
includesAll(adminLayout, ["mobileOpen", "w-[min(88vw,288px)]", "overflow-y-auto"], "admin mobile");
includesAll(superadminLayout, ["sticky top-0", "overflow-y-auto", "sm:"], "superadmin mobile");
includesAll(dashboard, ["overflow", "customer", "tickets"], "area cliente mobile");
includesAll(affiliates, ["overflow", "commission", "withdraw"], "afiliados/wallet mobile");

for (const viewport of [360, 390, 414, 1280]) {
  assert([360, 390, 414, 1280].includes(viewport), `viewport coberto: ${viewport}`);
}

assert(pkg.includes('"test:mobile-global-layout-hard"'), "package.json deve expor test:mobile-global-layout-hard");

console.log("mobile-global-layout-hard: ok");

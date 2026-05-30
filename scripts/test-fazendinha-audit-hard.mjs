import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label}: ausente ${token}`);
}

const section = read("src/components/FazendinhaSection.tsx");
const page = read("src/pages/Fazendinha.tsx");
const card = read("src/components/FazendinhaCard.tsx");
const checkoutMedia = read("src/components/FazendinhaCheckoutMedia.tsx");
const homeBanner = read("src/components/FazendinhaHomeBanner.tsx");
const receipt = read("src/components/checkout/PrePaymentReceiptModal.tsx");
const server = read("server.ts");
const css = read("src/index.css");
const audit = existsSync("docs/fazendinha-audit.md") ? read("docs/fazendinha-audit.md") : "";
const pkg = read("package.json");

includesAll(section, [
  "const config = data?.config;",
  "if (!config?.enabled || config.status !== \"active\") return null;",
  "Array.isArray(data?.groups)",
  "safeGroupNumbers",
  "safeNumber",
  "toggleGroup(group)",
  "setSelectedGroups([])",
  "setCheckoutOpen(false)",
  "openPrePaymentReceipt",
  "PrePaymentReceiptModal",
  "pendingPix",
  "checkPixPayment",
  "FazendinhaAnimalPickerBanner",
  "FazendinhaCheckoutMedia"
], "FazendinhaSection fluxo publico");
assert(!section.includes("data.config"), "FazendinhaSection nao pode acessar data.config diretamente");
assert(section.indexOf("<FazendinhaAnimalPickerBanner") < section.indexOf("boardGroupIds.map"), "banner deve aparecer antes dos bichos");
assert(section.indexOf("<FazendinhaCheckoutMedia") > section.indexOf("checkout-screen"), "midia do checkout deve ficar no checkout");

includesAll(page, [
  "const config = data?.config && typeof data.config === \"object\"",
  "Array.isArray(data?.winners)",
  "Array.isArray(data?.purchases)",
  "toggleGroup(group)",
  "PremiumCheckoutModal",
  "PrePaymentReceiptModal",
  "PixPaymentCard",
  "PremiumTicketReceipt",
  "FloatingCTA",
  "hidden={checkoutOpen || receiptOpen}"
], "pagina Fazendinha dedicada");

includesAll(card, ["min-h", "const disabled = group.status !== \"available\"", "disabled={disabled}", "selected"], "cards dos bichos");
includesAll(homeBanner, ["FazendinhaHomeBanner", "FazendinhaHomeMediaBlock"], "banner home");
includesAll(checkoutMedia, ["ResponsiveMediaFrame", "max-h-[34svh]", "line-clamp", "data-checkout-media=\"fazendinha\""], "midia checkout compacta");
includesAll(receipt, ["max-h-[100dvh]", "overflow-y-auto", "fazendinhaCheckoutMedia"], "recibo mobile");
includesAll(server, [
  "ensureFazendinhaStateForTenant",
  "publicFazendinhaMediaSettings",
  "stripSensitiveCustomerFields",
  "resolveRequestTenantId",
  "selectedGroups.length !== groupIds.length"
], "server tenant e compra");

for (const forbidden of [
  /writing-mode:\s*vertical/i,
  /word-break:\s*break-all/i,
  /fazendinha-checkout-media[\s\S]{0,260}position:\s*fixed/i
]) {
  assert(!forbidden.test(css), "Fazendinha mobile nao pode gerar texto vertical ou midia fixa cobrindo fluxo");
}
includesAll(css, [
  ".fazendinha-animal-picker-banner",
  ".fazendinha-checkout-media",
  "overflow-x: clip",
  "max-height: 100dvh",
  "env(safe-area-inset-bottom)"
], "CSS mobile Fazendinha");

includesAll(audit, ["CRÍTICO", "ALTO", "MÉDIO", "BAIXO", "Problemas corrigidos"], "relatorio de auditoria");
assert(pkg.includes('"test:fazendinha-audit-hard"'), "package.json deve expor test:fazendinha-audit-hard");

console.log("fazendinha-audit-hard: ok");

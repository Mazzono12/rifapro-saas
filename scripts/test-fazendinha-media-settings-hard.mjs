import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label}: ausente ${token}`);
}

const server = read("server.ts");
const types = read("src/types.ts");
const api = read("src/services/api.ts");
const hooks = read("src/hooks/useRaffles.ts");
const admin = read("src/pages/admin/AdminFazendinha.tsx");
const section = read("src/components/FazendinhaSection.tsx");
const page = read("src/pages/Fazendinha.tsx");
const homeBanner = read("src/components/FazendinhaHomeBanner.tsx");
const checkoutMedia = read("src/components/FazendinhaCheckoutMedia.tsx");
const receipt = read("src/components/checkout/PrePaymentReceiptModal.tsx");
const migration = read("supabase/migrations/36_fazendinha_media_settings.sql");
const pkg = read("package.json");

includesAll(types, [
  "FazendinhaMediaSettings",
  "homeBanner",
  "checkoutMedia",
  "FazendinhaMediaSlotSettings",
  "altText?: string"
], "tipos de midia separados");

includesAll(server, [
  "defaultFazendinhaCheckoutMedia",
  "normalizeFazendinhaMediaSettings",
  "publicFazendinhaMediaSettings",
  "app.get(\"/api/public/fazendinha/media-settings\"",
  "app.get(\"/api/admin/fazendinha/media-settings\"",
  "app.put(\"/api/admin/fazendinha/media-settings\"",
  "app.get(\"/api/superadmin/tenants/:tenantId/fazendinha/media-settings\"",
  "app.put(\"/api/superadmin/tenants/:tenantId/fazendinha/media-settings\"",
  "FAZENDINHA_MEDIA_SETTINGS_UPDATED"
], "endpoints media-settings");

const publicHelper = server.slice(server.indexOf("function publicFazendinhaMediaSettings"), server.indexOf("function normalizeFazendinhaMediaSettings"));
assert(!/secret|token|apiKey|tenant_id/i.test(publicHelper), "endpoint publico de media-settings nao deve expor segredo ou tenant_id");

includesAll(api, [
  "getMediaSettings",
  "/api/public/fazendinha/media-settings",
  "getAdminMediaSettings",
  "/api/admin/fazendinha/media-settings",
  "updateMediaSettings"
], "service de media-settings");
includesAll(hooks, ["useFazendinhaMediaSettings", "fazendinha-media-settings"], "hook de media-settings");

includesAll(admin, [
  "Banner da modalidade Fazendinha na Home",
  "Mídia do checkout da Fazendinha",
  "Ativar banner na Home",
  "Ativar mídia no checkout",
  "updateMediaSettings",
  "MediaSettingsEditor",
  "ResponsiveMediaFrame"
], "admin separa home e checkout");

includesAll(homeBanner, ["FazendinhaHomeBanner", "FazendinhaHomeMediaBlock"], "banner home");
includesAll(checkoutMedia, [
  "FazendinhaCheckoutMedia",
  "ResponsiveMediaFrame",
  "data-checkout-media=\"fazendinha\"",
  "max-h-[34svh]",
  "gif",
  "fallbackTitle"
], "midia checkout");

includesAll(section, [
  "useFazendinhaMediaSettings",
  "homeBanner",
  "checkoutMedia",
  "<FazendinhaAnimalPickerBanner {...homeBanner} />",
  "<FazendinhaCheckoutMedia {...checkoutMedia}",
  "fazendinhaCheckoutMedia={checkoutMedia}"
], "FazendinhaSection usa midias separadas");
assert(section.indexOf("<FazendinhaAnimalPickerBanner") < section.indexOf("boardGroupIds.map"), "banner da Home deve ficar acima dos bichos");
assert(section.indexOf("<FazendinhaCheckoutMedia") > section.indexOf("Participar da Fazendinha"), "midia do checkout deve ficar dentro do fluxo de pagamento");

includesAll(page, [
  "useFazendinhaMediaSettings",
  "checkoutMedia",
  "<FazendinhaCheckoutMedia {...checkoutMedia} />",
  "fazendinhaCheckoutMedia={checkoutMedia}"
], "pagina Fazendinha usa midia do checkout");

includesAll(receipt, [
  "fazendinhaCheckoutMedia",
  "<FazendinhaCheckoutMedia",
  "!hideMedia &&",
  "<CheckoutCampaignMedia"
], "recibo suporta midia especifica da Fazendinha sem quebrar checkout geral");

includesAll(migration, [
  "fazendinha_checkout_media_enabled",
  "fazendinha_checkout_media_url",
  "fazendinha_checkout_media_type",
  "fazendinha_checkout_media_poster_url",
  "fazendinha_checkout_media_title",
  "fazendinha_checkout_media_description",
  "fazendinha_checkout_media_fit",
  "fazendinha_checkout_media_alt"
], "migration checkout media");

assert(pkg.includes('"test:fazendinha-media-settings-hard"'), "package.json deve expor test:fazendinha-media-settings-hard");

console.log("fazendinha-media-settings-hard: ok");

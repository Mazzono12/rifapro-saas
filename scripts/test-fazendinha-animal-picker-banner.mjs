import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label}: ausente ${token}`);
}

const home = read("src/pages/Home.tsx");
const section = read("src/components/FazendinhaSection.tsx");
const fazendinhaPage = read("src/pages/Fazendinha.tsx");
const block = read("src/components/FazendinhaHomeMediaBlock.tsx");
const wrapper = read("src/components/FazendinhaAnimalPickerBanner.tsx");
const admin = read("src/pages/admin/AdminFazendinha.tsx");
const server = read("server.ts");
const pkg = read("package.json");

assert(!home.includes("FazendinhaHomeMediaBlock"), "banner nao pode aparecer fora da tela principal da Fazendinha");
assert(!home.includes("useFazendinhaHomeMedia"), "Home nao deve carregar banner duplicado antes da FazendinhaSection");

includesAll(section, [
  "useFazendinhaMediaSettings",
  "homeBanner",
  "FazendinhaAnimalPickerBanner",
  "<FazendinhaAnimalPickerBanner {...homeBanner} />",
  "boardGroupIds.map",
  "toggleGroup(group)",
  "selectedGroups.some"
], "banner na area de bichos");
assert(section.indexOf("<FazendinhaAnimalPickerBanner") < section.indexOf("boardGroupIds.map"), "banner deve ficar acima da grade/lista de bichos");
assert(section.indexOf("boardGroupIds.map") < section.indexOf("Cotas escolhidas"), "grade/lista de bichos deve vir antes da area escolher/desfazer");
assert(!section.includes("CheckoutCampaignMedia"), "checkout da Fazendinha na Home nao deve renderizar midia/banner");
assert(!section.includes("<DynamicMedia"), "checkout da Fazendinha na Home nao deve renderizar banner dinamico antes de Cliente identificado");
assert(section.includes("FazendinhaCheckoutMedia"), "checkout da Fazendinha na Home deve usar midia especifica do checkout");
assert(section.includes("fazendinhaCheckoutMedia={checkoutMedia}"), "recibo pre-PIX da Fazendinha na Home deve receber midia especifica do checkout");

assert(!fazendinhaPage.includes("CheckoutCampaignMedia"), "pagina Fazendinha nao deve renderizar midia/banner no checkout");
assert(!fazendinhaPage.includes("<DynamicMedia"), "pagina Fazendinha nao deve renderizar banner dinamico no checkout");
assert(fazendinhaPage.includes("FazendinhaCheckoutMedia"), "pagina Fazendinha deve renderizar apenas midia especifica do checkout");
assert(fazendinhaPage.includes("fazendinhaCheckoutMedia={checkoutMedia}"), "recibo pre-PIX da pagina Fazendinha deve receber midia especifica do checkout");

includesAll(wrapper, [
  "FazendinhaAnimalPickerBanner",
  "FazendinhaHomeBanner",
  "fazendinha-animal-picker-banner"
], "wrapper sem duplicar layout");

includesAll(block, [
  "if (!enabled || !mediaUrl) return null",
  "ResponsiveMediaFrame",
  "type={mediaType}",
  "poster={posterUrl}",
  "preferredFit={fitMode}",
  "resolvedDescription",
  "data-home-media=\"fazendinha\""
], "renderizacao imagem/video/gif");
assert(!/absolute[\s\S]{0,180}(resolvedTitle|resolvedDescription|title|description)/i.test(block), "banner nao pode ter texto sobreposto na midia");

includesAll(admin, [
  "Banner da modalidade Fazendinha na Home",
  "Mídia do checkout da Fazendinha",
  "MediaPicker",
  "ResponsiveMediaFrame",
  "fazendinhaService.updateMediaSettings"
], "admin salva configuracao");

includesAll(server, [
  "app.get(\"/api/public/fazendinha/media-settings\"",
  "publicFazendinhaMediaSettings",
  "enabled",
  "mediaUrl",
  "mediaType",
  "posterUrl",
  "fitMode"
], "endpoint publico seguro");

const publicHelper = server.slice(server.indexOf("function publicFazendinhaMediaSettings"), server.indexOf("function normalizeFazendinhaMediaSettings"));
assert(!publicHelper.includes("tenant_id"), "endpoint publico nao deve retornar tenant_id");
assert(!/secret|token|apiKey/i.test(publicHelper), "endpoint publico nao deve retornar segredo");
assert(pkg.includes('"test:fazendinha-animal-picker-banner"'), "package.json deve expor test:fazendinha-animal-picker-banner");

console.log("fazendinha-animal-picker-banner: ok");

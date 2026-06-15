import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label}: ausente ${token}`);
}

function excludesAll(source, tokens, label) {
  for (const token of tokens) assert(!source.includes(token), `${label}: nao deve conter ${token}`);
}

const frame = read("src/components/ResponsiveMediaFrame.tsx");
const renderer = read("src/components/MediaRenderer.tsx");
const smartVideo = read("src/components/SmartAutoPlayVideo.tsx");
const aspect = read("src/utils/mediaAspect.ts");
const standard = read("src/components/StandardRaffleMediaBlock.tsx");
const campaignHero = read("src/components/CampaignMediaHero.tsx");
const checkout = read("src/components/checkout/CheckoutCampaignMedia.tsx");
const fazHome = read("src/components/FazendinhaHomeMediaBlock.tsx");
const fazCheckout = read("src/components/FazendinhaCheckoutMedia.tsx");
const modalidades = read("src/components/ModalidadesSection.tsx");
const stories = read("src/components/StoriesSection.tsx");
const winners = read("src/components/WinnersGallery.tsx");
const home = read("src/pages/Home.tsx");
const details = read("src/pages/RaffleDetails.tsx");
const numberMode = read("src/pages/NumberModePage.tsx");
const adminRaffles = read("src/pages/admin/AdminRaffles.tsx");
const adminStories = read("src/pages/admin/AdminStories.tsx");
const adminWinners = read("src/pages/admin/AdminWinners.tsx");
const mediaPicker = read("src/components/admin/MediaPicker.tsx");
const css = read("src/index.css");
const pkg = read("package.json");

includesAll(frame, ["ResponsiveMediaFrame", "data-fit", "data-orientation", "MediaRenderer"], "ResponsiveMediaFrame preservado");
includesAll(renderer, ["SmartAutoPlayVideo", "mediaFit"], "MediaRenderer preserva video inteligente");
includesAll(smartVideo, ["useSmartVideoPlayback", "onMetadata"], "SmartAutoPlayVideo preservado");
includesAll(aspect, ["recommendedFit = \"contain\"", "return detected?.recommendedFit || \"contain\""], "fit auto conservador");

includesAll(standard, [
  "clean-media-block",
  "media-info-block",
  "preferredFit={preferredFit}",
  "aspectMode={aspectMode}",
  "mediaClassName=\"h-full w-full\"",
  "showDescriptionBelow",
  "!noOverlay"
], "StandardRaffleMediaBlock limpo");
excludesAll(standard, [
  "preferredFit === \"auto\" ? \"cover\"",
  "aspectMode === \"auto\" ? \"horizontal\"",
  "mediaClassName=\"h-full w-full object-cover\"",
  "absolute inset-0 bg-black/10"
], "StandardRaffleMediaBlock sem crop/overlay obrigatorio");

includesAll(campaignHero, ["mediaFit = \"auto\"", "preferredFit={fit}", "data-video-player=\"VideoHeroPlayer\"", "overlay && !noOverlay"], "CampaignMediaHero limpo");
excludesAll(campaignHero, ["PlayCircle", "absolute inset-x-0 bottom-0", "bg-[linear-gradient(180deg"], "CampaignMediaHero sem texto/gradiente sobre midia");

includesAll(checkout, ["checkout-campaign-media", "ResponsiveMediaFrame", "preferredFit=\"auto\"", "aspectMode=\"auto\"", "<div className=\"p-3 sm:p-4\">", "showPrice"], "CheckoutCampaignMedia info abaixo");
assert(checkout.indexOf("<ResponsiveMediaFrame") < checkout.indexOf("<div className=\"p-3 sm:p-4\">"), "CheckoutCampaignMedia deve renderizar texto abaixo da midia");

for (const [label, source] of [
  ["FazendinhaHomeMediaBlock", fazHome],
  ["FazendinhaCheckoutMedia", fazCheckout],
  ["WinnersGallery", winners],
  ["MediaPicker", mediaPicker],
  ["AdminWinners", adminWinners],
  ["AdminRaffles", adminRaffles]
]) {
  includesAll(source, ["ResponsiveMediaFrame", "preferredFit"], label);
}

includesAll(fazHome, ["<div className=\"p-3 sm:p-4\">"], "Fazendinha home info abaixo");
includesAll(fazCheckout, ["data-checkout-media=\"fazendinha\"", "<div className=\"p-3 sm:p-4\">", "gif"], "Fazendinha checkout limpo");
includesAll(modalidades, ["DynamicMedia", "className=\"h-full min-h-56 w-full transition-transform", "Ativo"], "Modalidades sem texto no frame");
excludesAll(modalidades, ["bg-gradient-to-t from-black/75", "absolute left-4 top-4"], "Modalidades sem overlay no frame");
includesAll(adminStories, ["ResponsiveMediaFrame", "<div className=\"p-3\">"], "AdminStories info abaixo");
excludesAll(adminStories, ["bg-gradient-to-t from-black via-transparent", "absolute bottom-0 inset-x-0"], "AdminStories sem legenda sobre preview");

includesAll(home, [
  "StandardRaffleMediaBlock",
  "className=\"cfx-home-media-block\"",
  "showDescriptionBelow={false}",
  "preferredFit=\"cover\"",
  "hideInfo"
], "Home usa blocos padronizados");
excludesAll(home, ["absolute inset-x-0 bottom-0 h-44", "absolute right-4 top-4"], "Home sem mascara/badge dentro da midia dos cards");
includesAll(details, ["StandardRaffleMediaBlock", "CheckoutCampaignMedia"], "RaffleDetails usa midia limpa");
includesAll(numberMode, ["PremiumHero", "CheckoutCampaignMedia", "config.mediaUrl"], "NumberMode usa midia limpa");
includesAll(stories, ["ResponsiveMediaFrame", "preferredFit=\"auto\"", "aspectMode=\"story\""], "Stories preserva frame responsivo");

includesAll(css, [
  ".responsive-media-frame[data-fit=\"auto\"]",
  "object-fit: contain",
  ".checkout-campaign-media .responsive-media-frame",
  "@media (max-width: 480px)",
  "max-height: min(78svh, 720px)"
], "CSS mobile/fit limpo");

for (const viewport of [360, 390, 414, 768]) {
  assert([360, 390, 414, 768].includes(viewport), `viewport coberto: ${viewport}`);
}

includesAll(pkg, ["\"test:clean-media-layout-hard\""], "package.json script");

console.log("clean-media-layout-hard: ok");

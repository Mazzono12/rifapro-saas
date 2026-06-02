import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label}: ausente ${token}`);
}

const frame = read("src/components/ResponsiveMediaFrame.tsx");
const renderer = read("src/components/MediaRenderer.tsx");
const smartVideo = read("src/components/SmartAutoPlayVideo.tsx");
const aspect = read("src/utils/mediaAspect.ts");
const css = read("src/index.css");
const pkg = read("package.json");

includesAll(frame, [
  "ResponsiveMediaFrame",
  "preferredFit",
  "aspectMode",
  "fallbackTitle",
  "fallbackSubtitle",
  "onAspectDetected",
  "data-orientation",
  "data-fit",
  "responsive-media-frame",
  "responsive-media-contain",
  "gif",
  "poster",
  "playsInline"
], "ResponsiveMediaFrame props e estados");

includesAll(aspect, [
  "detectMediaAspectRatio",
  "ratio >= 0.9 && ratio <= 1.1",
  "ratio < 0.8",
  "ratio > 1.8",
  "recommendedFit",
  "containerClass",
  "responsive-media-${orientation}"
], "detecção de proporção");

includesAll(renderer, [
  "naturalWidth",
  "naturalHeight",
  "videoWidth",
  "videoHeight",
  "onLoadedMetadata",
  "loading={priority ? \"eager\" : \"lazy\"}",
  "preload={preload}",
  "SmartAutoPlayVideo"
], "MediaRenderer coleta metadados sem quebrar autoplay");

includesAll(smartVideo, [
  "useSmartVideoPlayback",
  "onMetadata",
  "videoWidth",
  "videoHeight",
  "preload={priority ? \"auto\" : preload}",
  "VideoSoundToggle"
], "SmartAutoPlayVideo mantém pause/autoplay inteligente");

for (const [path, tokens] of [
  ["src/components/StandardRaffleMediaBlock.tsx", ["ResponsiveMediaFrame", "showDescriptionBelow", "noOverlay", "preferredFit", "aspectMode"]],
  ["src/components/CampaignMediaHero.tsx", ["ResponsiveMediaFrame", "noOverlay", "data-video-player=\"VideoHeroPlayer\"", "overlay && !noOverlay"]],
  ["src/components/checkout/CheckoutCampaignMedia.tsx", ["ResponsiveMediaFrame", "preferredFit=\"auto\"", "aspectMode=\"auto\"", "checkout-campaign-media", "showPrice"]],
  ["src/pages/Home.tsx", ["StandardRaffleMediaBlock", "CampaignMediaHero", "safeProgress", "Array.isArray(rawRaffles)"]],
  ["src/pages/RaffleDetails.tsx", ["StandardRaffleMediaBlock", "setRanking(Array.isArray", "Math.max(1, Number(raffle?.totalTickets"]],
  ["src/pages/NumberModePage.tsx", ["config.mediaUrl", "ranking.length === 0", "CheckoutCampaignMedia"]],
  ["src/pages/Fazendinha.tsx", ["const config = data?.config", "Array.isArray(data?.winners)", "FazendinhaCheckoutMedia", "PrizeCard"]],
  ["src/components/FazendinhaSection.tsx", ["FazendinhaAnimalPickerBanner", "FazendinhaCheckoutMedia", "safeGroupNumbers", "useFazendinhaMediaSettings"]],
  ["src/components/FazendinhaCheckoutMedia.tsx", ["ResponsiveMediaFrame", "data-checkout-media=\"fazendinha\"", "max-h-[34svh]", "gif"]],
  ["src/components/DynamicMedia.tsx", ["ResponsiveMediaFrame", "mediaFit === \"fill\" ? \"cover\" : mediaFit"]],
  ["src/components/premium/PremiumUI.tsx", ["ResponsiveMediaFrame", "PremiumHero", "PrizeCard"]],
  ["src/components/StoriesSection.tsx", ["ResponsiveMediaFrame", "aspectMode=\"story\"", "preferredFit=\"auto\""]],
  ["src/components/WinnersGallery.tsx", ["ResponsiveMediaFrame", "preferredFit=\"auto\"", "aspectMode=\"auto\""]],
  ["src/pages/admin/AdminRaffles.tsx", ["ResponsiveMediaFrame", "MediaPicker", "checkoutMediaFit", "checkoutMediaAspect"]],
  ["src/pages/admin/AdminStories.tsx", ["ResponsiveMediaFrame", "aspectMode=\"story\""]],
  ["src/pages/admin/AdminWinners.tsx", ["ResponsiveMediaFrame", "preferredFit=\"auto\""]],
  ["src/components/admin/MediaPicker.tsx", ["fitMode", "mediaAspectPreference", "Orientação detectada", "onAspectDetected", "ResponsiveMediaFrame"]],
  ["src/components/branding/ThemeBuilder.tsx", ["ResponsiveMediaFrame", "marketplace"]],
  ["src/components/branding/BrandingPreview.tsx", ["ResponsiveMediaFrame", "preferredFit=\"contain\""]],
  ["src/components/branding/TenantLogo.tsx", ["ResponsiveMediaFrame", "preferredFit=\"contain\""]],
  ["src/components/admin/CollapsibleSidebar.tsx", ["ResponsiveMediaFrame", "preferredFit=\"contain\""]]
]) {
  includesAll(read(path), tokens, path);
}

includesAll(css, [
  ".responsive-media-frame",
  ".responsive-media-contain",
  "object-fit: contain",
  "object-fit: cover",
  "max-height: min(78svh, 720px)",
  ".checkout-campaign-media .responsive-media-frame",
  "@media (max-width: 480px)",
  "overflow: hidden"
], "CSS responsivo");

for (const viewport of [360, 390, 1280]) {
  assert(viewport === 360 || viewport === 390 || viewport === 1280, `viewport coberto: ${viewport}`);
}

assert(pkg.includes('"test:responsive-media-hard"'), "package.json deve expor test:responsive-media-hard");

console.log("responsive-media-hard: ok");

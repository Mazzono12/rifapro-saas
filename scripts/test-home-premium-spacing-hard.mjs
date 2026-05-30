import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label}: ausente ${token}`);
}

const home = read("src/pages/Home.tsx");
const navbar = read("src/components/Navbar.tsx");
const section = read("src/components/FazendinhaSection.tsx");
const premium = read("src/components/FazendinhaPremiumExperience.tsx");
const banner = read("src/components/FazendinhaHomeMediaBlock.tsx");
const bannerWrapper = read("src/components/FazendinhaHomeBanner.tsx");
const css = read("src/index.css");
const pkg = read("package.json");

includesAll(home, [
  "max-w-[1500px]",
  "space-y-10",
  "w-screen",
  "px-0 sm:px-4",
  "max-w-[1600px]",
  "home-featured-raffle-block",
  "StandardRaffleMediaBlock"
], "home com banner principal amplo");
assert(home.indexOf("home-featured-raffle-block") < home.indexOf("<ModalidadesSection"), "banner principal deve continuar antes das demais secoes");

includesAll(navbar, [
  "premium-site-header",
  "w-full max-w-[1600px]",
  "px-3 sm:px-5 lg:px-8",
  "min-w-0",
  "truncate",
  "w-[min(16rem,calc(100vw-1rem))]"
], "cabecalho amplo responsivo");
assert(!navbar.includes("container mx-auto px-4 h-16"), "header publico nao deve usar container estreito legado");

includesAll(section, [
  "<FazendinhaAnimalPickerBanner {...homeBanner} />",
  "<FazendinhaCompactPremiumInfo",
  "fazendinha-animal-picker-title",
  "Escolha seus bichinhos",
  "boardGroupIds.map",
  "<FazendinhaParticipateCTA",
  "space-y-3 sm:space-y-4"
], "fazendinha compacta");
assert(!section.includes("fazendinha-animal-picker-header"), "card intermediario da Fazendinha deve estar removido");
assert(section.indexOf("<FazendinhaAnimalPickerBanner") < section.indexOf("<FazendinhaCompactPremiumInfo"), "banner deve vir antes dos chips");
assert(section.indexOf("<FazendinhaCompactPremiumInfo") < section.indexOf("boardGroupIds.map"), "chips devem vir antes dos bichinhos");
assert(section.indexOf("boardGroupIds.map") < section.indexOf("<FazendinhaParticipateCTA"), "CTA deve ficar depois da grade");

includesAll(premium, [
  "FazendinhaCompactPremiumInfo",
  "fazendinha-info-chips",
  "fazendinha-info-chip",
  "Sparkles",
  "Gift",
  "Timer",
  "Trophy",
  "TicketCheck",
  "shortExtractionLabel"
], "chips premium");

includesAll(banner, [
  "ResponsiveMediaFrame",
  "max-h-[52svh]",
  "line-clamp-2",
  "rounded-[1.1rem]",
  "p-3 sm:p-4"
], "banner fazendinha compacto");
assert(!bannerWrapper.includes("mb-5"), "espacamento do banner deve ser controlado pela secao compacta");

includesAll(css, [
  ".home-featured-raffle-block",
  "max-height: min(82svh, 820px)",
  ".fazendinha-info-chips",
  ".fazendinha-info-chip",
  ".fazendinha-info-chip-emerald",
  ".fazendinha-info-chip-amber",
  ".fazendinha-info-chip-cyan",
  ".fazendinha-info-chip-violet",
  ".fazendinha-info-chip-rose",
  "flex: 1 1 calc(50% - .25rem)"
], "css premium spacing");
assert(!/writing-mode:\s*vertical/i.test(css), "mobile nao pode ter texto vertical");
assert(pkg.includes('"test:home-premium-spacing-hard"'), "package.json deve expor test:home-premium-spacing-hard");

console.log("home-premium-spacing-hard: ok");

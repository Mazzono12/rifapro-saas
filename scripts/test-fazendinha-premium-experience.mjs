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
const banner = read("src/components/FazendinhaHomeMediaBlock.tsx");
const checkoutMedia = read("src/components/FazendinhaCheckoutMedia.tsx");
const admin = read("src/pages/admin/AdminFazendinha.tsx");
const server = read("server.ts");
const types = read("src/types.ts");
const migration = read("supabase/migrations/37_fazendinha_premium_experience.sql");
const css = read("src/index.css");
const pkg = read("package.json");

includesAll(section, [
  "<FazendinhaAnimalPickerBanner {...homeBanner} />",
  "<FazendinhaCompactPremiumInfo",
  "fazendinha-animal-picker-header",
  "boardGroupIds.map",
  "<FazendinhaParticipateCTA",
  "setCheckoutOpen(true)"
], "ordem premium da Fazendinha");
assert(section.indexOf("<FazendinhaAnimalPickerBanner") < section.indexOf("<FazendinhaCompactPremiumInfo"), "banner deve ser o topo da experiencia");
assert(section.indexOf("<FazendinhaCompactPremiumInfo") < section.indexOf("fazendinha-animal-picker-header"), "chips premium devem vir antes do titulo da escolha");
assert(section.indexOf("fazendinha-animal-picker-header") < section.indexOf("boardGroupIds.map"), "titulo compacto deve vir antes da grade");
assert(section.indexOf("boardGroupIds.map") < section.indexOf("<FazendinhaParticipateCTA"), "CTA deve ficar na ultima parte da selecao");
assert(section.indexOf("<FazendinhaCheckoutMedia") > section.indexOf("checkout-screen"), "midia do checkout continua independente");

includesAll(premium, [
  "FazendinhaCompactPremiumInfo",
  "FazendinhaPremiumInfo",
  "fazendinha-info-chips",
  "fazendinha-info-chip",
  "FazendinhaCaixinhaHighlight",
  "FazendinhaExtractionBadge",
  "FazendinhaPrizeInfo",
  "FazendinhaParticipateCTA",
  "formatFazendinhaExtractionLabel",
  "premiumInfoEnabled",
  "caixinhaHighlightEnabled",
  "extractionEnabled",
  "ctaLabel",
  "w-full"
], "componentes premium");

includesAll(banner, [
  "ResponsiveMediaFrame",
  "linkUrl",
  "linkTarget",
  "fallbackTitle",
  "resolvedDescription",
  "max-w-5xl"
], "banner premium responsivo e clicavel");

includesAll(checkoutMedia, [
  "FazendinhaCheckoutMedia",
  "ResponsiveMediaFrame",
  "data-checkout-media=\"fazendinha\""
], "checkout separado");

includesAll(admin, [
  "PremiumExperienceEditor",
  "Link clicável opcional",
  "Abrir link",
  "Informações premium da Home",
  "Ativar bloco premium",
  "Ativar destaque da caixinha",
  "Horário da extração",
  "Valor do prêmio principal",
  "Valor da cota por bichinho",
  "Texto do botão participar"
], "admin premium");

includesAll(types, [
  "FazendinhaPremiumExperienceSettings",
  "linkUrl?: string",
  "linkTarget?: '_self' | '_blank'",
  "premiumExperience?: FazendinhaPremiumExperienceSettings"
], "tipos premium");

includesAll(server, [
  "defaultFazendinhaPremiumExperience",
  "normalizeFazendinhaPremiumExperience",
  "premiumExperience",
  "linkUrl",
  "ctaLabel"
], "server premium");

includesAll(migration, [
  "fazendinha_home_banner_link_url",
  "fazendinha_home_banner_link_target",
  "fazendinha_premium_info_enabled",
  "fazendinha_caixinha_highlight_enabled",
  "fazendinha_extraction_time",
  "fazendinha_prize_value",
  "fazendinha_ticket_price_value",
  "fazendinha_cta_label"
], "migration premium");

assert(!/fazendinha-home-media-block[\s\S]{0,260}position:\s*absolute/i.test(css), "banner premium nao deve depender de overlay absoluto");
assert(!/writing-mode:\s*vertical/i.test(css), "mobile nao pode ter texto vertical");
assert(pkg.includes('"test:fazendinha-premium-experience"'), "package.json deve expor test:fazendinha-premium-experience");

console.log("fazendinha-premium-experience: ok");

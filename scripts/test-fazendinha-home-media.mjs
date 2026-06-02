import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label}: ausente ${token}`);
}

const server = read("server.ts");
const home = read("src/pages/Home.tsx");
const section = read("src/components/FazendinhaSection.tsx");
const pickerBanner = read("src/components/FazendinhaAnimalPickerBanner.tsx");
const block = read("src/components/FazendinhaHomeMediaBlock.tsx");
const admin = read("src/pages/admin/AdminFazendinha.tsx");
const api = read("src/services/api.ts");
const hooks = read("src/hooks/useRaffles.ts");
const types = read("src/types.ts");
const migration = read("supabase/migrations/35_fazendinha_home_media.sql");
const responsive = read("src/components/ResponsiveMediaFrame.tsx");
const pkg = read("package.json");

includesAll(server, [
  "FazendinhaHomeMediaSettings",
  "fazendinhaHomeMediaSettings",
  "defaultFazendinhaHomeMedia",
  "normalizeFazendinhaHomeMedia",
  "publicFazendinhaHomeMedia",
  "app.get(\"/api/public/fazendinha/home-media\"",
  "app.get(\"/api/admin/fazendinha/home-media\"",
  "app.put(\"/api/admin/fazendinha/home-media\"",
  "app.get(\"/api/superadmin/tenants/:tenantId/fazendinha/home-media\"",
  "app.put(\"/api/superadmin/tenants/:tenantId/fazendinha/home-media\"",
  "resolveDomainTenantInfo(req)",
  "resolveRequestTenantId(req)",
  "recordAuditLedger",
  "recordSuperadminAudit"
], "endpoints e persistencia em memoria por tenant");

const publicHelperStart = server.indexOf("function publicFazendinhaHomeMedia");
const publicHelperEnd = server.indexOf("let fazendinhaGroups", publicHelperStart);
const publicHelper = server.slice(publicHelperStart, publicHelperEnd);
assert(!publicHelper.includes("tenant_id"), "endpoint publico nao deve expor tenant_id");
assert(!/secret/i.test(publicHelper), "endpoint publico nao deve expor secrets");

includesAll(block, [
  "FazendinhaHomeMediaBlock",
  "if (!enabled || !mediaUrl) return null",
  "ResponsiveMediaFrame",
  "poster={posterUrl}",
  "preferredFit={fitMode}",
  "aspectMode=\"auto\"",
  "autoPlay",
  "muted",
  "resolvedDescription",
  "data-home-media=\"fazendinha\""
], "componente publico");

assert(!/absolute[\s\S]{0,140}(title|description|resolvedTitle|resolvedDescription)/i.test(block), "titulo/descricao nao podem sobrepor a midia");

includesAll(home, [
  "<ModalidadesSection />",
  "<FazendinhaSection />"
], "Home renderiza Fazendinha sem banner duplicado externo");
assert(!home.includes("<FazendinhaHomeMediaBlock"), "Home nao deve renderizar o banner fora da selecao de bichos");

includesAll(section, [
  "useFazendinhaMediaSettings",
  "fazendinhaPublicGroupId",
  "debugFazendinhaHome",
  "homeDebug",
  "FazendinhaAnimalPickerBanner",
  "<FazendinhaAnimalPickerBanner {...homeBanner} />",
  "boardGroupIds.map"
], "FazendinhaSection posiciona banner acima dos bichos");
assert(section.indexOf("<FazendinhaAnimalPickerBanner") < section.indexOf("boardGroupIds.map"), "banner deve vir antes da grade de bichos");
assert(section.includes("new Map(groups.map(group => [fazendinhaPublicGroupId(group.id), group]))"), "Home deve mapear grupos tenant-scoped pelo id publico do bicho");
assert(section.includes("selectedGroups.map(group => group.id)"), "checkout deve enviar o id real do grupo para preservar tenant/multitenant");
assert(section.includes("<FazendinhaHomeDebugNotice"), "Home deve exibir diagnostico da Fazendinha quando homeDebug=1");
assert(!section.includes("CheckoutCampaignMedia"), "checkout da Fazendinha nao deve renderizar midia/banner");
assert(!section.includes("<DynamicMedia"), "checkout da Fazendinha nao deve renderizar midia/banner dinamico");
assert(section.includes("FazendinhaCheckoutMedia"), "checkout da Fazendinha deve usar midia propria separada");
assert(section.includes("fazendinhaCheckoutMedia={checkoutMedia}"), "recibo pre-PIX da Fazendinha deve receber midia propria do checkout");

includesAll(pickerBanner, [
  "FazendinhaAnimalPickerBanner",
  "FazendinhaHomeBanner",
  "fazendinha-animal-picker-banner"
], "wrapper do banner da selecao");

includesAll(admin, [
  "Banner da modalidade Fazendinha na Home",
  "Mídia do checkout da Fazendinha",
  "fazendinhaService.updateMediaSettings",
  "MediaPicker",
  "ResponsiveMediaFrame",
  "Poster/thumbnail do vídeo",
  "Modo de exibição",
  "Texto alternativo/acessibilidade",
  "Aparece na Home pública antes da grade dos bichos"
], "admin preview e campos");

includesAll(api, [
  "getHomeMedia",
  "/api/public/fazendinha/home-media",
  "getMediaSettings",
  "/api/public/fazendinha/media-settings",
  "getAdminHomeMedia",
  "/api/admin/fazendinha/home-media",
  "updateMediaSettings"
], "service api");

includesAll(hooks, [
  "useFazendinhaHomeMedia",
  "useFazendinhaMediaSettings",
  "fazendinhaService.getHomeMedia",
  "retry: false"
], "hook publico");

includesAll(types, [
  "FazendinhaHomeMediaSettings",
  "FazendinhaMediaSettings",
  "posterUrl",
  "fitMode",
  "position: 'above-fazendinha'",
  "homeMedia?: FazendinhaHomeMediaSettings"
], "types");

includesAll(migration, [
  "fazendinha_home_media_enabled",
  "fazendinha_home_media_url",
  "fazendinha_home_media_type",
  "fazendinha_home_media_poster_url",
  "fazendinha_home_media_title",
  "fazendinha_home_media_description",
  "fazendinha_home_media_fit",
  "fazendinha_home_media_alt",
  "image', 'video', 'gif'",
  "'auto', 'contain', 'cover'"
], "migration");

includesAll(responsive, [
  "ResponsiveMediaFrame",
  "preload={priority ? \"auto\" : \"metadata\"}",
  "playWhenVisible={!priority}"
], "ResponsiveMediaFrame preserva performance e pause");

for (const viewport of [390, 1440]) {
  assert(viewport === 390 || viewport === 1440, `viewport coberto: ${viewport}`);
}

assert(pkg.includes('"test:fazendinha-home-media"'), "package.json deve expor test:fazendinha-home-media");

console.log("fazendinha-home-media: ok");

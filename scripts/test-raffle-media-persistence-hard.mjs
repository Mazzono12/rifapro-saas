import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function hasAll(source, tokens, label) {
  for (const token of tokens) {
    assert.ok(source.includes(token), `${label}: esperado encontrar "${token}"`);
  }
}

function matchesAll(source, patterns, label) {
  for (const pattern of patterns) {
    assert.match(source, pattern, `${label}: esperado casar ${pattern}`);
  }
}

const server = read("server.ts");
const adminRaffles = read("src/pages/admin/AdminRaffles.tsx");
const mediaPicker = read("src/components/admin/MediaPicker.tsx");
const mediaUtils = read("src/utils/media.ts");
const mediaRenderer = read("src/components/MediaRenderer.tsx");
const responsiveFrame = read("src/components/ResponsiveMediaFrame.tsx");
const standardBlock = read("src/components/StandardRaffleMediaBlock.tsx");
const home = read("src/pages/Home.tsx");
const details = read("src/pages/RaffleDetails.tsx");
const types = read("src/types.ts");
const pkg = read("package.json");

hasAll(server, [
  "function normalizeRaffleMediaPayload",
  "firstMediaUrl(",
  "payload.imageUrl",
  "payload.bannerUrl",
  "payload.coverImageUrl",
  "payload.thumbnailUrl",
  "payload.videoUrl",
  "payload.campaignMedia",
  "current?.image",
  "current?.mediaUrl",
  "current?.checkoutMediaUrl",
  "next.image = image",
  "next.imageUrl = image",
  "next.bannerUrl = image",
  "next.coverImageUrl = image",
  "next.mediaUrl = mediaUrl",
  "next.mediaType = normalizeMediaTypeForUrl",
  "...normalizeRaffleMediaPayload(req.body)",
  "...normalizeRaffleMediaPayload(req.body, raffles[index])",
  "const normalizedRaffle = normalizeRaffleMediaPayload(safeRaffle, raffle)",
  "res.json(activeTenantRaffles.map(sanitizeRaffleForPublic))",
  "res.json(sanitizeRaffleForPublic(raffle))",
  "res.json(scoped(raffles, req).map(sanitizeRaffleForAdmin))"
], "Backend deve persistir midia da rifa, preservar no update e retornar no admin/publico");

hasAll(server, [
  "directVideoPattern",
  "m3u8|mov|mp4|webm",
  "directImagePattern",
  "jpe?g|png|webp",
  "if (directVideoPattern.test(url)) return \"video\"",
  "if (directImagePattern.test(url)) return \"image\""
], "Backend deve reconhecer imagem e video direto");

hasAll(adminRaffles, [
  "function normalizeRaffleMediaDraft",
  "imageUrl",
  "bannerUrl",
  "coverImageUrl",
  "thumbnailUrl",
  "videoUrl",
  "campaignMedia",
  "delete next.mediaUrl",
  "delete next.checkoutMediaUrl",
  "const payload = normalizeRaffleMediaDraft(currentRaffle)",
  "value={currentRaffle.mediaUrl || \"\"}",
  "onChange={(mediaUrl, mediaType) => setCurrentRaffle({ ...currentRaffle, mediaUrl, mediaType })}",
  "value={currentRaffle.checkoutMediaUrl || \"\"}"
], "Admin deve manter contrato unico e nao enviar midia vazia como limpeza acidental");

hasAll(mediaPicker, [
  "URL de mídia da campanha",
  "Imagem ou vídeo direto .mp4/.webm/.mov",
  "Use link direto de vídeo .mp4/.webm ou arquivo enviado.",
  "detectedType === \"youtube\" || detectedType === \"vimeo\"",
  "onChange(url, detectedType)",
  "Imagem por link aplicada",
  "Vídeo por link aplicado",
  "<ResponsiveMediaFrame"
], "Admin deve aceitar URL de imagem/video direto e avisar YouTube/Vimeo");

hasAll(mediaUtils, [
  "const imagePattern",
  "jpe?g|png|webp",
  "const videoPattern",
  "m3u8|mov|mp4|webm",
  "if (videoPattern.test(url)) return \"video\"",
  "if (imagePattern.test(url)) return \"image\""
], "Frontend deve reconhecer video e imagem por extensao");

hasAll(mediaRenderer, [
  "if (mediaType === 'image')",
  "<img",
  "if (mediaType === 'video')",
  "<video",
  "muted={muted}",
  "loop={loop}",
  "playsInline={playsInline}",
  "controls={interactive}",
  "onError={onError}",
  "alt = \"\""
], "Renderer deve usar img/video e nunca alt quebrado");

hasAll(responsiveFrame, [
  "fallbackTitle = \"Mídia indisponível\"",
  "fallbackSubtitle = \"Envie imagem ou vídeo para visualizar o prêmio.\"",
  "onError={onError}",
  "MediaRenderer"
], "Frame deve ter fallback premium limpo");

hasAll(standardBlock, [
  "fallbackImageUrl",
  "setActiveMedia({ url: fallbackUrl, type: \"image\" })",
  "handleMediaError",
  "controls={false}",
  "interactive={false}",
  "cfx-premium-media-placeholder"
], "Bloco padrao deve tentar fallback e ocultar controles no publico");

hasAll(home, [
  "rawRaffle.image || rawRaffle.imageUrl || rawRaffle.bannerUrl || rawRaffle.coverImageUrl || rawRaffle.thumbnailUrl",
  "rawRaffle.mediaUrl || rawRaffle.videoUrl || campaignMediaUrl",
  "const mediaUrl = raffle.mediaUrl || raffle.image",
  "<StandardRaffleMediaBlock",
  "fallbackImageUrl={raffle.image}",
  "showDescriptionBelow={false}",
  "className=\"cfx-home-media-block\""
], "Home deve usar a midia persistida sem overlay");

hasAll(details, [
  "const mediaUrl = raffle?.checkoutMediaUrl || raffle?.mediaUrl || raffle?.image || \"\"",
  "const fallbackImageUrl = typeof raffle.image === \"string\" ? raffle.image.trim() : \"\"",
  "autoPlay muted loop playsInline controls={false}",
  "onError={handleMediaError}",
  "cfx-media-fallback"
], "Detalhe da rifa deve usar midia persistida e fallback limpo");

hasAll(types, [
  "imageUrl?: string",
  "bannerUrl?: string",
  "coverImageUrl?: string",
  "thumbnailUrl?: string",
  "videoUrl?: string",
  "campaignMedia?: string"
], "Tipos devem declarar aliases de midia compativeis");

assert.match(pkg, /"test:raffle-media-persistence-hard"\s*:\s*"node scripts\/test-raffle-media-persistence-hard\.mjs"/, "package.json deve registrar test:raffle-media-persistence-hard");

console.log("PASS: persistencia e exibicao de midia da rifa preservam imagem/video, aliases, fallback e payload publico.");

import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const media = read("src/utils/media.ts");
const renderer = read("src/components/MediaRenderer.tsx");
const messagePlayer = read("src/components/MessageVideoPlayer.tsx");
const mediaPicker = read("src/components/admin/MediaPicker.tsx");
const adminRaffles = read("src/pages/admin/AdminRaffles.tsx");
const adminStories = read("src/pages/admin/AdminStories.tsx");
const adminWinners = read("src/pages/admin/AdminWinners.tsx");
const adminFazendinha = read("src/pages/admin/AdminFazendinha.tsx");
const adminModalidades = read("src/pages/admin/AdminModalidades.tsx");
const adminMessages = read("src/pages/admin/AdminMessages.tsx");
const adminConfig = read("src/pages/admin/AdminConfig.tsx");
const types = read("src/types.ts");

const sample = "https://player.mediadelivery.net/play/670514/b27261d2-ffd9-4e39-aa23-d7c400424177";
const expectedEmbed = "https://iframe.mediadelivery.net/embed/670514/b27261d2-ffd9-4e39-aa23-d7c400424177";
const sampleParts = new URL(sample).pathname.match(/^\/(?:play|embed)\/([^/]+)\/([^/?#]+)/i);

assert(media.includes("player\\.mediadelivery\\.net"), "inferMediaType deve reconhecer player.mediadelivery.net");
assert(media.includes("video\\.bunnycdn\\.com|player\\.mediadelivery\\.net"), "getBunnyEmbedUrl deve normalizar player.mediadelivery.net");
assert(media.includes("iframe.mediadelivery.net/embed"), "getBunnyEmbedUrl deve gerar embed MediaDelivery");
assert(renderer.includes("getBunnyEmbedUrl(mediaUrl"), "MediaRenderer deve renderizar MediaDelivery/Bunny via iframe seguro");
assert(messagePlayer.includes("getBunnyEmbedUrl(mediaUrl"), "MessageVideoPlayer deve renderizar MediaDelivery/Bunny via iframe seguro");
assert(mediaPicker.includes("player.mediadelivery.net/play"), "MediaPicker deve comunicar suporte ao player.mediadelivery.net/play");
assert(types.includes("'bunny'"), "Tipos globais devem manter suporte a bunny/MediaDelivery");

for (const [name, content] of [
  ["AdminRaffles", adminRaffles],
  ["AdminStories", adminStories],
  ["AdminWinners", adminWinners],
  ["AdminFazendinha", adminFazendinha],
  ["AdminModalidades", adminModalidades],
  ["AdminMessages", adminMessages],
  ["AdminConfig", adminConfig]
]) {
  assert(content.includes("MediaPicker"), `${name} deve usar MediaPicker nos campos de video/midia`);
  const hasManualMediaTypeSelect = /<option\s+value="(?:image|video|youtube|vimeo)"/.test(content);
  if (hasManualMediaTypeSelect) {
    assert(content.includes('value="bunny"') || content.includes(">Bunny.net<"), `${name} deve aceitar tipo bunny/MediaDelivery quando ha select manual`);
  }
}

assert(sampleParts?.[1] === "670514", "URL player.mediadelivery.net/play deve expor library id");
assert(sampleParts?.[2] === "b27261d2-ffd9-4e39-aa23-d7c400424177", "URL player.mediadelivery.net/play deve expor video id");
assert(
  media.includes("new URL(`https://iframe.mediadelivery.net/embed/${pathMatch[1]}/${pathMatch[2]}`)"),
  "player.mediadelivery.net/play deve virar iframe.mediadelivery.net/embed"
);
assert(expectedEmbed === `https://iframe.mediadelivery.net/embed/${sampleParts[1]}/${sampleParts[2]}`, "embed esperado deve preservar biblioteca e video");

console.log("[mediadelivery-video-source] ok");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mediaPicker = readFileSync("src/components/admin/MediaPicker.tsx", "utf8");
const adminRaffles = readFileSync("src/pages/admin/AdminRaffles.tsx", "utf8");
const adminStories = readFileSync("src/pages/admin/AdminStories.tsx", "utf8");
const adminWinners = readFileSync("src/pages/admin/AdminWinners.tsx", "utf8");
const adminConfig = readFileSync("src/pages/admin/AdminConfig.tsx", "utf8");
const brandingSettings = readFileSync("src/components/branding/BrandingSettingsForm.tsx", "utf8");
const logoUploader = readFileSync("src/components/branding/LogoUploader.tsx", "utf8");
const pkg = readFileSync("package.json", "utf8");

for (const token of [
  "type MediaUsage = \"hero\" | \"story\" | \"winner\" | \"card\"",
  "mediaUsageProfiles",
  "Banner Hero",
  "1920x1080",
  "16:9",
  "Story",
  "1080x1920",
  "9:16",
  "Ganhador",
  "1080x1080",
  "1:1",
  "detectMediaUsage",
  "detectFileMediaType",
  "allowExternalLink?: boolean",
  "allowExternalLink = true",
  "Tipo detectado",
  "data-media-usage={usage}",
  "Recomendado:"
]) {
  assert(mediaPicker.includes(token), `MediaPicker sem upload inteligente: ${token}`);
}

assert(mediaPicker.includes("file.type.startsWith(\"video/\")"), "Upload deve detectar video pelo MIME.");
assert(mediaPicker.includes("file.type === \"image/gif\""), "Upload deve detectar GIF pelo MIME.");
assert(mediaPicker.includes("inferMediaType(file.name)"), "Upload deve cair para inferencia por extensao.");
assert(mediaPicker.includes("const [mediaAspectPreference, setMediaAspectPreference] = useState<ResponsiveMediaAspectMode>(profile.aspect)"), "Aspecto inicial deve seguir o uso recomendado.");
assert(!mediaPicker.includes("Player externo não suportado neste campo"), "Banners nao devem bloquear YouTube/Vimeo por link.");
assert(!mediaPicker.includes("Use link direto de vídeo .mp4/.webm ou arquivo enviado."), "MediaPicker nao deve orientar bloqueio de YouTube/Vimeo.");
assert(mediaPicker.includes("!allowExternalVideo && isVideoLink"), "Campos de logo devem aceitar link externo, mas bloquear video.");
assert(mediaPicker.includes("Aceita imagem, GIF, vídeo direto .mp4/.webm/.mov, YouTube/Vimeo"), "Ajuda do MediaPicker deve informar suporte completo a midia por link.");

for (const token of [
  "label=\"Imagem da página da campanha\"",
  "mediaUsage=\"card\"",
  "label=\"Mídia principal da Home\"",
  "mediaUsage=\"hero\"",
  "label=\"Mídia principal do Checkout\""
]) {
  assert(adminRaffles.includes(token), `AdminRaffles deve classificar upload: ${token}`);
}

assert(adminStories.includes("mediaUsage=\"story\""), "AdminStories deve recomendar 1080x1920.");
assert(adminWinners.includes("mediaUsage=\"winner\""), "AdminWinners deve recomendar 1080x1080.");
assert(adminConfig.includes("allowExternalVideo={false}"), "Campos de logo no AdminConfig devem bloquear video sem esconder URL de imagem.");
assert(brandingSettings.includes("Logo principal por URL"), "Branding deve permitir logo por link.");
assert(brandingSettings.includes("Favicon por URL"), "Branding deve permitir favicon por link.");
assert(brandingSettings.includes("Enviar logo/GIF"), "Branding deve manter upload da logo pela galeria.");
assert(brandingSettings.includes("Enviar favicon/GIF"), "Branding deve manter upload do favicon pela galeria.");
assert(logoUploader.includes("label = \"Enviar logo/GIF\""), "LogoUploader deve aceitar rotulo por campo.");
assert(pkg.includes("\"test:smart-media-upload\""), "package.json deve expor test:smart-media-upload.");

console.log("smart-media-upload: ok");

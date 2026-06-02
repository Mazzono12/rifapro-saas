import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mediaPicker = readFileSync("src/components/admin/MediaPicker.tsx", "utf8");
const adminRaffles = readFileSync("src/pages/admin/AdminRaffles.tsx", "utf8");
const adminStories = readFileSync("src/pages/admin/AdminStories.tsx", "utf8");
const adminWinners = readFileSync("src/pages/admin/AdminWinners.tsx", "utf8");
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

for (const token of [
  "label=\"Imagem principal / fallback\"",
  "mediaUsage=\"card\"",
  "label=\"Mídia da landing page\"",
  "mediaUsage=\"hero\"",
  "label=\"Mídia exclusiva do checkout\""
]) {
  assert(adminRaffles.includes(token), `AdminRaffles deve classificar upload: ${token}`);
}

assert(adminStories.includes("mediaUsage=\"story\""), "AdminStories deve recomendar 1080x1920.");
assert(adminWinners.includes("mediaUsage=\"winner\""), "AdminWinners deve recomendar 1080x1080.");
assert(pkg.includes("\"test:smart-media-upload\""), "package.json deve expor test:smart-media-upload.");

console.log("smart-media-upload: ok");

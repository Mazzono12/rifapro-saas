import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const home = readFileSync("src/pages/Home.tsx", "utf8");
const standardBlock = readFileSync("src/components/StandardRaffleMediaBlock.tsx", "utf8");
const containers = readFileSync("src/components/layout/PremiumContainers.tsx", "utf8");
const navbar = readFileSync("src/components/Navbar.tsx", "utf8");

assert.ok(home.includes("<PublicPageContainer"), "Home deve usar o container publico compartilhado.");
assert.ok(navbar.includes("app-content-container flex h-16"), "Header publico deve usar app-content-container.");
assert.ok(containers.includes("public-page-container app-content-container"), "Container publico deve compartilhar largura util com header.");

assert.ok(home.includes('className="w-full overflow-x-clip bg-[var(--theme-bg)]"'), "Premio principal deve ficar dentro da largura util, sem w-screen no mobile.");
assert.ok(!home.includes('className="relative left-1/2 w-screen -translate-x-1/2 overflow-x-clip bg-[var(--theme-bg)] px-0 sm:px-4"'), "Premio principal nao pode usar bloco full-bleed desalinhado ao header.");
assert.ok(!home.includes('className="public-page-container px-0"'), "Premio principal nao deve remover padding do container do header.");
assert.ok(!home.includes("home-featured-raffle-block rounded-none border-x-0"), "Premio principal nao deve perder bordas/container no mobile.");

assert.ok(standardBlock.includes("ResponsiveMediaFrame"), "Premio principal deve continuar usando ResponsiveMediaFrame.");
assert.ok(standardBlock.includes("preferredFit={preferredFit}") && standardBlock.includes("aspectMode={aspectMode}"), "Midia principal deve preservar fit/aspect responsivos.");
assert.ok(standardBlock.includes("showDescriptionBelow") && standardBlock.includes("!noOverlay"), "Descricao deve ficar abaixo e overlay deve continuar controlado.");
assert.ok(standardBlock.includes("className=\"h-full max-h-[min(78svh,720px)] w-full rounded-none\""), "Midia deve ocupar 100% da largura do bloco sem distorcer.");

mkdirSync("reports/hard", { recursive: true });
writeFileSync("reports/hard/main-prize-mobile-media-hard.json", JSON.stringify({
  ok: true,
  checked: ["header_width_alignment", "no_full_bleed_mobile", "responsive_media", "description_below", "no_overlay_text"]
}, null, 2));

console.log("✅ main prize mobile media hard passed");

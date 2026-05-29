import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(path, tokens, context) {
  const content = read(path);
  for (const token of tokens) {
    assert(content.includes(token), `${context}: esperado encontrar "${token}" em ${path}`);
  }
  return content;
}

const css = read("src/index.css");
const themes = read("src/themes/index.ts");
const navbar = read("src/components/Navbar.tsx");
const switcher = read("src/components/ThemeSwitcher.tsx");
const themeContext = read("src/context/theme/ThemeContext.tsx");

for (const file of [
  "src/pages/RaffleDetails.tsx",
  "src/pages/NumberModePage.tsx",
  "src/pages/Fazendinha.tsx",
  "src/components/FazendinhaSection.tsx",
  "src/components/checkout/PrePaymentReceiptModal.tsx",
  "src/components/premium/PremiumUI.tsx"
]) {
  includes(file, ["CheckoutPrimaryButton"], `botao checkout padronizado em ${file}`);
}

for (const token of [
  ".checkout-primary-button",
  "word-break: normal",
  "overflow-wrap: normal",
  "writing-mode: horizontal-tb",
  ".checkout-modal-header p",
  ".premium-floating-cta span"
]) {
  assert(css.includes(token), `CSS deve proteger texto horizontal: ${token}`);
}

assert(!/checkout-summary-value[\s\S]{0,140}overflow-wrap:\s*anywhere/.test(css), "valores de checkout nao podem usar overflow-wrap:anywhere");
assert(!/checkout-primary-button[\s\S]{0,220}break-all/.test(css), "botao primario de checkout nao pode usar break-all");
assert(!/checkout-primary-button[\s\S]{0,220}writing-mode:\s*vertical/.test(css), "botao primario de checkout nao pode usar writing-mode vertical");

assert(themes.includes('export type ThemeId = "vimeu_dark"'), "ThemeId publico deve ser unico: vimeu_dark");
assert(themes.includes('defaultThemeId: ThemeId = "vimeu_dark"'), "tema default deve ser vimeu_dark");
assert(themes.includes('id: "vimeu_dark"'), "catalogo deve conter vimeu_dark");
for (const legacy of ["vimeo-original", "vimeo-dark", "apple-glass", "samsung-neon", "social-luxe", "black-white"]) {
  assert(!themes.includes(`id: "${legacy}"`), `tema legado ${legacy} nao deve estar no catalogo publico`);
}

assert(!navbar.includes("ThemeSwitcher"), "Navbar publica nao deve renderizar seletor de tema");
assert(!navbar.includes("Trocar tema"), "Navbar publica nao deve mostrar botao trocar tema");
assert(/return null/.test(switcher), "ThemeSwitcher publico deve estar desativado para compradores");
assert(themeContext.includes("LOCKED_THEME_ID") && themeContext.includes('"vimeu_dark"'), "ThemeProvider deve travar tema vimeu_dark");

includes("supabase/migrations/34_vimeu_dark_single_theme.sql", [
  "theme_mode set default 'vimeu_dark'",
  "theme_mode = 'vimeu_dark'",
  "tenant_branding_settings_theme_mode_check"
], "migration tema unico");

console.log("checkout-visual-regression-hard: ok");

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const themeContext = readFileSync("src/context/admin/AdminThemeContext.tsx", "utf8");
const adminPremium = readFileSync("src/components/admin/AdminPremium.tsx", "utf8");
const publicTheme = readFileSync("src/context/theme/ThemeContext.tsx", "utf8");

assert.ok(themeContext.includes('ADMIN_THEMES = ["dark", "light", "system"] as const'), "Admin deve limitar temas a Escuro, Claro e Sistema.");
for (const theme of ['id: "dark"', 'id: "light"', 'id: "system"', 'name: "Escuro"', 'name: "Claro"', 'name: "Sistema"']) {
  assert.ok(themeContext.includes(theme), `Tema obrigatório ausente: ${theme}`);
}
for (const legacy of ["neon-executive", "titanium-light", "power-dark-bi", "golden-vip", "black-white"]) {
  assert.ok(!themeContext.includes(`id: "${legacy}"`), `Tema legado nao pode aparecer no catalogo admin: ${legacy}`);
}
assert.ok(themeContext.includes("function normalizeAdminThemeId") && themeContext.includes('return "dark"'), "Tema inválido deve cair para Escuro.");
assert.ok(themeContext.includes('raw === "black"') && themeContext.includes('raw === "white"') && themeContext.includes('raw === "neon_blue"'), "Valores antigos devem continuar compatíveis.");
assert.ok(adminPremium.includes("adminThemes.map"), "Switcher deve listar apenas adminThemes filtrados.");
assert.ok(publicTheme.includes("LOCKED_THEME_ID") && publicTheme.includes('"vimeu_dark"'), "Tema público vimeu_dark deve permanecer isolado.");

mkdirSync("reports/hard", { recursive: true });
writeFileSync("reports/hard/admin-theme-limits-hard.json", JSON.stringify({
  ok: true,
  themes: ["Escuro", "Claro", "Sistema"],
  fallback: "Escuro"
}, null, 2));

console.log("✅ admin theme limits hard passed");

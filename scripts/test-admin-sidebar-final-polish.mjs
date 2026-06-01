import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const sidebar = readFileSync("src/components/admin/CollapsibleSidebar.tsx", "utf8");
const admin = readFileSync("src/pages/admin/AdminLayout.tsx", "utf8");
const superadmin = readFileSync("src/pages/superadmin/SuperAdminLayout.tsx", "utf8");

assert.ok(!sidebar.includes("Abrir site"), "Sidebar compartilhada nao deve renderizar Abrir site no rodape.");
assert.ok(!sidebar.includes("Operacional"), "Sidebar compartilhada nao deve renderizar Operacional no rodape.");
assert.ok(!admin.includes("footer={"), "Admin nao deve passar acoes rapidas como footer da sidebar.");
assert.ok(!superadmin.includes("footer={"), "Superadmin nao deve passar acoes rapidas como footer da sidebar.");

assert.ok(admin.includes('aria-label="Abrir site"'), "Header Admin deve manter acao rapida Abrir site.");
assert.ok(superadmin.includes('aria-label="Abrir site"'), "Header Superadmin deve manter acao rapida Abrir site.");
assert.ok(superadmin.includes('aria-label="Operacional"'), "Header Superadmin deve manter acao rapida Operacional.");

assert.ok(sidebar.includes("ChevronLeft") && sidebar.includes("ChevronRight"), "Toggle da sidebar deve usar apenas setas.");
assert.ok(admin.includes("ChevronLeft") && admin.includes("ChevronRight"), "Toggle Admin deve usar setas.");
assert.ok(superadmin.includes("ChevronLeft") && superadmin.includes("ChevronRight"), "Toggle Superadmin deve usar setas.");
assert.ok(!sidebar.includes('!minimized && "Recolher menu"'), "Botao recolher nao deve mostrar texto.");
assert.ok(sidebar.includes('aria-label={minimized ? "Expandir menu" : "Recolher menu"}'), "Toggle deve ter aria-label acessivel.");

for (const source of [sidebar, admin, superadmin]) {
  assert.ok(source.includes("rifapro.") || source.includes("sidebar-tooltip"), "Estado/tooltip da sidebar deve continuar preservado.");
}

mkdirSync("reports/hard", { recursive: true });
writeFileSync("reports/hard/admin-sidebar-final-polish.json", JSON.stringify({
  ok: true,
  checked: ["no_footer_duplicates", "header_quick_actions", "chevron_toggle", "aria_labels", "tooltips"]
}, null, 2));

console.log("✅ admin sidebar final polish passed");

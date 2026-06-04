import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const sidebar = readFileSync("src/components/admin/CollapsibleSidebar.tsx", "utf8");
const adminLayout = readFileSync("src/pages/admin/AdminLayout.tsx", "utf8");
const superLayout = readFileSync("src/pages/superadmin/SuperAdminLayout.tsx", "utf8");

for (const token of [
  "export function CollapsibleSidebar",
  "data-collapsed",
  "sidebar-tooltip",
  "group-hover/sidebar:block",
  "group-focus-visible/sidebar:block",
  "aria-current",
  "aria-label={minimized ? item.name : undefined}",
  "onMobileOpenChange(false)",
  "h-dvh",
  "z-[120]"
]) {
  assert.ok(sidebar.includes(token), `Sidebar retrátil sem requisito: ${token}`);
}

for (const [file, source, key] of [
  ["AdminLayout", adminLayout, "cifher.admin.sidebar"],
  ["SuperAdminLayout", superLayout, "cifher.superadmin.sidebar"]
]) {
  assert.ok(source.includes("CollapsibleSidebar"), `${file} deve usar sidebar compartilhada.`);
  assert.ok(source.includes(key), `${file} deve persistir estado no localStorage.`);
  assert.ok(source.includes("rifapro.") && source.includes("localStorage.getItem"), `${file} deve manter compatibilidade com estado legado.`);
  assert.ok(source.includes("lg:pl-[72px]") && source.includes("lg:pl-[184px]"), `${file} deve expandir/encolher conteúdo.`);
  assert.ok(source.includes("mobileOpen") && source.includes("setMobileOpen"), `${file} deve ter drawer mobile.`);
  assert.ok(source.includes("Escape"), `${file} deve fechar drawer com teclado.`);
}

mkdirSync("reports/hard", { recursive: true });
writeFileSync("reports/hard/collapsible-sidebar-hard.json", JSON.stringify({
  ok: true,
  checked: ["expanded", "collapsed", "tooltip", "localStorage", "mobileDrawer", "contentWidth"]
}, null, 2));

console.log("✅ collapsible sidebar hard passed");

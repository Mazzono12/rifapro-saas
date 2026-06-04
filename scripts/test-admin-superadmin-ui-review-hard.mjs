import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const admin = readFileSync("src/pages/admin/AdminLayout.tsx", "utf8");
const superadmin = readFileSync("src/pages/superadmin/SuperAdminLayout.tsx", "utf8");
const superadminDashboard = readFileSync("src/pages/superadmin/SuperAdminDashboard.tsx", "utf8");
const superadminClients = readFileSync("src/pages/superadmin/SuperAdminClients.tsx", "utf8");
const sidebar = readFileSync("src/components/admin/CollapsibleSidebar.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

for (const token of [
  "Dashboard", "Rifas", "Vendas", "Clientes", "CRM", "Promoções", "A Fazendinha",
  "Integrações", "Pagamentos PIX", "Relatórios", "Auditoria", "Compliance",
  "Antifraude", "Aparência", "Configurações", "Automações"
]) {
  assert.ok(admin.includes(token), `Menu Admin ausente: ${token}`);
}

for (const token of [
  "Gestão Global", "Financeiro executivo", "Auditoria",
  "Integrações", "Domínios", "Antifraude"
]) {
  assert.ok(superadmin.includes(token), `Menu Gestão Global ausente: ${token}`);
}

for (const token of [
  "Gateways globais", "WhatsApp global", "Healthcheck", "Planos", "Acesso assistido"
]) {
  assert.ok(!superadmin.includes(`name: "${token}"`), `Menu Gestão Global duplicado deveria sair: ${token}`);
}

for (const route of [
  'path="/admin"', 'path="rifas"', 'path="vendas"', 'path="crm"', 'path="pagamentos"',
  'path="/superadmin"', 'path="clientes"', 'path="integracoes"', 'path="dominios"', 'path="auditoria"', 'path="relatorios"', 'path="antifraude"'
]) {
  assert.ok(app.includes(route), `Rota preservada ausente: ${route}`);
}

assert.ok(sidebar.includes("overflow-y-auto") && sidebar.includes("custom-scrollbar"), "Sidebar deve rolar sem quebrar menus grandes.");
assert.ok(admin.includes("max-w-[1536px]") && superadmin.includes("max-w-[1536px]"), "Conteúdo deve usar largura premium consistente.");
assert.ok(admin.includes("overflow-x-hidden") && superadmin.includes("overflow-x-hidden"), "Painéis não podem gerar overflow horizontal.");
assert.ok(sidebar.includes("focus-visible:ring-2"), "Foco de teclado precisa ser visível.");
assert.ok(superadmin.includes('path: "/superadmin/clientes"'), "Menu Clientes deve apontar para pagina propria.");
assert.ok(superadminDashboard.includes('to="/superadmin/clientes"') && superadminDashboard.includes("Clientes"), "Gestão Global deve apontar para a página de clientes.");
assert.ok(!superadminDashboard.includes('section id="clientes"'), "Gestão Global nao deve duplicar a lista de clientes.");
assert.ok(superadminClients.includes("Entrar") && superadminClients.includes("Motivo obrigatório"), "Gestão de clientes precisa manter acesso assistido com motivo.");
assert.ok(superadminDashboard.includes('href={`/raffle/${raffle.id}`}'), "Listagem global de rifas precisa manter botão para abrir a rifa pública.");
assert.ok(superadminDashboard.includes('to={`/superadmin/tenants/${raffle.tenant_id}/financeiro`}'), "Listagem global de rifas precisa manter atalho para o cliente da rifa.");

mkdirSync("reports/hard", { recursive: true });
writeFileSync("reports/hard/admin-superadmin-ui-review-hard.json", JSON.stringify({
  ok: true,
  checked: ["admin_menu", "global_management_menu", "routes", "responsive_shell", "accessibility", "client_environment_access", "global_raffle_actions"]
}, null, 2));

console.log("✅ admin superadmin ui review hard passed");

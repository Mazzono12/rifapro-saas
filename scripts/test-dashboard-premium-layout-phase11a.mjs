import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK: ${message}`);
}

const adminLayout = read("src/pages/admin/AdminLayout.tsx");
const superAdminLayout = read("src/pages/superadmin/SuperAdminLayout.tsx");
const sidebar = read("src/components/admin/CollapsibleSidebar.tsx");
const premium = read("src/components/admin/AdminPremium.tsx");
const app = read("src/App.tsx");

assert(adminLayout.includes("AdminThemeProvider"), "AdminLayout usa provider de tema administrativo");
assert(adminLayout.includes("AdminThemeSwitcher"), "AdminLayout expõe alternância claro/escuro");
assert(adminLayout.includes("CollapsibleSidebar"), "AdminLayout usa sidebar premium colapsável");
assert(adminLayout.includes("premium-site-header"), "AdminLayout usa header premium");

assert(superAdminLayout.includes("AdminThemeProvider"), "SuperAdminLayout usa provider de tema administrativo");
assert(superAdminLayout.includes("AdminThemeSwitcher"), "SuperAdminLayout expõe alternância claro/escuro");
assert(superAdminLayout.includes("CollapsibleSidebar"), "SuperAdminLayout usa sidebar premium colapsável");
assert(superAdminLayout.includes("premium-site-header"), "SuperAdminLayout usa header premium");

assert(sidebar.includes('data-premium-sidebar="true"'), "Sidebar possui marcador premium");
assert(!/linear-gradient|bg-blue-|bg-purple-|from-purple|to-purple|from-blue|to-blue/i.test(sidebar), "Sidebar não possui gradiente pesado nem tema azul/roxo isolado");

const requiredAdminIcons = [
  "LayoutDashboard",
  "ShoppingCart",
  "Users",
  "DollarSign",
  "Handshake",
  "Ticket",
  "Hash",
  "Beef",
  "CircleDashed",
  "Gift",
  "TicketPercent",
  "MessageSquare",
  "MessagesSquare",
  "Brain",
  "Megaphone",
  "GalleryVertical",
  "Send",
  "Palette",
  "Plug",
  "Settings"
];

for (const icon of requiredAdminIcons) {
  assert(adminLayout.includes(icon), `Menu Admin usa ícone Lucide ${icon}`);
}

const adminMenuNames = [...adminLayout.matchAll(/name:\s*"([^"]+)"/g)].map(match => match[1]);
const superAdminMenuNames = [...superAdminLayout.matchAll(/name:\s*"([^"]+)"/g)].map(match => match[1]);
const emojiRegex = /[\u{1f300}-\u{1faff}\u{2600}-\u{27bf}]/u;

for (const label of [...adminMenuNames, ...superAdminMenuNames]) {
  assert(!emojiRegex.test(label), `Menu sem emoji: ${label}`);
}

assert(app.includes('path="/"'), "Rota pública home preservada");
assert(app.includes('path="/checkout/pedido/:orderId"'), "Rota pública de checkout preservada");
assert(app.includes("CheckoutOrderResume"), "Fluxo público de recuperação/checkout preservado no roteador");
assert(app.includes('path="/admin"'), "Rota Admin preservada");
assert(app.includes('path="/superadmin"'), "Rota Super Admin preservada");

const adminShellFiles = [adminLayout, superAdminLayout, sidebar, premium].join("\n");
assert(!/checkout|webhook|reserva|reservation/i.test(adminShellFiles), "Arquivos de layout premium não introduzem lógica de checkout, webhook ou reservas");
assert(!/sendWhatsApp|sendMessage|createPix|confirmPix|webhook/i.test(adminShellFiles), "Renderização do layout não dispara mensagens, PIX ou webhooks");

console.log("Phase 11A dashboard premium layout contract passed.");

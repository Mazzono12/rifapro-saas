import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const ok = message => console.log(`OK: ${message}`);
const fail = message => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const assert = (condition, message) => condition ? ok(message) : fail(message);

const rifas = read("src/pages/admin/AdminRifasModule.tsx");
const app = read("src/App.tsx");

for (const tab of ["Geral", "Configuração", "Sorteio", "Mídias", "Prêmios", "Rankings", "Ganhadores", "Encerramento", "Histórico"]) {
  assert(rifas.includes(`label: "${tab}"`), `/admin/rifas possui aba ${tab}`);
}

assert(rifas.includes('role="tablist"'), "/admin/rifas usa abas full-width");
assert(rifas.includes("admin-page-panel"), "/admin/rifas usa painel administrativo limpo");
assert(!/xl:grid-cols-|lg:grid-cols-|md:grid-cols-|grid-cols-\[|grid-cols-1/i.test(rifas), "/admin/rifas não possui layout bipartido ou grids forçados");
assert(!/glass-card|neon|font-display|text-white|text-slate-|bg-black|border-white|gradient|bg-cyber/i.test(rifas), "/admin/rifas não possui visual antigo escuro/neon");
assert(!/ResponsiveMediaFrame|VideoSettingsEditor|player avançado|player avancado/i.test(rifas), "/admin/rifas não possui player avançado");
assert(!/type="color"|primary_color|secondary_color|accent_color|colorFields/i.test(rifas), "/admin/rifas não possui configurações de cor");
assert(!/min-h-\[[^\]]*(320|360|400|480|calc)/i.test(rifas), "/admin/rifas não possui espaços vazios artificiais por altura fixa grande");
assert(!/p-10|p-12|py-12|py-16|mb-12|gap-12/i.test(rifas), "/admin/rifas não possui padding/margem exagerados");

for (const expected of ["/api/admin/raffles", "handleSave", "Nova rifa", "Editar rifa", "delete", "ranking?limit=50", "top-sellers?limit=50", "StandardizedModalityLifecyclePanel", "topBuyerRankingEnabled", "topSellerRankingEnabled", "reservationMinutes", "status"]) {
  assert(rifas.includes(expected), `Lógica de rifa preservada: ${expected}`);
}

assert(/Valor comprado em R\$/i.test(rifas), "Top Comprador usa valor comprado em R$");
assert(/Valor vendido em R\$/i.test(rifas), "Top Vendedor usa valor vendido em R$");
assert(/indicação direta|indicacao direta/i.test(rifas), "Top Vendedor preserva indicação direta");
assert(!rifas.includes("createPix") && !rifas.includes("confirmPix"), "/admin/rifas não cria/confirma PIX");

assert(app.includes('path="/"'), "Home pública preservada no roteador");
assert(app.includes('path="/checkout/pedido/:orderId"'), "Checkout público preservado no roteador");
assert(app.includes("CheckoutOrderResume"), "Fluxo público de checkout preservado");

if (process.exitCode) process.exit(process.exitCode);
console.log("Phase 11A.4 Rifas cleanup contract passed.");

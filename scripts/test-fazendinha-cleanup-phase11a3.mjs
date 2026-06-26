import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const ok = message => console.log(`OK: ${message}`);
const fail = message => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const assert = (condition, message) => condition ? ok(message) : fail(message);

const fazendinha = read("src/pages/admin/AdminFazendinha.tsx");
const app = read("src/App.tsx");

for (const tab of ["Geral", "Configuração", "Sorteio", "Mídias", "Prêmios", "Rankings", "Ganhadores", "Encerramento", "Histórico"]) {
  assert(fazendinha.includes(`label: "${tab}"`), `Fazendinha possui aba ${tab}`);
}

assert(fazendinha.includes('role="tablist"'), "Fazendinha usa abas full-width");
assert(fazendinha.includes("admin-page-panel"), "Fazendinha usa painel administrativo limpo");
assert(!/xl:grid-cols-\[|lg:grid-cols-\[|md:grid-cols-\[|grid-cols-\[1fr_|grid-cols-\[minmax/i.test(fazendinha), "Fazendinha não possui layout bipartido forçado");
assert(!/glass-card|neon-button|font-display|text-white|text-slate-|border-white|bg-white\/\[|bg-black|gradient/i.test(fazendinha), "Fazendinha não possui visual legado escuro/neon");
assert(!/type="color"|colorFields|primary_color|secondary_color|accent_color/i.test(fazendinha), "Fazendinha não possui configurações de cor");
assert(!/VideoSettingsEditor|ResponsiveMediaFrame|advanced|player avançado|player avancado/i.test(fazendinha), "Fazendinha não possui player avançado");
assert(fazendinha.includes("MediaPicker"), "Fazendinha mantém mídia simples");
assert(fazendinha.includes("Configuração dos grupos"), "Fazendinha mantém configuração/lista dos grupos");
assert(fazendinha.includes("Ranking Top Compradores") || fazendinha.includes("topBuyerRankingEnabled"), "Top Comprador continua funcional");
assert(fazendinha.includes("Ranking Top Vendedores") || fazendinha.includes("topSellerRankingEnabled"), "Top Vendedor continua funcional");
assert(/Valor comprado em R\$|valor total pago em reais/i.test(fazendinha) || fazendinha.includes("topBuyers"), "Top Comprador usa valor comprado em R$");
assert(/Valor vendido em R\$|valor vendido em reais/i.test(fazendinha), "Top Vendedor usa valor vendido em R$");
assert(/indicação direta|indicacao direta/i.test(fazendinha) || fazendinha.includes("topSeller"), "Top Vendedor preserva indicação direta");
assert(!fazendinha.includes("createPix"), "Fazendinha Admin não altera PIX");
assert(!fazendinha.includes("webhook"), "Fazendinha Admin não altera webhooks");

assert(app.includes('path="/"'), "Home pública preservada no roteador");
assert(app.includes('path="/checkout/pedido/:orderId"'), "Checkout público preservado no roteador");
assert(app.includes("CheckoutOrderResume"), "Fluxo público de checkout preservado");

if (process.exitCode) process.exit(process.exitCode);
console.log("Phase 11A.3 Fazendinha cleanup contract passed.");

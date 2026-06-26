import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const fail = message => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const ok = message => console.log(`OK: ${message}`);
const assert = (condition, message) => condition ? ok(message) : fail(message);

const adminModalidades = read("src/pages/admin/AdminModalidades.tsx");
const lifecycle = read("src/pages/admin/StandardizedModalityLifecyclePanel.tsx");
const dezena = read("src/pages/admin/AdminDezena.tsx");
const centena = read("src/pages/admin/AdminCentena.tsx");
const milhar = read("src/pages/admin/AdminMilhar.tsx");
const css = read("src/index.css");
const app = read("src/App.tsx");
const combinedNumberMode = [adminModalidades, lifecycle, dezena, centena, milhar].join("\n");

for (const tab of ["Geral", "Configuração", "Mídias", "Prêmios", "Rankings", "Ganhadores", "Encerramento", "Histórico"]) {
  assert(adminModalidades.includes(`label: "${tab}"`), `Aba ${tab} existe nas modalidades numéricas`);
}
assert(adminModalidades.includes('label: "Sorteio"'), "Aba Sorteio existe nas modalidades numéricas");

for (const file of [dezena, centena, milhar]) {
  assert(file.includes('modeFilter="'), "Página numérica aponta para filtro de modalidade própria");
}

assert(!/campanha de afiliado|campanha vinculada|configura[cç][aã]o de campanha de afiliado|formul[aá]rio.*afiliado/i.test(combinedNumberMode), "Dezena/Centena/Milhar não exibem configuração de campanha de afiliado");
assert(!combinedNumberMode.includes("Ranking Top Afiliados"), "Ranking Top Afiliados foi removido das modalidades numéricas");
assert(combinedNumberMode.includes("Ranking Top Vendedores"), "Top Vendedor continua funcional como ranking");
assert(combinedNumberMode.includes("Ranking Top Compradores"), "Top Comprador continua funcional como ranking");
assert(/Valor comprado em R\$|valor total pago em reais/i.test(combinedNumberMode), "Top Comprador usa valor comprado/pago em reais");
assert(/Valor vendido em R\$|valor vendido em reais/i.test(combinedNumberMode), "Top Vendedor usa valor vendido em reais");
assert(/indicacao direta|indicação direta/i.test(combinedNumberMode), "Top Vendedor preserva indicação direta");
assert(/Sem multinivel|Sem multinível/i.test(combinedNumberMode), "Top Vendedor continua sem multinível");
assert(/Nao e sorteio separado|Não é sorteio separado/i.test(combinedNumberMode), "Top Vendedor não é sorteio separado");

assert(!/xl:grid-cols-2|lg:grid-cols-\[|md:grid-cols-\[|grid-cols-\[minmax/i.test(adminModalidades), "AdminModalidades não usa layout bipartido forçado");
assert(!/xl:grid-cols-2|lg:grid-cols-\[|md:grid-cols-\[/i.test(lifecycle), "Painel padronizado não usa layout bipartido forçado");
assert(css.includes("Phase 11A hotfix - admin ice layout"), "CSS global administrativo força branco gelo");
assert(css.includes('[class*="bg-black"]'), "CSS administrativo neutraliza classes bg-black antigas");

assert(app.includes('path="/"'), "Home pública preservada no roteador");
assert(app.includes('path="/checkout/pedido/:orderId"'), "Checkout público preservado no roteador");
assert(app.includes("CheckoutOrderResume"), "Fluxo de checkout/recuperação preservado");
assert(!adminModalidades.includes("createPix") && !lifecycle.includes("createPix"), "Modalidades numéricas não alteram PIX");
assert(!adminModalidades.includes("webhook") && !lifecycle.includes("webhook"), "Modalidades numéricas não alteram webhooks");

if (process.exitCode) process.exit(process.exitCode);
console.log("Phase 11A.2 admin minimal cleanup contract passed.");

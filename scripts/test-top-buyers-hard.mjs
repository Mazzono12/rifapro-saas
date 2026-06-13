import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const adminRaffles = readFileSync("src/pages/admin/AdminRaffles.tsx", "utf8");
const home = readFileSync("src/pages/Home.tsx", "utf8");
const raffleDetails = readFileSync("src/pages/RaffleDetails.tsx", "utf8");
const affiliates = readFileSync("src/pages/Affiliates.tsx", "utf8");

assert.match(server, /\/api\/raffles\/:id\/ranking[\s\S]*status === "paid"/, "Ranking da rifa deve considerar apenas compras pagas.");
assert.match(server, /fazendinhaCompras\.filter\(item => item\.tenant_id === tenantId && item\.statusPagamento === "paid"\)/, "Ranking da Fazendinha deve ignorar reservas nao pagas.");
assert.match(server, /buyerRanking[\s\S]*status === "paid"/, "Top compradores de gamificacao deve usar pedidos pagos.");
assert.match(server, /sort\(\(a, b\) => b\.tickets - a\.tickets/, "Ranking deve ordenar por quantidade.");

assert.match(server, /function normalizeTopSellerRewards[\s\S]*position[\s\S]*label[\s\S]*enabled/, "Premios Top Vendedores devem ser normalizados por posicao.");
assert.match(server, /topSellerRewards: normalizeTopSellerRewards\(req\.body\.topSellerRewards/, "Admin deve persistir premios Top Vendedores por campanha.");
assert.match(server, /function getAffiliatePaidOrders[\s\S]*item\.tenant_id === tenantId[\s\S]*item\.status === "paid"[\s\S]*item\.customer\?\.referredBy === refCode/, "Top Vendedores deve contar somente compras pagas de indicados diretos.");
assert.match(server, /function buildAffiliateSellerRanking[\s\S]*affiliate\.tenant_id === tenantId[\s\S]*affiliateOrderMatchesCampaign\(order, campaign\)/, "Top Vendedores nao deve misturar tenants nem campanhas.");
assert.match(server, /prizeLabel: reward\?\.enabled && reward\.label \? reward\.label : undefined/, "Top Vendedores deve retornar premio configurado apenas para posicoes premiadas.");
assert.match(server, /app\.get\("\/api\/raffles\/:id\/top-sellers"[\s\S]*buildAffiliateSellerRanking\(tenantId, \{ type: "raffle", id: raffle\.id \}/, "Endpoint publico de campanha deve retornar Top Vendedores por rifa.");
assert.match(server, /app\.get\("\/api\/admin\/affiliates\/top-sellers"[\s\S]*buildAffiliateSellerRanking\(tenantId, \{ type: campaignType, id: campaignId \}/, "Endpoint admin deve retornar Top Vendedores por campanha.");

for (const label of ["reward.position", "lugar", "Moto Pop 110", "iPhone", "R$ 1.000 Pix", "Premiação Top Vendedores"]) {
  assert.ok(adminRaffles.includes(label), `Admin da campanha deve configurar ${label}`);
}

assert.ok(home.includes("TopSellers") && home.includes("/top-sellers"), "Home deve carregar e exibir Top Vendedores.");
assert.ok(raffleDetails.includes("RaffleTopSellersPanel") && raffleDetails.includes("/top-sellers"), "Pagina publica da campanha deve exibir Top Vendedores.");
assert.ok(affiliates.includes("topSellerStatus") && affiliates.includes("Faltam") && affiliates.includes("Prêmio da posição"), "Area do afiliado deve mostrar posicao, premio e distancia para Top 3.");

console.log("PASS: Top Compradores e Top Vendedores por campanha consideram somente compras pagas, diretas e tenant-scoped.");

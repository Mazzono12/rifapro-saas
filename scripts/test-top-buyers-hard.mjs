import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");

assert.match(server, /\/api\/raffles\/:id\/ranking[\s\S]*status === "paid"/, "Ranking da rifa deve considerar apenas compras pagas.");
assert.match(server, /fazendinhaCompras\.filter\(item => item\.tenant_id === tenantId && item\.statusPagamento === "paid"\)/, "Ranking da Fazendinha deve ignorar reservas nao pagas.");
assert.match(server, /buyerRanking[\s\S]*status === "paid"/, "Top compradores de gamificacao deve usar pedidos pagos.");
assert.match(server, /sort\(\(a, b\) => b\.tickets - a\.tickets/, "Ranking deve ordenar por quantidade.");

console.log("PASS: Top Compradores considera somente compras pagas.");

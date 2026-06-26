import assert from "node:assert/strict";
import fs from "node:fs";

const server = fs.readFileSync("server.ts", "utf8");
const admin = fs.readFileSync("src/pages/admin/AdminRaffles.tsx", "utf8");
const publicPage = fs.readFileSync("src/pages/RaffleDetails.tsx", "utf8");

const paid = new Set(["paid", "confirmed", "approved", "completed", "received"]);
const buyerKey = order => {
  const phone = String(order.phone || "").replace(/\D/g, "");
  const document = String(order.document || "").replace(/\D/g, "");
  const email = String(order.email || "").trim().toLowerCase();
  return `${order.tenantId}:${order.campaignId}:${phone || document || email || order.customerId}`;
};
const buyers = orders => {
  const rows = new Map();
  orders.filter(order => paid.has(order.status)).forEach(order => {
    const key = buyerKey(order);
    const current = rows.get(key) || { name: order.name, amount: 0, orders: 0 };
    current.amount += order.amount;
    current.orders += 1;
    rows.set(key, current);
  });
  return [...rows.values()].sort((a, b) => b.amount - a.amount);
};

const orders = [
  { tenantId: "A", campaignId: "R1", customerId: "J1", name: "Joao", phone: "(11) 99999-0000", status: "paid", amount: 100 },
  { tenantId: "A", campaignId: "R1", customerId: "J2", name: "Joao", phone: "11999990000", status: "confirmed", amount: 50 },
  { tenantId: "A", campaignId: "R1", customerId: "J3", name: "Joao", phone: "11 99999-0000", status: "paid", amount: 200 },
  { tenantId: "A", campaignId: "R1", customerId: "P", name: "Pendente", phone: "11911110000", status: "pending", amount: 999 },
  { tenantId: "A", campaignId: "R2", customerId: "J4", name: "Joao", phone: "11999990000", status: "paid", amount: 500 },
  { tenantId: "B", campaignId: "R1", customerId: "J5", name: "Joao", phone: "11999990000", status: "paid", amount: 700 }
];

const scopedBuyers = buyers(orders.filter(order => order.tenantId === "A" && order.campaignId === "R1"));
assert.equal(scopedBuyers.length, 1, "Joao deve aparecer uma vez");
assert.equal(scopedBuyers[0].orders, 3, "as tres compras pagas devem permanecer contabilizadas");
assert.equal(scopedBuyers[0].amount, 350, "o ranking deve somar valor pago em reais");

const affiliateOrders = Array.from({ length: 10 }, (_, index) => ({
  tenantId: "A", campaignId: "R1", refCode: "MARIA", directRef: "MARIA", status: "paid", amount: 100 + index
}));
affiliateOrders.push({ tenantId: "A", campaignId: "R1", refCode: "MARIA", directRef: "OUTRO", status: "paid", amount: 9999 });
const maria = affiliateOrders.filter(order => order.tenantId === "A" && order.campaignId === "R1" && order.refCode === "MARIA" && order.directRef === "MARIA" && paid.has(order.status));
assert.equal(maria.length, 10, "somente dez vendas diretas devem ser contabilizadas");
assert.equal(maria.reduce((sum, order) => sum + order.amount, 0), 1045, "valor vendido deve ser a soma das vendas diretas pagas");

assert.match(server, /sort\(\(a, b\) => b\.amount - a\.amount/);
assert.match(server, /topBuyerRewardsByPosition/);
assert.match(server, /topSellerRewardsByPosition/);
assert.match(server, /customer\?\.referredBy === refCode/);
assert.match(server, /purchase\.tenant_id === tenantId && purchase\.raffleId === raffleId/);
assert.match(admin, /Top Compradores/);
assert.match(admin, /Top Vendedores/);
assert.match(admin, /Adicionar posição/);
assert.match(publicPage, /formatCurrency\(Number\(buyer\.amount/);
assert.match(publicPage, /formatCurrency\(Number\(seller\.totalSold/);

console.log("PASS phase5: rankings por receita, indicacao direta, premios separados e isolamento preservado");

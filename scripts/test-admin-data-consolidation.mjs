import assert from "node:assert/strict";

const paid = "paid";
const pending = "pending";

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function phone(value) {
  const normalized = digits(value);
  return normalized.startsWith("55") && normalized.length > 11 ? normalized.slice(2) : normalized;
}

function isPaid(status) {
  return String(status || "").toLowerCase() === "paid";
}

function customerKey(purchase) {
  return `${purchase.tenantId}:${phone(purchase.customer.phone) || digits(purchase.customer.cpf) || String(purchase.customer.email || "").toLowerCase()}`;
}

function affiliateKey(purchase) {
  return `${purchase.tenantId}:${purchase.affiliate.id || purchase.affiliate.refCode}`;
}

function consolidateCustomers(purchases) {
  const map = new Map();
  for (const purchase of purchases) {
    const key = customerKey(purchase);
    const current = map.get(key) || { key, totalOrders: 0, totalSpent: 0, paidOrders: 0 };
    current.totalOrders += 1;
    current.paidOrders += isPaid(purchase.status) ? 1 : 0;
    current.totalSpent += isPaid(purchase.status) ? purchase.amount : 0;
    current.averageTicket = current.paidOrders ? current.totalSpent / current.paidOrders : 0;
    map.set(key, current);
  }
  return [...map.values()];
}

function consolidateAffiliates(purchases) {
  const map = new Map();
  const customerSets = new Map();
  for (const purchase of purchases.filter(item => item.affiliate.refCode || item.affiliate.id)) {
    const key = affiliateKey(purchase);
    const current = map.get(key) || { key, referredOrders: 0, soldAmount: 0, commissionGenerated: 0 };
    current.referredOrders += 1;
    current.soldAmount += isPaid(purchase.status) ? purchase.amount : 0;
    current.commissionGenerated += isPaid(purchase.status) ? purchase.affiliate.commissionGenerated : 0;
    map.set(key, current);
    const set = customerSets.get(key) || new Set();
    set.add(customerKey(purchase));
    customerSets.set(key, set);
  }
  return [...map.values()].map(item => ({ ...item, referredCustomers: customerSets.get(item.key).size }));
}

function salesSummary(purchases, platformRate) {
  const paidRows = purchases.filter(item => isPaid(item.status));
  const grossSales = paidRows.reduce((sum, item) => sum + item.amount, 0);
  return {
    grossSales,
    platformFee: grossSales * platformRate / 100,
    netSales: grossSales - (grossSales * platformRate / 100),
    paidOrders: paidRows.length,
    pendingOrders: purchases.filter(item => item.status === pending).length
  };
}

const joaoPurchases = [
  { tenantId: "tenant-a", amount: 100, status: paid, customer: { phone: "(11) 99999-1111", cpf: "111", email: "joao@test.local" }, affiliate: {} },
  { tenantId: "tenant-a", amount: 50, status: paid, customer: { phone: "11999991111", cpf: "111", email: "joao@test.local" }, affiliate: {} },
  { tenantId: "tenant-a", amount: 200, status: paid, customer: { phone: "+55 11 99999-1111", cpf: "111", email: "joao@test.local" }, affiliate: {} }
];

const consolidatedJoao = consolidateCustomers(joaoPurchases);
assert.equal(joaoPurchases.length, 3, "Pedidos devem continuar com 3 linhas.");
assert.equal(consolidatedJoao.length, 1, "Clientes deve consolidar Joao em 1 linha.");
assert.equal(consolidatedJoao[0].totalOrders, 3);
assert.equal(consolidatedJoao[0].totalSpent, 350);
assert.equal(consolidatedJoao[0].averageTicket, 350 / 3);

const mariaSales = Array.from({ length: 10 }).map((_, index) => ({
  tenantId: "tenant-a",
  amount: 450,
  status: paid,
  customer: { phone: `1198888000${index}`, cpf: "", email: "" },
  affiliate: { id: "affiliate-maria", refCode: "MARIA10", commissionGenerated: 45 }
}));

const consolidatedMaria = consolidateAffiliates(mariaSales);
assert.equal(mariaSales.length, 10, "Pedidos indicados devem continuar com 10 linhas.");
assert.equal(consolidatedMaria.length, 1, "Afiliados deve consolidar Maria em 1 linha.");
assert.equal(consolidatedMaria[0].referredOrders, 10);
assert.equal(consolidatedMaria[0].referredCustomers, 10);
assert.equal(consolidatedMaria[0].soldAmount, 4500);
assert.equal(consolidatedMaria[0].commissionGenerated, 450);

const tenantB = {
  tenantId: "tenant-b",
  amount: 999,
  status: paid,
  customer: { phone: "11999991111", cpf: "111", email: "joao@test.local" },
  affiliate: {}
};
assert.equal(consolidateCustomers([...joaoPurchases, tenantB]).length, 2, "Multitenant deve preservar separacao por tenant.");

const summary = salesSummary([...joaoPurchases, ...mariaSales, { ...tenantB, status: pending }], 10);
assert.equal(summary.grossSales, 4850);
assert.equal(summary.platformFee, 485);
assert.equal(summary.netSales, 4365);
assert.equal(summary.paidOrders, 13);
assert.equal(summary.pendingOrders, 1);

console.log("Admin data consolidation checks passed.");

import fs from "node:fs";
import assert from "node:assert/strict";

const server = fs.readFileSync("server.ts", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");
const adminBilling = fs.readFileSync("src/pages/admin/AdminPlatformBilling.tsx", "utf8");
const superBilling = fs.readFileSync("src/pages/superadmin/SuperAdminPlatformBilling.tsx", "utf8");
const clients = fs.readFileSync("src/pages/superadmin/SuperAdminClients.tsx", "utf8");
const vendas = fs.readFileSync("src/pages/admin/AdminVendas.tsx", "utf8");
const consolidation = fs.readFileSync("src/pages/admin/adminDataConsolidation.ts", "utf8");

function includesAll(source, items, label) {
  for (const item of items) assert.ok(source.includes(item), `${label}: missing ${item}`);
}

includesAll(server, [
  'commercialModel: "platform_fee_percent"',
  'percentual_plataforma: percentualPlataforma',
  'platformCommissionRate: Math.max(0, Math.min(100, rate || 10))',
  'recordPlatformCommissionForPaidOrder',
  'entry.status !== "cancelled"',
  'addOnsAmount: 0',
  'totalDue: Number(revenueShareAmount.toFixed(2))'
], "backend platform fee model");

assert.ok(!server.includes('Recurso bloqueado pelo plano atual'), "admin feature gate by plan must be removed");
assert.ok(!server.includes('API publica bloqueada pelo plano atual'), "public api gate by plan must be removed");
assert.ok(!server.includes('Plano ${plan.nome} permite ate'), "campaign/customer limit by plan must be removed");
assert.ok(!server.includes('planUsage'), "plan usage must not be exposed");
assert.ok(!server.includes('TENANT_PLAN_UPDATED'), "superadmin must not update tenant plans");
assert.ok(!server.includes('app.get("/api/admin/plan"') && !server.includes('app.get("/api/admin/features"'), "admin plan endpoints must be removed");
assert.ok(!server.includes('app.get("/api/superadmin/plans"') && !server.includes('app.put("/api/superadmin/tenants/:tenantId/plan"'), "superadmin plan endpoints must be removed");

assert.ok(!app.includes('meu-plano') && !app.includes('tenants/:tenantId/plano'), "legacy plan routes must be removed");
assert.ok(!app.includes('AdminMyPlan') && !app.includes('SuperAdminTenantPlanResources'), "plan pages must not be mounted");

includesAll(clients, ['Taxa da plataforma (%)', 'percentual_plataforma', 'columns={["Cliente", "Status", "Taxa"'], "superadmin clients fee UI");
assert.ok(!clients.includes('formatPlanName') && !clients.includes('Plano e Recursos') && !clients.includes('setPlans'), "superadmin clients must not expose plans");

includesAll(adminBilling, ['Comissão da Plataforma', 'Venda bruta paga', 'Taxa da plataforma', 'Líquido estimado'], "admin commission UI");
assert.ok(!adminBilling.includes('Add-ons') && !adminBilling.includes('Valor mensal') && !adminBilling.includes('activeAddons'), "admin billing must not show monthly addons");

includesAll(superBilling, ['Comissões da Plataforma', 'Cobrança única por percentual sobre vendas pagas', 'Líquido dos tenants', 'Taxa do tenant'], "superadmin commission UI");
assert.ok(!superBilling.includes('Add-ons mensais') && !superBilling.includes('monthly_price') && !superBilling.includes('saveAddon'), "superadmin billing must not manage monthly addons");

includesAll(vendas, ['Vendas brutas', 'Taxa da plataforma', 'Vendas líquidas'], "admin sales fee metrics");
includesAll(consolidation, ['const paid = purchases.filter(purchase => isPaidStatus(purchase.status))', 'const platformFee = grossSales * (Math.max(0, platformRate) / 100)', 'netSales: grossSales - platformFee'], "paid-only fee summary");
assert.ok(!consolidation.includes('cancelled') || consolidation.includes('isPaidStatus'), "fees must be derived from paid statuses only");

console.log('[remove-plans-subscriptions-phase9] ok');


import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => readFileSync(path.join(root, file), "utf8");

const server = read("server.ts");
const app = read("src/App.tsx");
const adminLayout = read("src/pages/admin/AdminLayout.tsx");
const superLayout = read("src/pages/superadmin/SuperAdminLayout.tsx");
const adminPage = read("src/pages/admin/AdminPlatformBilling.tsx");
const superPage = read("src/pages/superadmin/SuperAdminPlatformBilling.tsx");
const migrationPath = "supabase/migrations/52_platform_billing_hybrid.sql";
const migration = read(migrationPath);
const pkg = JSON.parse(read("package.json"));

function mustInclude(source, value, message) {
  assert.ok(source.includes(value), message || `Esperado encontrar: ${value}`);
}

assert.ok(existsSync(path.join(root, migrationPath)), "Migration 52_platform_billing_hybrid.sql deve existir.");

[
  "platform_commission_entries",
  "platform_addon_subscriptions",
  "platform_addon_charges",
  "platform_billing_statements",
  "platform_commission_entries_order_unique",
  "unique (tenant_id, order_type, order_id)",
  "unique (tenant_id, addon_key, period_start, period_end)",
  "unique (tenant_id, period_start, period_end)",
  "enable row level security",
  "auth.jwt() ->> 'role' = 'superadmin'",
  "order_type in ('rifa', 'fazendinha', 'number_mode')",
  "billing_status in ('active', 'pending', 'overdue', 'cancelled')",
  "status in ('open', 'closed', 'paid', 'overdue')"
].forEach(value => mustInclude(migration, value, `Migration incompleta: ${value}`));

[
  "type PlatformCommissionEntry",
  "type PlatformAddonSubscription",
  "type PlatformAddonCharge",
  "type PlatformBillingStatement",
  "platformCommissionEnabled",
  "platformCommissionRate",
  "platformCommissionMode",
  "recordPlatformCommissionForPaidOrder",
  "reversePlatformCommissionEntry",
  "reversePlatformCommissionForOrder",
  "generatePlatformAddonCharges",
  "generatePlatformBillingStatement",
  "buildPlatformBillingSummary",
  "platformCommissionEntries.find(entry =>",
  "entry.tenant_id === input.tenantId",
  "entry.order_type === input.orderType",
  "entry.order_id === input.orderId",
  "entry.status === \"active\""
].forEach(value => mustInclude(server, value, `Backend billing ausente: ${value}`));

[
  'orderType: "rifa"',
  'orderType: "fazendinha"',
  'orderType: "number_mode"',
  "grossAmount: purchase.amount",
  "grossAmount: purchase.valorPago",
  "purchase.status = \"paid\"",
  "purchase.statusPagamento = \"paid\"",
  "paymentStatus = \"paid\""
].forEach(value => mustInclude(server, value, `Integracao de venda paga ausente: ${value}`));

[
  "reversePlatformCommissionForOrder(tenantId, payment.order_id, normalizedStatus)",
  "\"refunded\"",
  "\"charged_back\"",
  "\"chargeback\""
].forEach(value => mustInclude(server, value, `Reversao/cancelamento de comissao ausente: ${value}`));

[
  'app.get("/api/superadmin/platform-billing/summary"',
  'app.get("/api/superadmin/platform-billing/tenants/:tenantId"',
  'app.put("/api/superadmin/platform-billing/tenants/:tenantId/settings"',
  'app.put("/api/superadmin/platform-billing/tenants/:tenantId/addons"',
  'app.post("/api/superadmin/platform-billing/statements/generate"',
  'app.post("/api/superadmin/platform-billing/statements/:id/mark-paid"',
  'app.post("/api/superadmin/platform-billing/statements/:id/mark-overdue"',
  'app.get("/api/admin/platform-billing/summary"',
  'app.get("/api/admin/platform-billing/entries"',
  'app.get("/api/admin/platform-billing/addons"',
  'app.get("/api/admin/platform-billing/statements"'
].forEach(value => mustInclude(server, value, `Endpoint ausente: ${value}`));

[
  "platform_statement_generated",
  "platform_statement_paid",
  "platform_statement_overdue",
  "platform_addon_activated",
  "platform_addon_deactivated",
  "createNotification"
].forEach(value => mustInclude(server, value, `Notificacao billing ausente: ${value}`));

[
  "/admin/custos-plataforma",
  "/superadmin/platform-billing",
  "AdminPlatformBilling",
  "SuperAdminPlatformBilling"
].forEach(value => {
  mustInclude(app + adminLayout + superLayout, value, `Rota/menu ausente: ${value}`);
});

[
  "Faturamento do período",
  "Percentual da plataforma",
  "Comissão gerada",
  "Valor mensal dos add-ons",
  "Histórico de fechamentos"
].forEach(value => mustInclude(adminPage, value, `Admin tenant nao mostra: ${value}`));

[
  "Billing da Plataforma",
  "Salvar comissão",
  "Gerar fechamento",
  "Marcar pago",
  "Marcar vencido",
  "Add-ons mensais"
].forEach(value => mustInclude(superPage, value, `Superadmin nao mostra: ${value}`));

assert.ok(!server.includes('app.put("/api/admin/platform-billing/tenants/:tenantId/settings"'), "Admin tenant nao pode ajustar percentual.");
assert.ok(!server.includes('app.put("/api/admin/platform-billing/tenants/:tenantId/addons"'), "Admin tenant nao pode alterar add-ons.");

[
  'app.post("/api/raffles/:id/buy"',
  'app.post("/api/modalidades/purchases/:purchaseId/confirm-payment"',
  'app.post("/api/fazendinha/purchases/:purchaseId/confirm-payment"',
  'app.post("/api/webhooks/mercadopago"',
  'app.post("/api/webhooks/pay2m"',
  'app.post("/api/webhooks/pagbank"',
  'app.post("/api/webhooks/cora"',
  'app.post("/api/webhooks/primepag"',
  "creditAffiliateCommission",
  "processWhatsAppCenterInboundWebhook",
  "handlePurchaseConfirmedWhatsAppCloudEvent"
].forEach(value => mustInclude(server, value, `Fluxo protegido ausente/alterado: ${value}`));

[
  "whatsapp_advanced",
  "whatsapp_bulk",
  "multi_attendant",
  "crm_advanced",
  "custom_domain",
  "white_label",
  "affiliates_advanced",
  "priority_support"
].forEach(value => mustInclude(server + migration + superPage, value, `Add-on ausente: ${value}`));

mustInclude(server, "platformCommissionEntries", "Colecao de comissoes deve ser persistida.");
mustInclude(server, "platformAddonSubscriptions", "Colecao de add-ons deve ser persistida.");
mustInclude(server, "platformAddonCharges", "Colecao de cobrancas deve ser persistida.");
mustInclude(server, "platformBillingStatements", "Colecao de statements deve ser persistida.");
mustInclude(server, ".filter(entry => entry.tenant_id === tenantId)", "Tenant deve ver apenas seus lancamentos.");
mustInclude(server, ".filter(item => item.tenant_id === tenantId)", "Tenant deve ver apenas suas colecoes.");

assert.equal(pkg.scripts["test:platform-billing-hybrid-hard"], "node scripts/test-platform-billing-hybrid-hard.mjs");

console.log("Platform billing hybrid hard checks passed.");

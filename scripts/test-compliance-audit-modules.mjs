import { readFileSync } from "node:fs";

const mode = process.argv[2] || "all";
const read = path => readFileSync(path, "utf8");
const server = read("server.ts");
const app = read("src/App.tsx");
const migration = read("supabase/migrations/24_compliance_audit_ticket_ledger.sql");
const adminLayout = read("src/pages/admin/AdminLayout.tsx");
const adminCompliance = read("src/pages/admin/AdminComplianceCenter.tsx");
const drawAudit = read("src/pages/DrawAudit.tsx");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includesAll(source, terms, label) {
  for (const term of terms) assert(source.includes(term), `${label}: ausente ${term}`);
}

function auditLedger() {
  includesAll(migration, ["audit_event_ledger", "before_data jsonb", "after_data jsonb", "previous_hash", "prevent_immutable_compliance_update_delete"], "migration audit ledger");
  includesAll(server, ["recordAuditLedger", "previous_hash", "createHash(\"sha256\")", "requireAuditReason", "/api/admin/audit-ledger", "/api/superadmin/audit-ledger"], "backend audit ledger");
  includesAll(server, ["CUSTOMER_UPDATED", "CUSTOMER_FULL_UPDATED", "TICKET_", "PAYMENT_MANUALLY_CONFIRMED", "PURCHASE_CANCELLED", "WALLET_MANUAL"], "eventos auditados");
}

function customerEditing() {
  includesAll(server, ["/api/admin/customers/:id", "/api/admin/customers/:id/full", "/api/superadmin/customers/:id", "requireAuditReason(req.body.reason)", "adminCanAccessTenant", "before_data", "after_data"], "edicao clientes");
  includesAll(adminCompliance, ["Auditoria imutavel", "Compliance LGPD"], "tela compliance");
}

function ticketAdjustments() {
  includesAll(migration, ["ticket_adjustments", "adjustment_type text", "'add','remove','swap','move'"], "migration ticket adjustments");
  includesAll(server, ["/api/admin/purchases/:purchaseId/tickets/adjust", "CONFIRMAR AJUSTE", "assertTicketsAvailable", "raffleDrawAudits.some", "recordTicketAdjustment", "financial_impact"], "backend ticket adjustments");
}

function financialLedger() {
  includesAll(migration, ["wallet_ledger", "manual_credit", "manual_debit", "ticket_adjustment"], "migration wallet ledger");
  includesAll(server, ["appendWalletLedger", "Ledger financeiro nao permite saldo negativo", "/api/admin/wallet-ledger", "/api/admin/wallet-ledger/manual"], "backend wallet ledger");
}

function provablyFairDraw() {
  includesAll(migration, ["raffle_draw_audit", "server_seed_hash", "eligible_numbers_hash", "result_hash"], "migration draw audit");
  includesAll(server, ["createRaffleDrawAudit", "server_seed_revealed", "rifapro-provably-fair-v1", "/api/public/raffles/:raffleId/draw-audit"], "backend draw audit");
  includesAll(app, ["/sorteio/:raffleId/auditoria", "DrawAudit"], "rota publica draw audit");
  includesAll(drawAudit, ["Seed publica", "Hash cotas elegiveis", "Hash final do resultado", "Base de verificacao"], "pagina draw audit");
}

function complianceLgpd() {
  includesAll(migration, ["customer_consents", "data_privacy_requests", "export", "anonymize", "logical_delete"], "migration LGPD");
  includesAll(server, ["/api/admin/compliance", "/api/admin/compliance/customers/:customerId/export", "/api/admin/compliance/customers/:customerId/anonymize", "/api/public/consents"], "backend LGPD");
}

function antifraudBasic() {
  includesAll(migration, ["fraud_signals", "signal_type", "severity", "metadata"], "migration antifraude");
  includesAll(server, ["/api/admin/antifraud", "/api/admin/antifraud/scan", "many_actions_same_ip", "telefone_repetido"], "backend antifraude");
  includesAll(adminLayout, ["/admin/antifraude", "/admin/compliance", "/admin/auditoria", "/admin/gerenciar-cotas"], "navegacao admin");
}

const runners = {
  "audit-ledger": auditLedger,
  "customer-editing-hard": customerEditing,
  "ticket-adjustments-hard": ticketAdjustments,
  "financial-ledger-hard": financialLedger,
  "provably-fair-draw": provablyFairDraw,
  "compliance-lgpd": complianceLgpd,
  "antifraud-basic": antifraudBasic,
  all() {
    auditLedger();
    customerEditing();
    ticketAdjustments();
    financialLedger();
    provablyFairDraw();
    complianceLgpd();
    antifraudBasic();
  }
};

(runners[mode] || runners.all)();
console.log(`[${mode}] compliance/auditoria ok`);

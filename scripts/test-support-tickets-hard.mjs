import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => readFileSync(path.join(root, file), "utf8");

const server = read("server.ts");
const app = read("src/App.tsx");
const adminLayout = read("src/pages/admin/AdminLayout.tsx");
const superLayout = read("src/pages/superadmin/SuperAdminLayout.tsx");
const adminTickets = read("src/pages/admin/AdminTickets.tsx");
const superTickets = read("src/pages/superadmin/SuperAdminTickets.tsx");
const crm = read("src/pages/admin/AdminCRM.tsx");
const whatsapp = read("src/pages/admin/AdminWhatsAppCenter.tsx");
const migrationPath = "supabase/migrations/55_support_tickets.sql";
const migration = read(migrationPath);
const pkg = JSON.parse(read("package.json"));

function mustInclude(source, value, message) {
  assert.ok(source.includes(value), message || `Esperado encontrar: ${value}`);
}

assert.ok(existsSync(path.join(root, migrationPath)), "Migration 55_support_tickets.sql deve existir.");

[
  "create table if not exists public.support_tickets",
  "create table if not exists public.support_ticket_messages",
  "ticket_number text not null",
  "source text not null default 'manual' check (source in ('whatsapp', 'crm', 'manual', 'email_future'))",
  "status text not null default 'open' check (status in ('open', 'pending', 'in_progress', 'waiting_customer', 'resolved', 'closed'))",
  "priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent'))",
  "category text not null default 'other' check (category in ('financial', 'technical', 'sales', 'affiliate', 'other'))",
  "sla_due_at timestamptz not null",
  "idx_support_tickets_tenant_id",
  "idx_support_tickets_status",
  "idx_support_tickets_priority",
  "idx_support_tickets_assigned_user_id",
  "idx_support_tickets_sla_due_at",
  "alter table public.support_tickets enable row level security",
  "alter table public.support_ticket_messages enable row level security",
  "where st.id = support_ticket_messages.ticket_id",
  "and st.tenant_id = support_ticket_messages.tenant_id",
  "auth.jwt() ->> 'role' = 'superadmin'"
].forEach(value => mustInclude(migration, value, `Migration tickets/SLA incompleta: ${value}`));

[
  "type SupportTicketRecord",
  "type SupportTicketMessageRecord",
  "let enterpriseSupportTickets",
  "let supportTicketMessages",
  "supportTicketSlaSettings",
  "getSupportTicketSlaSettings",
  "supportTicketSlaHours",
  "low: 48",
  "medium: 24",
  "high: 8",
  "urgent: 2",
  "calculateSupportTicketSlaDueAt",
  "while (enterpriseSupportTickets.some(ticket => ticket.tenant_id === tenantId && ticket.ticket_number === ticketNumber))",
  "createSupportTicketRecord",
  "notifySupportTicketEvent",
  "ticket_created",
  "ticket_assigned",
  "ticket_overdue",
  "ticket_resolved",
  "ticket_closed",
  "buildSupportTicketsDashboard",
  "averageFirstResponseMinutes",
  "averageResolutionMinutes",
  "supportTickets: enterpriseSupportTickets"
].forEach(value => mustInclude(server, value, `Backend Tickets/SLA incompleto: ${value}`));

[
  'app.get("/api/admin/tickets"',
  'app.post("/api/admin/tickets"',
  'app.get("/api/admin/tickets/:id"',
  'app.put("/api/admin/tickets/:id"',
  'app.post("/api/admin/tickets/:id/messages"',
  'app.post("/api/admin/tickets/:id/assign"',
  'app.post("/api/admin/tickets/:id/resolve"',
  'app.post("/api/admin/tickets/:id/close"',
  'app.get("/api/admin/tickets/dashboard"',
  'app.post("/api/admin/tickets/from-whatsapp"',
  'app.get("/api/superadmin/tickets"',
  'app.get("/api/superadmin/tickets/dashboard"'
].forEach(value => mustInclude(server, value, `Endpoint Tickets ausente: ${value}`));

[
  "AdminTickets",
  "/admin/tickets",
  "Tickets e SLA Enterprise",
  "Central de chamados",
  "Kanban",
  "draggable",
  "onDrop",
  "Resolver",
  "Fechar",
  "Atrasados",
  "Desempenho por agente"
].forEach(value => mustInclude(adminTickets + app + adminLayout, value, `Tela Admin Tickets incompleta: ${value}`));

[
  "SuperAdminTickets",
  "/superadmin/tickets",
  "SLA global por tenant",
  "Desempenho por tenant",
  "Desempenho por agente",
  "/api/superadmin/tickets/dashboard"
].forEach(value => mustInclude(superTickets + app + superLayout, value, `Tela SuperAdmin Tickets incompleta: ${value}`));

[
  "Converter em Ticket",
  "/api/admin/tickets/from-whatsapp",
  "conversationId",
  "Historico da conversa WhatsApp vinculado ao ticket"
].forEach(value => mustInclude(whatsapp + server, ` ${value}`.trim(), `Integração WhatsApp Tickets ausente: ${value}`));

[
  "history?.supportTickets",
  "Tickets abertos",
  "Pendentes",
  "Resolvidos",
  'title="Tickets"',
  "supportTickets: enterpriseSupportTickets"
].forEach(value => mustInclude(crm + server, value, `Integração CRM Tickets ausente: ${value}`));

[
  'app.post("/api/raffles/:id/buy"',
  "recordPlatformCommissionForPaidOrder",
  "creditAffiliateCommission",
  "whatsapp_crm_campaign",
  "whatsapp_crm_automation",
  "getTenantPlatformBillingSettings",
  "createPixPayment",
  "payment_gateway"
].forEach(value => mustInclude(server, value, `Fluxo protegido deve permanecer presente: ${value}`));

assert.equal(pkg.scripts["test:support-tickets-hard"], "node scripts/test-support-tickets-hard.mjs");

console.log("support-tickets-hard: ok");

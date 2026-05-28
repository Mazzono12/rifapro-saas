import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const crm = readFileSync("src/pages/admin/AdminCRM.tsx", "utf8");
const layout = readFileSync("src/pages/admin/AdminLayout.tsx", "utf8");
const migration = readFileSync("supabase/migrations/26_tenant_native_crm.sql", "utf8");

function includesAll(source, terms, label) {
  for (const term of terms) assert(source.includes(term), `${label}: ausente ${term}`);
}

includesAll(server, ["CrmContactRecord", "crmContacts", "crmContactOverrides", "buildCrmContactFromCustomer", "updateCrmAutomationForCustomer"], "modelo CRM");
includesAll(server, ["/api/admin/crm", "/api/admin/crm/contacts", "/api/admin/crm/contacts/:id", "/api/admin/crm/pipeline", "/api/admin/crm/segments", "/api/admin/crm/export.csv", "/api/superadmin/crm"], "endpoints CRM");
includesAll(server, ["maskCpfForCrm", "maskPhone", "adminCanAccessTenant", "scoped(crmContacts", "recordAuditLedger"], "seguranca CRM");
includesAll(server, ["getCustomerPaidActivity", "total_spent", "total_orders", "last_purchase_at", "vip", "inativo", "afiliado"], "automacoes CRM");
includesAll(server, ["whatsappMessageQueue", "walletLedger", "auditEventLedger", "ensureAffiliateForCustomer"], "historico CRM");
includesAll(server, ["{ pattern: /^\\/crm/, feature: \"crm\" }", "crmContacts,", "crmContactOverrides,"], "feature flag e persistencia CRM");

includesAll(app, ["path=\"crm\"", "path=\"crm/:contactId\"", "path=\"crm/pipeline\"", "path=\"crm/segmentos\"", "AdminCRM"], "rotas CRM");
includesAll(layout, ["CRM", "/admin/crm"], "menu CRM");
includesAll(crm, ["Pipeline", "Segmentos", "Novo lead", "Notas internas", "CSV", "saveContact", "createLead"], "UI CRM");

includesAll(migration, ["crm_contacts", "crm_contact_notes", "tenant_id uuid not null", "enable row level security", "public.can_access_tenant", "status in ('lead','comprador','vip','inativo','bloqueado')"], "migration CRM");

console.log("[native-crm] ok");

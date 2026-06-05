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
includesAll(server, ["/api/admin/crm", "/api/admin/crm/customers", "/api/admin/crm/contacts", "/api/admin/crm/contacts/:id", "/api/admin/crm/pipeline", "/api/admin/crm/segments", "/api/admin/crm/export.csv", "/api/superadmin/crm"], "endpoints CRM");
includesAll(server, ["maskCpfForCrm", "maskPhone", "adminCanAccessTenant", "scoped(crmContacts", "recordAuditLedger"], "seguranca CRM");
includesAll(server, ["requestHasAdminSession(req)", "buildCrmBuyerCustomers", "buildCrmBuyerSegmentCounts", "filterCrmBuyerCustomers", "sortCrmBuyerCustomers", "statusComercial", "mensagemPronta"], "CRM compradores seguro");
includesAll(server, ["compraramHoje", "ultimos7Dias", "clientesVip", "compradoresRecorrentes", "pixPendente", "pixVencido", "compraramRifa", "compraramFazendinha", "compraramModalidades", "inativos30Dias"], "segmentos comerciais CRM");
includesAll(server, ["MAX_CRM_CUSTOMERS_LIMIT", "DEFAULT_CRM_CUSTOMERS_LIMIT", "page", "limit", "search", "segment", "sortBy", "sortDir", "pagination", "segmentCounts", "hasNextPage", "hasPreviousPage"], "CRM compradores paginado");
includesAll(server, ["today", "last_7_days", "vip", "recurring", "pix_pending", "pix_expired", "raffle", "fazendinha", "number_mode", "inactive_30_days"], "segmentos backend CRM compradores");
includesAll(server, ["lastPurchaseAt", "totalPurchased", "purchaseCount", "name"], "ordenacao backend CRM compradores");
includesAll(server, ["PIX ainda está pendente", "Temos novas campanhas disponíveis", "clientes especiais", "Obrigado por participar novamente"], "mensagens prontas CRM");
const crmCustomersRoute = server.slice(server.indexOf('app.get("/api/admin/crm/customers"'), server.indexOf('app.get("/api/admin/crm/contacts"'));
const crmCustomersHelper = server.slice(server.indexOf("function buildCrmBuyerCustomers"), server.indexOf("function buildCrmBuyerSegments"));
includesAll(crmCustomersRoute + crmCustomersHelper, ["requestHasAdminSession(req)", "adminCanAccessTenant", "nome", "whatsapp", "totalComprado", "quantidadeCompras", "ultimaCompra", "campanhaMaisRecente", "statusComercial", "slice(offset, offset + limit)"], "payload comercial enxuto");
for (const forbidden of ["pixPayload", "pixQrCodeBase64", "raw_response", "accessPassword", "cpf_mascarado", "gatewayCustomerIds"]) {
  assert(!crmCustomersRoute.includes(forbidden), `CRM compradores nao deve expor ${forbidden}`);
}
includesAll(server, ["getCustomerPaidActivity", "total_spent", "total_orders", "last_purchase_at", "vip", "inativo", "afiliado"], "automacoes CRM");
includesAll(server, ["whatsappMessageQueue", "walletLedger", "auditEventLedger", "ensureAffiliateForCustomer"], "historico CRM");
includesAll(server, ["{ pattern: /^\\/crm/, feature: \"crm\" }", "crmContacts,", "crmContactOverrides,"], "feature flag e persistencia CRM");

includesAll(app, ["path=\"crm\"", "path=\"crm/:contactId\"", "path=\"crm/pipeline\"", "path=\"crm/segmentos\"", "AdminCRM"], "rotas CRM");
includesAll(layout, ["CRM", "/admin/crm"], "menu CRM");
includesAll(crm, ["CRM de Compradores", "Compraram hoje", "Compraram nos últimos 7 dias", "Clientes VIP", "Compradores recorrentes", "PIX pendente", "PIX vencido", "Compraram Rifa", "Compraram Fazendinha", "Compraram Modalidades", "Inativos há 30 dias"], "UI segmentos compradores");
includesAll(crm, ["Copiar WhatsApp", "Copiar mensagem", "Nenhuma mensagem é enviada automaticamente", "mensagemPronta", "/api/admin/crm/customers"], "UI CRM somente copia");
includesAll(crm, ["buyerPage", "buyerLimit", "buyerSortBy", "buyerSortDir", "URLSearchParams", "[10, 25, 50, 100]", "por página", "Ordenar por última compra", "Ordenar por total comprado", "Ordenar por quantidade de compras", "Ordenar por nome", "Anterior", "Próxima", "Carregando compradores"], "UI CRM compradores paginada");
includesAll(crm, ["Etapas comerciais", "Segmentos", "Novo contato", "Notas internas", "CSV", "saveContact", "createLead"], "UI CRM");
for (const forbiddenUi of ["Novo lead", "Salvar lead", "Pipeline", "\"Score\"", "Todas tags"]) {
  assert(!crm.includes(forbiddenUi), `UI CRM nao deve exibir termo tecnico: ${forbiddenUi}`);
}

includesAll(migration, ["crm_contacts", "crm_contact_notes", "tenant_id uuid not null", "enable row level security", "public.can_access_tenant", "status in ('lead','comprador','vip','inativo','bloqueado')"], "migration CRM");

console.log("[native-crm] ok");

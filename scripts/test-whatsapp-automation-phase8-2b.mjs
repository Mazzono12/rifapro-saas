import fs from "node:fs";
import assert from "node:assert/strict";

const server = fs.readFileSync("server.ts", "utf8");
const page = fs.readFileSync("src/pages/admin/AdminWhatsApp.tsx", "utf8");

function includesAll(source, items, label) {
  for (const item of items) assert.ok(source.includes(item), `${label}: missing ${item}`);
}

includesAll(server, [
  'app.post("/api/admin/raffles/:id/whatsapp/ending"',
  'app.post("/api/admin/raffles/:id/whatsapp/affiliate-invite"',
  'app.post("/api/admin/whatsapp/failed-payment-retry"',
  'app.post("/api/admin/whatsapp/pix-expired"',
  'automation: "raffle_ending"',
  'automation: "affiliate_invite"',
  'automation: "failed_payment_retry"',
  'automation: "pix_expired"'
], "phase 8.2b endpoints and automation types");

includesAll(server, [
  'adminCanAccessTenant(req, item.tenant_id)',
  'resolveRequestTenantId(req)',
  'requestHasAdminSession(req, tenantId)',
  'purchase.tenant_id === tenantId',
  'purchase.tenant_id === raffle.tenant_id',
  'affiliate.tenant_id === tenantId',
  'customer.tenant_id === tenantId'
], "tenant isolation");

includesAll(server, [
  'customerHasWhatsAppOptOut(tenantId, phone)',
  'isValidBrazilianWhatsAppPhone(phone)',
  'if (purchase.status === "paid" || purchase.status === "cancelled") return false;',
  'raffle.status === "active"',
  'isPastReservationExpiry(purchase.pixExpiresAt || purchase.reservedUntil)',
  'buildPublicCheckoutOrderResumeUrl(input.tenantId, purchase.purchaseId)'
], "eligibility rules");

includesAll(server, [
  'whatsapp-raffle-automation:${input.tenantId}:${input.raffle.id}:${input.automation}:${recipient.phone}',
  'whatsapp-order-automation:${input.tenantId}:${purchase.purchaseId}:${input.automation}:${phone}',
  'whatsappMessageQueue.some(message => message.idempotency_key === idempotencyKey)',
  'recordWhatsAppCloudLog(input.tenantId',
  'message_type: "whatsapp_raffle_automation"',
  'message_type: "whatsapp_order_recovery_automation"'
], "idempotency and logs");

includesAll(server, [
  'Rifa encerrando exige campanha ativa',
  'Seu pagamento da campanha',
  'nao foi concluido',
  'Seu PIX da campanha',
  'expirou, mas voce ainda pode tentar novamente aqui'
], "safe message content");
assert.ok(!server.includes('suas cotas continuam garantidas') && !server.includes('reserva garantida'), "pix expired message must not promise reserved tickets");
assert.ok(!server.includes('scheduleAutomation("raffle_ending"') && !server.includes('scheduleAutomation("affiliate_invite"') && !server.includes('scheduleAutomation("failed_payment_retry"'), "phase 8.2b must not add automatic triggers");

includesAll(page, [
  'Rifa encerrando',
  'Convite de afiliado',
  'Retry de pagamento falho',
  'PIX expirado',
  'status: "implemented"',
  '/api/admin/raffles/:id/whatsapp/ending',
  '/api/admin/raffles/:id/whatsapp/affiliate-invite',
  '/api/admin/whatsapp/failed-payment-retry',
  '/api/admin/whatsapp/pix-expired',
  'Enviar aviso de rifa encerrando',
  'Enviar convite de afiliado',
  'Enviar retry de pagamento falho',
  'Enviar recuperacao de PIX expirado',
  'triggerTenantAutomation',
  'window.confirm'
], "admin whatsapp UI");

const forbiddenRenderCalls = [
  'useEffect(() => { void triggerRaffleAutomation',
  'useEffect(() => { void triggerTenantAutomation',
  'fetch(`/api/admin/whatsapp/${kind}`);',
  'fetch(`/api/admin/raffles/${selectedRaffleId}/whatsapp/${kind}`);'
];
for (const item of forbiddenRenderCalls) assert.ok(!page.includes(item), `must not dispatch phase 8.2b automation on render: ${item}`);

assert.ok(!page.includes("AdminCRM") && !page.includes("AdminTickets") && !page.includes("AdminSendPulse"), "WhatsApp central must remain isolated from CRM/Tickets/SendPulse");
console.log("[whatsapp-automation-phase8-2b] ok");

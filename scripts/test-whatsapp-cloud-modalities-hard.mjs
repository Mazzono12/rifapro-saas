import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

function includesAll(source, terms, label) {
  for (const term of terms) assert(source.includes(term), `${label}: ausente ${term}`);
}

function blockBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `bloco ausente: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `fim do bloco ausente: ${end}`);
  return source.slice(startIndex, endIndex);
}

const orderModelBlock = blockBetween(server, "type WhatsAppOrderType", "type AutomationTriggerType");
const buildersBlock = blockBetween(server, "function buildTenantPublicPath", "function whatsappPixRecoveryEventForPurchase");
const pixCoreBlock = blockBetween(server, "function buildWhatsAppPixRecoveryCandidateFromOrder", "function defaultWhatsAppPurchaseConfirmationSettings");
const purchaseConfirmationCoreBlock = blockBetween(server, "function defaultWhatsAppPurchaseConfirmationSettings", "function decryptWhatsAppCloudConfig");
const confirmFazendinhaBlock = blockBetween(server, "function confirmFazendinhaPurchase", "function confirmNumberModePurchase");
const confirmNumberModeBlock = blockBetween(server, "function confirmNumberModePurchase", "app.post(\"/api/fazendinha/buy\"");
const confirmPurchaseBlock = blockBetween(server, "function confirmPurchase(purchase: PurchaseRecord)", "function creditAffiliateCommission");
const pixRecoveryEndpointsBlock = blockBetween(server, 'app.get("/api/admin/whatsapp-cloud/pix-recovery/settings"', 'app.get("/api/admin/whatsapp-cloud/purchase-confirmation/settings"');

includesAll(orderModelBlock, [
  "type WhatsAppOrderType = \"raffle\" | \"fazendinha\" | \"number_mode\"",
  "type WhatsAppOrderSource = PurchaseRecord | FazendinhaPurchase | NumberModePurchase",
  "type WhatsAppOrderCandidate",
  "tenantId: string",
  "orderId: string",
  "orderType: WhatsAppOrderType",
  "customerName: string",
  "customerPhone: string",
  "campaignName: string",
  "quantity: number",
  "numbersLabel: string",
  "amount: number",
  "status: string",
  "paymentStatus: string",
  "createdAt: string",
  "paidAt?: string | null",
  "expiresAt?: string",
  "publicLink: string",
  "rawRef: WhatsAppOrderSource"
], "modelo comum WhatsAppOrderCandidate");

includesAll(buildersBlock, [
  "buildWhatsAppOrderCandidateFromPurchase",
  "orderType: \"raffle\"",
  "buildWhatsAppOrderCandidateFromFazendinhaPurchase",
  "orderType: \"fazendinha\"",
  "animalNames.length ? animalNames.join(\", \") : purchase.numeros.join(\", \")",
  "buildWhatsAppOrderCandidateFromNumberModePurchase",
  "orderType: \"number_mode\"",
  "numbersLabel: purchase.numbers.join(\", \")",
  "findWhatsAppOrderSource",
  "fazendinhaCompras.find(item => item.tenant_id === tenantId && item.id === orderId)",
  "numberModePurchases.find(item => item.tenant_id === tenantId && item.id === orderId)",
  "listWhatsAppOrderSourcesForPixRecovery",
  "...fazendinhaCompras.filter(purchase => purchase.tenant_id === tenantId && purchase.statusPagamento === \"reserved\")",
  "...numberModePurchases.filter(purchase => purchase.tenant_id === tenantId && purchase.status === \"reserved\")"
], "builders e fontes de Fazendinha/Modalidades");

includesAll(confirmFazendinhaBlock, [
  "purchase.statusPagamento = \"paid\"",
  "purchase.paymentStatus = \"paid\"",
  "groups.forEach(group =>",
  "group.status = \"sold\"",
  "handlePurchaseConfirmedWhatsAppCloudEvent(purchase, \"confirmFazendinhaPurchase\")"
], "confirmacao Fazendinha conecta Cloud apos baixa real");

includesAll(confirmNumberModeBlock, [
  "purchase.status = \"paid\"",
  "purchase.paymentStatus = \"paid\"",
  "bets.forEach(bet =>",
  "bet.status = \"paid\"",
  "handlePurchaseConfirmedWhatsAppCloudEvent(purchase, \"confirmNumberModePurchase\")"
], "confirmacao Number Mode conecta Cloud apos baixa real");

assert.ok(confirmPurchaseBlock.includes("handlePurchaseConfirmedWhatsAppCloudEvent(purchase, \"confirmPurchase\")"), "Rifa tradicional deve continuar enfileirando purchase_confirmed.");
assert.ok(!confirmPurchaseBlock.includes("confirmPurchase:already_paid"), "Chamadas repetidas/linkedPurchases ja pagos nao devem reenfileirar purchase_confirmed.");

includesAll(purchaseConfirmationCoreBlock, [
  "buildWhatsAppPurchaseConfirmationCandidateFromOrder",
  "validateWhatsAppPurchaseConfirmationCandidateFromOrder",
  "enqueueWhatsAppPurchaseConfirmationMessageFromOrder",
  "processWhatsappPurchaseConfirmationQueue",
  "findWhatsAppOrderSource(tenantId, String(message.order_id || \"\"), orderType)",
  "orderCandidate.status !== \"paid\" && orderCandidate.paymentStatus !== \"paid\"",
  "orderCandidate.status === \"cancelled\" || orderCandidate.paymentStatus === \"cancelled\"",
  "orderCandidate.orderType === \"raffle\" && purchaseHasRefundOrChargeback",
  "whatsapp-cloud-purchase-confirmation:${tenantId}:${orderCandidate.orderType}:${orderCandidate.orderId}:purchase_confirmed",
  "payload: {",
  "orderType: orderCandidate.orderType",
  "event_type: validation.candidate.eventType",
  "metadata: { orderId: orderCandidate.orderId, purchaseId: orderCandidate.orderId, orderType: orderCandidate.orderType, campaignName: orderCandidate.campaignName, eventType: message.event_type, status: message.status",
  "components: buildWhatsAppPurchaseConfirmationComponents"
], "purchase_confirmed Cloud generalizado, idempotente e logado");

includesAll(pixCoreBlock + pixRecoveryEndpointsBlock, [
  "buildWhatsAppPixRecoveryCandidateFromOrder",
  "validateWhatsAppPixRecoveryCandidateFromOrder",
  "enqueueWhatsAppPixRecoveryMessageFromOrder",
  "findWhatsAppOrderSource(tenantId, purchaseId, orderType)",
  "orderType: orderCandidate.orderType",
  "event_type: validation.candidate.eventType",
  "whatsapp-cloud-pix-recovery:${tenantId}:${orderCandidate.orderType}:${orderCandidate.orderId}:${eventType}",
  "payload: {",
  "orderType: orderCandidate.orderType",
  "pix_pending_reminder",
  "pix_expired_reminder",
  "metadata: { orderId: orderCandidate.orderId, purchaseId: orderCandidate.orderId, orderType: orderCandidate.orderType, campaignName: orderCandidate.campaignName, eventType: message.event_type, status: message.status"
], "PIX recovery entende orderId/orderType para todos os pedidos");

includesAll(purchaseConfirmationCoreBlock, [
  "{ type: \"text\", text: input.customerName",
  "{ type: \"text\", text: input.campaign",
  "{ type: \"text\", text: String(input.quantity",
  "{ type: \"text\", text: numbersText",
  "{ type: \"text\", text: `R$ ${Number(input.amount",
  "{ type: \"text\", text: input.link"
], "templates reaproveitam variaveis existentes");

assert.ok(!pixCoreBlock.includes("queueN8nEvent") && !purchaseConfirmationCoreBlock.includes("queueN8nEvent"), "Cloud modalidades nao deve criar automacao paralela.");
assert.ok(!pixCoreBlock.includes("/api/admin/crm") && !purchaseConfirmationCoreBlock.includes("/api/admin/crm"), "Cloud modalidades nao deve acionar CRM livre.");
assert.ok(!server.includes("app.post(\"/api/admin/whatsapp-cloud/fazendinha") && !server.includes("app.post(\"/api/admin/whatsapp-cloud/number-mode"), "Nao deve criar endpoints paralelos por modalidade.");
assert.equal(pkg.scripts["test:whatsapp-cloud-modalities-hard"], "node scripts/test-whatsapp-cloud-modalities-hard.mjs", "script npm ausente");

console.log("[whatsapp-cloud-modalities-hard] ok");

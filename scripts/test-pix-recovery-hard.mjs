import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const engine = readFileSync("src/server/promotions/promotionEngine.ts", "utf8");
const server = readFileSync("server.ts", "utf8");
const adminSales = readFileSync("src/pages/admin/AdminSales.tsx", "utf8");
const hardSuite = readFileSync("scripts/test-hard-suite.mjs", "utf8");

function includesAll(source, needles, label) {
  for (const needle of needles) assert(source.includes(needle), `${label}: ausente ${needle}`);
}

assert(engine.includes("abandoned_pix_recovery"));
assert(engine.includes("buildAbandonedPixRecoveryMessages"));
assert(engine.includes("idempotencyKey"));
assert(server.includes("process-abandoned-pix"));
assert(server.includes("whatsappMessageQueue"));
assert(server.includes("scheduleAutomation(\"abandoned_pix_recovery\""));
assert(server.includes("PIX pendente") || server.includes("paymentStatus"));

includesAll(server, [
  'app.use("/api/admin", rateLimiter, requireTenantAdmin)',
  'app.get("/api/admin/recovery/pix-pending"',
  "scoped(purchases, req)",
  'purchase.status === "pending"',
  "minimumAgeMs",
  "isPastReservationExpiry(purchase.pixExpiresAt || purchase.reservedUntil)",
  "buildAdminPixPendingRecovery",
  "statusLabel: expired ? \"PIX vencido\" : \"Aguardando pagamento\"",
  "paymentLink",
  "campaignLink",
  "copyMessage"
], "endpoint admin de recuperacao pix");

const recoveryRouteBlock = server.slice(server.indexOf('app.get("/api/admin/recovery/pix-pending"'), server.indexOf('app.get("/api/admin/clientes"'));
assert(!recoveryRouteBlock.includes("manuallyConfirmPurchasePayment"), "recuperacao nao deve confirmar pagamento");
assert(!recoveryRouteBlock.includes("releaseReservedNumbers"), "recuperacao nao deve reabrir ou liberar reserva");
assert(!/purchase\.status\s=[^=]/.test(recoveryRouteBlock), "recuperacao nao deve alterar status financeiro");
assert(!recoveryRouteBlock.includes("upsertPaymentRecord"), "recuperacao nao deve criar ou alterar cobranca");
assert(!recoveryRouteBlock.includes("whatsappMessageQueue.unshift"), "endpoint de listagem nao deve enviar WhatsApp automaticamente");

const recoveryBuilderBlock = server.slice(server.indexOf("function buildAdminPixPendingRecovery"), server.indexOf('app.get("/api/admin/recovery/pix-pending"'));
includesAll(recoveryBuilderBlock, [
  "id: purchase.purchaseId",
  "customerName",
  "whatsapp",
  "campaign",
  "amount",
  "createdAt",
  "expiresAt",
  "paymentLink",
  "copyMessage"
], "payload sanitizado de recuperacao");
for (const field of ["tenant_id", "pixPayload", "pixQrCodeBase64", "externalPaymentId", "externalReference", "raw_response", "webhook", "provider_payload", "customerId", "cpf", "email", "commission", "pixKey"]) {
  assert(!recoveryBuilderBlock.includes(`${field}:`), `payload de recuperacao nao deve retornar ${field}`);
}

includesAll(adminSales, [
  "/api/admin/recovery/pix-pending",
  "Recuperação de Vendas",
  "PIX Pendentes",
  "Copiar mensagem",
  "Copiar link",
  "Abrir pedido",
  "Todos",
  "Aguardando pagamento",
  "Vencidos",
  "Últimas 24h",
  "Últimos 7 dias",
  "navigator.clipboard.writeText",
  "Nenhum PIX pendente encontrado"
], "ui comercial de recuperacao pix");
assert(!adminSales.includes("process-abandoned-pix"), "ui nao deve disparar automacao de WhatsApp");
assert(hardSuite.includes('scripts/test-pix-recovery-hard.mjs'), "production-readiness deve rodar teste hard de recuperacao pix");

console.log("pix-recovery-hard ok");

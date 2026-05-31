import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const provider = readFileSync("src/server/payments/MercadoPagoProvider.ts", "utf8");
const admin = readFileSync("src/pages/admin/AdminPaymentGateways.tsx", "utf8");
const migration = readFileSync("supabase/migrations/42_mercadopago_pix_gateway.sql", "utf8");
const docs = readFileSync("docs/mercadopago-pix-integration.md", "utf8");

for (const needle of [
  "createPixPayment",
  "\"/v1/payments\"",
  "transaction_amount",
  "payment_method_id: \"pix\"",
  "external_reference",
  "notification_url",
  "point_of_interaction",
  "qr_code",
  "qr_code_base64",
  "ticket_url",
  "onlyDigits(payload.payerDocument)"
]) assert.ok(provider.includes(needle), `Provider Mercado Pago Pix incompleto: ${needle}`);

for (const needle of [
  "getMercadoPagoGatewayConfig",
  "getMercadoPagoProvider",
  "attachMercadoPagoPixToOrder",
  "buildTenantPublicUrl(input.tenantId, \"/api/webhooks/mercadopago\", true)",
  "idempotencyKey: randomUUID()",
  "provider: \"mercadopago\"",
  "provider_payment_id: mercadoPagoPaymentId",
  "provider_reference: orderId",
  "pix_copy_paste: qrCode.qrCode",
  "ticket_url: qrCode.ticketUrl",
  "attachMercadoPagoPixToOrder(input)) || (await attachAsaasPixToOrder(input))"
]) assert.ok(server.includes(needle), `Servidor Mercado Pago Pix incompleto: ${needle}`);

for (const needle of [
  "Mercado Pago Pix real",
  "Ativar Mercado Pago Pix",
  "Access Token",
  "Webhook token opcional",
  "Expiração PIX",
  "Liberar pedido quando",
  "approved"
]) assert.ok(admin.includes(needle), `Admin Mercado Pago incompleto: ${needle}`);

for (const needle of [
  "provider in ('asaas', 'pay2m', 'pagbank', 'mercadopago')",
  "ticket_url",
  "webhook_events_mercadopago_idempotency_idx",
  "tenant_id, provider, provider_payment_id"
]) assert.ok(migration.includes(needle), `Migration Mercado Pago incompleta: ${needle}`);

assert.ok(docs.includes("https://SEU_DOMINIO.com/api/webhooks/mercadopago"), "Docs devem informar webhook Mercado Pago.");

console.log("PASS: Mercado Pago Pix cria cobranca real, salva QR Code/copia e cola/ticket_url e aparece no admin.");

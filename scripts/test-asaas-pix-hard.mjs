import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const admin = readFileSync("src/pages/admin/AdminPaymentGateways.tsx", "utf8");
const provider = readFileSync("src/server/payments/AsaasProvider.ts", "utf8");
const migration = readFileSync("supabase/migrations/39_asaas_pix_gateway.sql", "utf8");

function hasAll(source, needles, label) {
  for (const needle of needles) assert.ok(source.includes(needle), `${label}: faltando ${needle}`);
}

hasAll(provider, [
  "https://api-sandbox.asaas.com/v3",
  "https://api.asaas.com/v3",
  "createCustomer",
  "createPixPayment",
  "getPixQrCode",
  "getPayment",
  "handleWebhook",
  "\"access_token\"",
  "\"user-agent\"",
  "\"billingType\": \"PIX\"",
  "externalReference"
], "AsaasProvider");

hasAll(server, [
  "getAsaasGatewayConfig",
  "attachAsaasPixToOrder",
  "app.post(\"/api/webhooks/asaas\"",
  "req.headers[\"asaas-access-token\"]",
  "buildPaymentIdempotencyKey",
  "updatePaymentRecordStatus",
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "externalPaymentId",
  "pixQrCodeBase64",
  "Cobranca Pix Asaas criada e QR Code gerado"
], "server Asaas");

hasAll(admin, [
  "Asaas Pix plug and play",
  "Ativar Asaas Pix",
  "Ambiente",
  "API Key Asaas",
  "Nome da aplicação / User-Agent",
  "Webhook token secreto",
  "Prazo de expiração do pedido",
  "Liberar cotas em",
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "Pix direto",
  "Checkout Asaas",
  "Pix + Boleto",
  "Testar"
], "admin Asaas");

hasAll(migration, [
  "create table if not exists public.payment_gateways",
  "api_key_encrypted",
  "webhook_token",
  "create table if not exists public.orders",
  "create table if not exists public.payments",
  "asaas_payment_id",
  "alter table public.webhook_events add column if not exists event_id",
  "webhook_events_provider_event_id_idx",
  "enable row level security"
], "migration Asaas");

assert.ok(!admin.includes("api_key_encrypted"), "Admin nao deve manipular campo bruto criptografado.");
assert.ok(!server.includes("api_key_encrypted:") || server.includes("encryptGatewaySecret"), "Servidor deve usar camada de criptografia existente.");

console.log("PASS: Asaas Pix plug and play com admin, provider, webhook idempotente, QR Code e migration.");

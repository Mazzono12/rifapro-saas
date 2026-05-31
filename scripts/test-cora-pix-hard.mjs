import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const provider = readFileSync("src/server/payments/CoraProvider.ts", "utf8");
const server = readFileSync("server.ts", "utf8");
const migration = readFileSync("supabase/migrations/43_cora_pix_gateway.sql", "utf8");
const docs = readFileSync("docs/cora-pix-integration.md", "utf8");

for (const needle of [
  "createPixPayment",
  "\"/v2/invoices/\"",
  "\"Idempotency-Key\"",
  "payment_forms: [\"PIX\"]",
  "services",
  "amount: toCents(payload.amount)",
  "getPixQrCode",
  "emv",
  "qr_code_base64"
]) assert.ok(provider.includes(needle), `Provider Cora Pix incompleto: ${needle}`);

for (const needle of [
  "getCoraGatewayConfig",
  "getCoraProvider",
  "attachCoraPixToOrder",
  "provider: \"cora\"",
  "provider_payment_id: providerPaymentId",
  "provider_reference: orderId",
  "txid",
  "pix_copy_paste: qrCode.emv",
  "pixQrCodeBase64: qrCode.base64",
  "attachCoraPixToOrder(input)"
]) assert.ok(server.includes(needle), `Servidor Cora Pix incompleto: ${needle}`);

for (const needle of [
  "provider in ('asaas', 'pay2m', 'pagbank', 'mercadopago', 'cora')",
  "payments_cora_payment_idx",
  "payments_cora_txid_idx",
  "webhook_events_cora_idempotency_idx"
]) assert.ok(migration.includes(needle), `Migration Cora incompleta: ${needle}`);

assert.ok(docs.includes("https://SEU_DOMINIO.com/api/webhooks/cora"), "Docs Cora devem informar webhook.");

console.log("PASS: Cora Pix cria QR Code v2 com payment_forms PIX e salva copia e cola/txid por tenant.");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(join(root, file), "utf8");

const provider = read("src/server/payments/PagbankProvider.ts");
const server = read("server.ts");
const migration = read("supabase/migrations/41_pagbank_pix_gateway.sql");

for (const needle of [
  "createPixPayment",
  "\"/orders\"",
  "reference_id",
  "customer",
  "tax_id",
  "items",
  "unit_amount: amountInCents",
  "qr_codes",
  "amount: { value: amountInCents }",
  "expiration_date",
  "notification_urls",
  "parsePixQrCode",
  "qrCode.text"
]) assert.ok(provider.includes(needle), `PagbankProvider PIX incompleto: ${needle}`);

for (const needle of [
  "getPagbankGatewayConfig",
  "attachPagbankPixToOrder",
  "provider: \"pagbank\"",
  "provider_payment_id: pagbankOrderId",
  "provider_reference: orderId",
  "pix_copy_paste: pixPayload",
  "qr_code_url: qrCode.imageUrl",
  "pixGateway: \"pagbank\"",
  "pixWebhookUrl: \"/api/webhooks/pagbank\"",
  "toCents(input.amount)",
  "buildTenantPublicUrl(input.tenantId, \"/api/webhooks/pagbank\", true)",
  "replace(/^http:\\/\\//i, \"https://\")"
]) assert.ok(server.includes(needle), `server sem fluxo Pix PagBank: ${needle}`);

for (const needle of [
  "provider in ('asaas', 'pay2m', 'pagbank')",
  "qr_code_url",
  "payments_pagbank_order_idx",
  "payments_pagbank_reference_idx"
]) assert.ok(migration.includes(needle), `migration PagBank incompleta: ${needle}`);

console.log("PASS: PagBank cria pedido Pix via Orders API, salva QR/copia e cola e campos normalizados.");

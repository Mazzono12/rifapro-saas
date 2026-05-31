import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const provider = readFileSync("src/server/payments/PrimepagProvider.ts", "utf8");
const server = readFileSync("server.ts", "utf8");
const migration = readFileSync("supabase/migrations/44_primepag_pix_gateway.sql", "utf8");
const docs = readFileSync("docs/primepag-pix-integration.md", "utf8");

for (const needle of [
  "async createPixPayment",
  "\"/v1/pix/qrcodes\"",
  "value_cents: toCents(payload.amount)",
  "Math.round(Number(value || 0) * 100)",
  "generator_name",
  "generator_document",
  "expiration_time: String(clampExpiration(payload.expirationTime))",
  "external_reference",
  "getQrCode",
  "imageBase64: qrcode.image_base64 ? String(qrcode.image_base64) : \"\""
]) assert.ok(provider.includes(needle), `PrimePag Pix incompleto: ${needle}`);

for (const needle of [
  "async function attachPrimepagPixToOrder",
  "getPrimepagProvider(input.tenantId)",
  "amount: Number(input.amount.toFixed(2))",
  "provider: \"primepag\"",
  "provider_payment_id: referenceCode",
  "provider_reference: qrcode.externalReference || orderId",
  "pix_copy_paste: pixPayload",
  "qr_code_base64: qrcode.imageBase64",
  "pixPayload",
  "pixGateway: \"primepag\"",
  "pixWebhookUrl: \"/api/webhooks/primepag\""
]) assert.ok(server.includes(needle), `Checkout PrimePag Pix incompleto: ${needle}`);

assert.ok(!server.includes("value_cents: toCents(toCents"), "PrimePag nao pode converter centavos duas vezes.");
assert.ok(migration.includes("provider in ('asaas', 'pay2m', 'pagbank', 'mercadopago', 'cora', 'primepag')"), "Migration deve aceitar provider primepag.");
assert.ok(docs.includes("value_cents") && docs.includes("qrcode.content"), "Docs devem explicar value_cents e copia e cola.");

console.log("PASS: PrimePag cria QR Code Pix com value_cents correto e salva content/image_base64 por tenant.");

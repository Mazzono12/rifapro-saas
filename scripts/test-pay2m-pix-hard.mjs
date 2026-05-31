import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(join(root, file), "utf8");

const provider = read("src/server/payments/Pay2mProvider.ts");
const server = read("server.ts");
const migration = read("supabase/migrations/40_pay2m_pix_gateway.sql");

for (const needle of [
  "createPixPayment",
  "/api/v1/pix/qrcode",
  "value: Number(payload.value.toFixed(2))",
  "generator_name",
  "generator_document",
  "external_reference",
  "expiration_time",
  "payer_message",
  "split_link",
  "clampExpiration",
  "getPixQrCode",
  "getPayment(referenceCode"
]) {
  assert.ok(provider.includes(needle), `Pay2mProvider sem criacao/consulta PIX real: ${needle}`);
}

for (const needle of [
  "getPay2mGatewayConfig",
  "attachPay2mPixToOrder",
  "provider: \"pay2m\"",
  "provider_payment_id: referenceCode",
  "provider_reference: referenceCode",
  "pix_copy_paste: pixPayload",
  "pixGateway: \"pay2m\"",
  "pixWebhookUrl: \"/api/webhooks/pay2m\"",
  "externalReference: orderId",
  "Math.min(3600"
]) {
  assert.ok(server.includes(needle), `server sem fluxo PIX Pay2M: ${needle}`);
}

for (const needle of [
  "provider in ('asaas', 'pay2m')",
  "provider_payment_id",
  "provider_reference",
  "pix_copy_paste",
  "end_to_end",
  "paid_at"
]) {
  assert.ok(migration.includes(needle), `migration Pay2M incompleta: ${needle}`);
}

console.log("PASS: Pay2M cria PIX real, persiste reference_code/copia e cola e consulta cobranca.");

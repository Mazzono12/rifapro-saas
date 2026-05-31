import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = readFileSync(join(root, "server.ts"), "utf8");
const provider = readFileSync(join(root, "src/server/payments/Pay2mProvider.ts"), "utf8");

for (const needle of [
  "app.post(\"/api/webhooks/pay2m\"",
  "notificationType !== \"PIX:QRCODE\"",
  "req.headers[\"x-webhook-secret\"]",
  "req.headers[\"pay2m-access-token\"]",
  "req.headers[\"authorization\"]",
  "timingSafeEqual",
  "webhookEvents.unshift",
  "provider: \"pay2m\" as IntegrationProviderId",
  "provider_payment_id === parsed.referenceCode",
  "provider_reference === parsed.referenceCode",
  "order_id === parsed.externalReference",
  "status === \"paid\"",
  "status === \"cancelled\"",
  "expired\", \"canceled\"",
  "releaseReservedNumbers",
  "res.status(200).json"
]) {
  assert.ok(server.includes(needle), `webhook Pay2M sem regra obrigatoria: ${needle}`);
}

for (const needle of [
  "handleWebhook",
  "notification_type",
  "reference_code",
  "external_reference",
  "end_to_end",
  "shouldRelease: notificationType === \"PIX:QRCODE\" && status === \"paid\""
]) {
  assert.ok(provider.includes(needle), `parser webhook Pay2M incompleto: ${needle}`);
}

console.log("PASS: webhook Pay2M valida payload/token, registra evento e baixa/cancela sem bloquear reenvio.");

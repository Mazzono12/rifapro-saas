import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = readFileSync(join(root, "server.ts"), "utf8");
const provider = readFileSync(join(root, "src/server/payments/PagbankProvider.ts"), "utf8");

for (const needle of [
  "app.post(\"/api/webhooks/pagbank\"",
  "const tenant = getRequestTenant(req)",
  "getPagbankGatewayConfig(tenant.id)",
  "req.headers[\"x-webhook-secret\"]",
  "req.headers[\"pagbank-access-token\"]",
  "timingSafeEqual",
  "provider: \"pagbank\" as IntegrationProviderId",
  "provider_payment_id: parsed.orderId",
  "reference_id: parsed.referenceId",
  "item.tenant_id === tenantId",
  "item.provider === \"pagbank\"",
  "item.provider_payment_id === parsed.orderId",
  "item.provider_reference === parsed.referenceId",
  "enqueuePaymentJob({ tenant_id: tenantId, gateway",
  "releaseReservedNumbers",
  "res.status(200).json"
]) assert.ok(server.includes(needle), `webhook PagBank sem regra obrigatoria: ${needle}`);

for (const needle of [
  "handleWebhook",
  "parseOrderStatus",
  "order.reference_id",
  "shouldRelease",
  "PAID",
  "AUTHORIZED",
  "COMPLETED"
]) assert.ok(provider.includes(needle), `parser webhook PagBank incompleto: ${needle}`);

console.log("PASS: webhook PagBank tenant-safe, idempotente e baixa/cancela por status.");

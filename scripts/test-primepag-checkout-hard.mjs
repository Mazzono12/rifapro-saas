import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");

for (const needle of [
  "async function attachPrimepagPixToOrder",
  "PurchaseRecord | FazendinhaPurchase | NumberModePurchase",
  "getPrimepagProvider(input.tenantId)",
  "Object.assign(input.purchase",
  "pixGateway: \"primepag\"",
  "pixWebhookUrl: \"/api/webhooks/primepag\"",
  "externalPaymentId: referenceCode",
  "pixQrCodeBase64: qrcode.imageBase64",
  "pixPayload",
  "upsertPaymentRecord",
  "provider: \"primepag\"",
  "provider_payment_id: referenceCode",
  "provider_reference: qrcode.externalReference || orderId"
]) assert.ok(server.includes(needle), `Checkout PrimePag incompleto: ${needle}`);

for (const needle of [
  "attachActiveGatewayPixToOrder",
  "(await attachPrimepagPixToOrder(input))",
  "getPrimepagGatewayConfig(tenantId)",
  "gatewayRequiresWebhook = Boolean"
]) assert.ok(server.includes(needle), `PrimePag nao conectado ao fluxo global: ${needle}`);

console.log("PASS: PrimePag integrado ao checkout de rifa tradicional, Fazendinha e NumberMode via attachActiveGatewayPixToOrder.");

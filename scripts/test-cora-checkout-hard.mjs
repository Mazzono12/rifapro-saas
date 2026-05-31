import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");

for (const needle of [
  "async function attachCoraPixToOrder",
  "PurchaseRecord | FazendinhaPurchase | NumberModePurchase",
  "getCoraProvider(input.tenantId)",
  "Object.assign(input.purchase",
  "pixGateway: \"cora\"",
  "pixWebhookUrl: \"/api/webhooks/cora\"",
  "externalPaymentId: providerPaymentId",
  "pixQrCodeBase64: qrCode.base64",
  "pixPayload: qrCode.emv",
  "upsertPaymentRecord",
  "provider: \"cora\"",
  "provider_payment_id: providerPaymentId",
  "provider_reference: orderId",
  "txid,"
]) assert.ok(server.includes(needle), `Checkout Cora incompleto: ${needle}`);

for (const needle of [
  "attachActiveGatewayPixToOrder",
  "(await attachCoraPixToOrder(input))",
  "gatewayRequiresWebhook = Boolean(getMercadoPagoGatewayConfig(tenantId) || getAsaasGatewayConfig(tenantId) || getPay2mGatewayConfig(tenantId) || getPagbankGatewayConfig(tenantId) || getCoraGatewayConfig(tenantId))",
  "buildTenantPublicUrl(input.tenantId, \"/api/webhooks/cora\", true)"
]) assert.ok(server.includes(needle), `Checkout Cora nao conectado ao fluxo global: ${needle}`);

console.log("PASS: Cora integrado ao checkout de rifa tradicional, Fazendinha e NumberMode via attachActiveGatewayPixToOrder.");

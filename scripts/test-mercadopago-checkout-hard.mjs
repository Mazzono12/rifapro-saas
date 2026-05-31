import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");

for (const needle of [
  "async function attachMercadoPagoPixToOrder",
  "PurchaseRecord | FazendinhaPurchase | NumberModePurchase",
  "getMercadoPagoProvider(input.tenantId)",
  "Object.assign(input.purchase",
  "pixGateway: \"mercadopago\"",
  "pixWebhookUrl: \"/api/webhooks/mercadopago\"",
  "externalPaymentId: mercadoPagoPaymentId",
  "pixQrCodeBase64: qrCode.qrCodeBase64",
  "upsertPaymentRecord",
  "provider: \"mercadopago\"",
  "attachMercadoPagoPixToOrder(input)) || (await attachAsaasPixToOrder(input))"
]) assert.ok(server.includes(needle), `Checkout Mercado Pago incompleto: ${needle}`);

for (const needle of [
  "gatewayRequiresWebhook = Boolean(getMercadoPagoGatewayConfig(tenantId) || getAsaasGatewayConfig(tenantId) || getPay2mGatewayConfig(tenantId) || getPagbankGatewayConfig(tenantId))",
  "attachActiveGatewayPixToOrder"
]) assert.ok(server.includes(needle), `Checkout com gateway externo incompleto: ${needle}`);

console.log("PASS: Mercado Pago integrado ao checkout de rifa tradicional, Fazendinha e NumberMode via attachActiveGatewayPixToOrder.");

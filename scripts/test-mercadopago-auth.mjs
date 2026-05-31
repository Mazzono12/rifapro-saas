import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const provider = readFileSync("src/server/payments/MercadoPagoProvider.ts", "utf8");

for (const needle of [
  "https://api.mercadopago.com",
  "Authorization: `Bearer ${this.accessToken}`",
  "\"X-Idempotency-Key\"",
  "timeoutMs",
  "AbortController",
  "response.status >= 500 && attempt === 0",
  "Access Token Mercado Pago nao configurado",
  "testConnection",
  "/users/me"
]) assert.ok(provider.includes(needle), `MercadoPagoProvider auth incompleto: ${needle}`);

assert.ok(!provider.includes("console.log(this.accessToken)") && !provider.includes("console.log(config"), "Provider nao deve logar Access Token.");

console.log("PASS: Mercado Pago auth com Bearer token, timeout, retry e idempotency key obrigatoria.");

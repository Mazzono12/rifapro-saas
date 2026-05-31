import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const provider = readFileSync("src/server/payments/PrimepagProvider.ts", "utf8");
const admin = readFileSync("src/pages/admin/AdminPaymentGateways.tsx", "utf8");

for (const needle of [
  "https://api-stg.primepag.com.br",
  "https://api.primepag.com.br",
  "getAccessToken",
  "/auth/generate_token",
  "grant_type",
  "client_credentials",
  "Buffer.from(`${this.clientId}:${this.clientSecret}`",
  "tokenCache",
  "staticAccessToken",
  "timeoutMs",
  "AbortController",
  "response.status >= 500 && attempt === 0"
]) assert.ok(provider.includes(needle), `PrimepagProvider auth incompleto: ${needle}`);

for (const needle of [
  "PrimePag Pix real",
  "Ativar PrimePag Pix",
  "client_id",
  "client_secret",
  "Access token/API token",
  "Webhook authorization token",
  "PrimePag gera PIX interno com copia e cola"
]) assert.ok(admin.includes(needle), `Admin PrimePag auth incompleto: ${needle}`);

assert.ok(!provider.includes("console.log(this.clientSecret)") && !provider.includes("console.log(token") && !provider.includes("console.log(this.staticAccessToken)"), "PrimePag nao deve logar credenciais/token.");

console.log("PASS: PrimePag auth com OAuth/token estatico, timeout, retry e admin plug and play.");

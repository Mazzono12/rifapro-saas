import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const provider = readFileSync(join(root, "src/server/payments/PagbankProvider.ts"), "utf8");

for (const needle of [
  "https://sandbox.api.pagseguro.com",
  "https://api.pagseguro.com",
  "Authorization: `Bearer ${this.token}`",
  "content-type\": \"application/json\"",
  "Token PagBank nao configurado",
  "Timeout ao chamar PagBank",
  "testConnection",
  "/orders?page=0&size=1"
]) {
  assert.ok(provider.includes(needle), `PagbankProvider auth/baseURL incompleto: ${needle}`);
}

assert.doesNotMatch(provider, /console\.(log|warn|error)\([^)]*token/i, "Token PagBank nao pode ser logado.");

console.log("PASS: PagBank auth real com Bearer token, base sandbox/producao e timeout.");

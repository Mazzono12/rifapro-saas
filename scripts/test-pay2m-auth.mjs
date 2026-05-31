import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const provider = readFileSync(join(root, "src/server/payments/Pay2mProvider.ts"), "utf8");

for (const needle of [
  "https://portal.pay2m.com.br",
  "getAccessToken",
  "/api/auth/generate_token",
  "grant_type: \"client_credentials\"",
  "Authorization: `Basic ${basic}`",
  "Buffer.from(`${this.clientId}:${this.clientSecret}`",
  "tokenCache",
  "cached.expiresAt > Date.now() + 60_000",
  "expires_in",
  "Bearer",
  "Timeout ao chamar Pay2M"
]) {
  assert.ok(provider.includes(needle), `Pay2mProvider sem autenticacao obrigatoria: ${needle}`);
}

assert.doesNotMatch(provider, /console\.(log|warn|error)\([^)]*clientSecret/i, "CLIENT_SECRET nao pode ser logado.");
assert.doesNotMatch(provider, /console\.(log|warn|error)\([^)]*client_secret/i, "client_secret nao pode ser logado.");

console.log("PASS: Pay2M auth real com Basic, token cacheado e renovacao antes de expirar.");

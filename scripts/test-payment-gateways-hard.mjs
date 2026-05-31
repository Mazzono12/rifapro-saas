import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(join(root, file), "utf8");

const admin = read("src/pages/admin/AdminPaymentGateways.tsx");
const server = read("server.ts");
const migration17 = read("supabase/migrations/17_payment_gateway_configs.sql");
const migration40 = read("supabase/migrations/40_pay2m_pix_gateway.sql");
const docs = read("docs/pay2m-pix-integration.md");

for (const needle of [
  "Pay2M Pix real",
  "Ativar Pay2M Pix",
  "Ambiente",
  "CLIENT_ID",
  "CLIENT_SECRET",
  "Webhook token opcional",
  "Expiration time (segundos, max 3600)",
  "Split link opcional",
  "Liberar pedido quando",
  "gateway=\"pay2m\"",
  "Testar"
]) {
  assert.ok(admin.includes(needle), `admin gateways sem campo Pay2M: ${needle}`);
}

for (const needle of [
  "credentials: encryptGatewayCredentialObject",
  "webhook_secret: isMaskedGatewaySecret",
  "sanitizePaymentGatewayConfig",
  "maskLegacyGatewaysForResponse",
  "pay2m: [\"clientId\", \"clientSecret\"]",
  "Conexao Pay2M testada com sucesso",
  "Webhook recomendado deve apontar para ${recommendedWebhookPath}"
]) {
  assert.ok(server.includes(needle), `backend gateways sem seguranca/teste Pay2M: ${needle}`);
}

assert.ok(migration17.includes("'pay2m'"), "payment_gateway_configs deve aceitar pay2m.");
assert.ok(migration40.includes("payment_gateways_provider_check"), "payment_gateways deve aceitar pay2m.");
assert.ok(migration40.includes("payments_provider_check"), "payments deve aceitar pay2m.");
assert.ok(docs.includes("https://SEU_DOMINIO.com/api/webhooks/pay2m"), "docs devem publicar URL webhook Pay2M.");

console.log("PASS: admin e banco suportam Pay2M plug and play com credenciais cifradas e docs.");

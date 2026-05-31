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
const migration41 = read("supabase/migrations/41_pagbank_pix_gateway.sql");
const migrationMp = read("supabase/migrations/42_mercadopago_pix_gateway.sql");
const migrationCora = read("supabase/migrations/43_cora_pix_gateway.sql");
const docs = read("docs/pay2m-pix-integration.md");
const pagbankDocs = read("docs/pagbank-pix-integration.md");
const mercadoPagoDocs = read("docs/mercadopago-pix-integration.md");
const coraDocs = read("docs/cora-pix-integration.md");

for (const needle of [
  "Mercado Pago Pix real",
  "Pay2M Pix real",
  "PagBank Pix real",
  "Banco Cora Pix real",
  "Ativar Mercado Pago Pix",
  "Ativar Pay2M Pix",
  "Ativar PagBank Pix",
  "Ativar Cora Pix",
  "Ambiente",
  "CLIENT_ID",
  "CLIENT_SECRET",
  "Bearer token/API token",
  "Certificado PEM",
  "Chave privada PEM",
  "Banco Cora pode exigir CoraPro/Integração Direta com certificado e chave",
  "Webhook token opcional",
  "Expiração PIX (minutos)",
  "Expiration time (segundos, max 3600)",
  "Tempo de expiração padrão (minutos)",
  "Split link opcional",
  "Liberar pedido quando",
  "gateway=\"pay2m\"",
  "gateway=\"pagbank\"",
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
  "pagbank: [\"token\"]",
  "mercadopago: [\"accessToken\", \"publicKey\"]",
  "cora: [\"clientId\", \"clientSecret\", \"certificate\", \"privateKey\", \"apiKey\"]",
  "Conexao Pay2M testada com sucesso",
  "Conexao PagBank testada com sucesso",
  "Conexao Mercado Pago testada com sucesso",
  "Conexao Cora testada com sucesso",
  "Webhook recomendado deve apontar para ${recommendedWebhookPath}"
]) {
  assert.ok(server.includes(needle), `backend gateways sem seguranca/teste Pay2M: ${needle}`);
}

assert.ok(migration17.includes("'pay2m'"), "payment_gateway_configs deve aceitar pay2m.");
assert.ok(migration40.includes("payment_gateways_provider_check"), "payment_gateways deve aceitar pay2m.");
assert.ok(migration40.includes("payments_provider_check"), "payments deve aceitar pay2m.");
assert.ok(migration41.includes("provider in ('asaas', 'pay2m', 'pagbank')"), "payment_gateways/payments deve aceitar pagbank.");
assert.ok(migration41.includes("webhook_events_pagbank_idempotency_idx"), "webhook_events deve ter idempotencia PagBank.");
assert.ok(migrationMp.includes("provider in ('asaas', 'pay2m', 'pagbank', 'mercadopago')"), "payment_gateways/payments deve aceitar mercadopago.");
assert.ok(migrationMp.includes("webhook_events_mercadopago_idempotency_idx"), "webhook_events deve ter idempotencia Mercado Pago.");
assert.ok(migrationCora.includes("provider in ('asaas', 'pay2m', 'pagbank', 'mercadopago', 'cora')"), "payment_gateways/payments deve aceitar cora.");
assert.ok(migrationCora.includes("webhook_events_cora_idempotency_idx"), "webhook_events deve ter idempotencia Cora.");
assert.ok(docs.includes("https://SEU_DOMINIO.com/api/webhooks/pay2m"), "docs devem publicar URL webhook Pay2M.");
assert.ok(pagbankDocs.includes("https://SEU_DOMINIO.com/api/webhooks/pagbank"), "docs devem publicar URL webhook PagBank.");
assert.ok(mercadoPagoDocs.includes("https://SEU_DOMINIO.com/api/webhooks/mercadopago"), "docs devem publicar URL webhook Mercado Pago.");
assert.ok(coraDocs.includes("https://SEU_DOMINIO.com/api/webhooks/cora"), "docs devem publicar URL webhook Cora.");

console.log("PASS: admin e banco suportam Mercado Pago/Pay2M/PagBank/Cora plug and play com credenciais cifradas e docs.");

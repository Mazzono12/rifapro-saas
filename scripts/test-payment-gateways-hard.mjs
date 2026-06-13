import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(join(root, file), "utf8");

const admin = read("src/pages/admin/AdminPaymentGateways.tsx");
const adminRaffles = read("src/pages/admin/AdminRaffles.tsx");
const server = read("server.ts");
const migration17 = read("supabase/migrations/17_payment_gateway_configs.sql");
const migration40 = read("supabase/migrations/40_pay2m_pix_gateway.sql");
const migration41 = read("supabase/migrations/41_pagbank_pix_gateway.sql");
const migrationMp = read("supabase/migrations/42_mercadopago_pix_gateway.sql");
const migrationCora = read("supabase/migrations/43_cora_pix_gateway.sql");
const migrationPrimepag = read("supabase/migrations/44_primepag_pix_gateway.sql");
const productionDefaultMigration = read("supabase/migrations/45_production_default_environments.sql");
const docs = read("docs/pay2m-pix-integration.md");
const pagbankDocs = read("docs/pagbank-pix-integration.md");
const mercadoPagoDocs = read("docs/mercadopago-pix-integration.md");
const coraDocs = read("docs/cora-pix-integration.md");
const primepagDocs = read("docs/primepag-pix-integration.md");

for (const needle of [
  "Mercado Pago Pix real",
  "Pay2M Pix real",
  "PagBank Pix real",
  "Banco Cora Pix real",
  "PrimePag Pix real",
  "Ativar Mercado Pago Pix",
  "Ativar Pay2M Pix",
  "Ativar PagBank Pix",
  "Ativar Cora Pix",
  "Ativar PrimePag Pix",
  "Ambiente",
  "Conta do gateway",
  "Senha do gateway",
  "Chave privada",
  "Certificado da conta",
  "Chave privada da conta",
  "Banco Cora pode exigir CoraPro/Integração Direta com certificado e chave",
  "Chave de segurança",
  "PrimePag gera PIX interno com copia e cola",
  "Canal de notificação",
  "Expiração PIX (minutos)",
  "Tempo de expiração (segundos, máximo 3600)",
  "Tempo de expiração padrão (minutos)",
  "Link de divisão opcional",
  "Liberar pedido quando",
  "gateway=\"pay2m\"",
  "gateway=\"pagbank\"",
  "Testar"
]) {
  assert.ok(admin.includes(needle), `admin gateways sem campo Pay2M: ${needle}`);
}

for (const needle of [
  "sandbox: false",
  "Modo Sandbox/Teste Ativo",
  "Opção avançada para testes; produção é o padrão."
]) {
  assert.ok(adminRaffles.includes(needle), `campanha deve nascer em producao e destacar sandbox manual: ${needle}`);
}

for (const needle of [
  "sandbox: false",
  "environment: \"production\"",
  "mercadoPagoConfig.environment || \"production\"",
  "asaasConfig.environment || \"production\"",
  "pagbankConfig.environment || \"production\"",
  "coraConfig.environment || \"production\"",
  "primepagConfig.environment || \"production\"",
  "Modo Sandbox/Teste Ativo"
]) {
  assert.ok(admin.includes(needle), `admin gateways deve usar producao por padrao: ${needle}`);
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
  "primepag: [\"clientId\", \"clientSecret\", \"accessToken\", \"apiKey\"]",
  "Conexao Pay2M testada com sucesso",
  "Conexao PagBank testada com sucesso",
  "Conexao Mercado Pago testada com sucesso",
  "Conexao Cora testada com sucesso",
  "Conexao PrimePag testada com sucesso",
  "const officialGatewayConfig = getPaymentGatewayConfigs(tenantId)",
  ".find(config => normalizePaymentProvider(config.provider) === gateway && config.enabled)",
  "const officialAsaasApiKey = String(officialGatewayConfig?.credentials?.apiKey || officialGatewayConfig?.pix_key || \"\")",
  "Nenhuma API Key Asaas configurada. Salve a Chave Privada antes de testar.",
  "new AsaasProvider({",
  "Webhook recomendado deve apontar para ${recommendedWebhookPath}",
  "enabled: local.inheritGlobal ? Boolean(defaultGatewayConfig.enabled) : Boolean(local.enabled)",
  "getResolvedPaymentGatewayConfig(tenantId, \"mercadopago\", pixConfig)",
  "getResolvedPaymentGatewayConfig(tenantId, \"pay2m\", pixConfig)",
  "getResolvedPaymentGatewayConfig(tenantId, \"pagbank\", pixConfig)",
  "getResolvedPaymentGatewayConfig(tenantId, \"cora\", pixConfig)",
  "getResolvedPaymentGatewayConfig(tenantId, \"primepag\", pixConfig)",
  "pixPayload: shouldUseInternalPixPayload(pixConfig) ? buildPixPayload"
]) {
  assert.ok(server.includes(needle), `backend gateways sem seguranca/teste Pay2M: ${needle}`);
}

for (const needle of [
  "sandbox: false",
  "sandbox: local.inheritGlobal ? defaultGatewayConfig.environment === \"sandbox\" : Boolean(local.sandbox)",
  "environment: raw.environment === \"sandbox\" ? \"sandbox\" : raw.environment === \"staging\" ? \"staging\" : raw.environment === \"mock\" ? \"mock\" : \"production\"",
  "environment: config.environment === \"sandbox\" ? \"sandbox\" as const : \"production\" as const",
  "config.environment === \"sandbox\" ? \"sandbox\" as const : config.environment === \"staging\" ? \"staging\" as const : \"production\" as const"
]) {
  assert.ok(server.includes(needle), `backend deve usar producao por padrao: ${needle}`);
}

assert.ok(migration17.includes("'pay2m'"), "payment_gateway_configs deve aceitar pay2m.");
assert.ok(migration17.includes("environment text default 'production'"), "payment_gateway_configs deve nascer em producao.");
assert.ok(migration17.includes("check (environment in ('sandbox', 'production', 'staging', 'mock'))"), "payment_gateway_configs deve permitir staging apenas explicitamente.");
assert.ok(productionDefaultMigration.includes("alter column environment set default 'production'"), "migration corretiva deve forcar default production.");
assert.ok(migration40.includes("payment_gateways_provider_check"), "payment_gateways deve aceitar pay2m.");
assert.ok(migration40.includes("payments_provider_check"), "payments deve aceitar pay2m.");
assert.ok(migration41.includes("provider in ('asaas', 'pay2m', 'pagbank')"), "payment_gateways/payments deve aceitar pagbank.");
assert.ok(migration41.includes("webhook_events_pagbank_idempotency_idx"), "webhook_events deve ter idempotencia PagBank.");
assert.ok(migrationMp.includes("provider in ('asaas', 'pay2m', 'pagbank', 'mercadopago')"), "payment_gateways/payments deve aceitar mercadopago.");
assert.ok(migrationMp.includes("webhook_events_mercadopago_idempotency_idx"), "webhook_events deve ter idempotencia Mercado Pago.");
assert.ok(migrationCora.includes("provider in ('asaas', 'pay2m', 'pagbank', 'mercadopago', 'cora')"), "payment_gateways/payments deve aceitar cora.");
assert.ok(migrationCora.includes("webhook_events_cora_idempotency_idx"), "webhook_events deve ter idempotencia Cora.");
assert.ok(migrationPrimepag.includes("provider in ('asaas', 'pay2m', 'pagbank', 'mercadopago', 'cora', 'primepag')"), "payment_gateways/payments deve aceitar primepag.");
assert.ok(migrationPrimepag.includes("webhook_events_primepag_idempotency_idx"), "webhook_events deve ter idempotencia PrimePag.");
assert.ok(docs.includes("https://SEU_DOMINIO.com/api/webhooks/pay2m"), "docs devem publicar URL webhook Pay2M.");
assert.ok(pagbankDocs.includes("https://SEU_DOMINIO.com/api/webhooks/pagbank"), "docs devem publicar URL webhook PagBank.");
assert.ok(mercadoPagoDocs.includes("https://SEU_DOMINIO.com/api/webhooks/mercadopago"), "docs devem publicar URL webhook Mercado Pago.");
assert.ok(coraDocs.includes("https://SEU_DOMINIO.com/api/webhooks/cora"), "docs devem publicar URL webhook Cora.");
assert.ok(primepagDocs.includes("https://SEU_DOMINIO.com/api/webhooks/primepag"), "docs devem publicar URL webhook PrimePag.");

console.log("PASS: admin e banco suportam Mercado Pago/Pay2M/PagBank/Cora/PrimePag plug and play com credenciais cifradas e docs.");

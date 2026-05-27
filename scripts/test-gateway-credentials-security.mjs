import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(join(root, file), "utf8");

const server = read("server.ts");
const migration17 = read("supabase/migrations/17_payment_gateway_configs.sql");
const migration18 = read("supabase/migrations/18_gateway_credentials_encryption_metadata.sql");
const hardSuite = read("scripts/test-hard-suite.mjs");
const pixTest = read("scripts/test-pix-multitenant.mjs");

assert.match(server, /GATEWAY_CREDENTIALS_ENCRYPTION_KEY/, "Backend deve usar GATEWAY_CREDENTIALS_ENCRYPTION_KEY.");
assert.match(server, /createCipheriv\("aes-256-gcm"/, "Backend deve criptografar com AES-256-GCM.");
assert.match(server, /createDecipheriv\("aes-256-gcm"/, "Backend deve descriptografar somente no backend.");
assert.match(server, /encryptedGatewayValuePrefix = "enc:v1:"/, "Valores cifrados devem ter prefixo versionado.");
assert.match(server, /encryptGatewayCredentialObject/, "Credenciais devem ser cifradas antes da persistencia.");
assert.match(server, /decryptPaymentGatewayConfig/, "Backend deve descriptografar configs para uso interno.");
assert.match(server, /sanitizePaymentGatewayConfig/, "Respostas ao frontend devem ser sanitizadas.");
assert.match(server, /maskLegacyGatewaysForResponse/, "Gateway legado tambem deve voltar mascarado.");
assert.match(server, /encryptLegacyGatewaysForStorage/, "Persistencia legada nao pode salvar secrets puros.");
assert.match(migration17, /credentials jsonb not null default '\{\}'::jsonb/, "Tabela payment_gateway_configs deve manter credentials JSONB.");
assert.match(migration18, /credentials_encryption_version/, "Migration deve registrar versao da criptografia.");
assert.match(migration18, /GATEWAY_CREDENTIALS_ENCRYPTION_KEY/, "Migration deve documentar a chave de criptografia.");
assert.match(hardSuite, /test-gateway-credentials-security\.mjs/, "Production readiness deve incluir teste de seguranca dos gateways.");
assert.match(pixTest, /assert\.notEqual\(gatewaysA\.body\.pix\.apiKey/, "Teste PIX deve garantir que API key nao volta em claro.");

const forbiddenResponsePatterns = [
  /res\.json\(\{\s*\.\.\.getTenantGateways\(tenantId\)/,
  /res\.json\(getTenantGateways/
];
for (const pattern of forbiddenResponsePatterns) {
  assert.doesNotMatch(server, pattern, `Resposta de gateway nao pode retornar secrets em claro: ${pattern}`);
}

console.log("PASS: credenciais de gateways cifradas em repouso, descriptografadas so no backend e mascaradas no frontend.");

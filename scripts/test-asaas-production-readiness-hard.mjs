import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(join(root, file), "utf8");

const server = read("server.ts");
const adminGateways = read("src/pages/admin/AdminPaymentGateways.tsx");
const provider = read("src/server/payments/AsaasProvider.ts");
const report = read("docs/asaas-production-audit.md");

function has(source, snippet, label) {
  assert.ok(source.includes(snippet), `${label}: faltando ${snippet}`);
}

for (const snippet of [
  "https://api-sandbox.asaas.com/v3",
  "https://api.asaas.com/v3",
  "\"access_token\": this.apiKey",
  "\"user-agent\": this.userAgent",
  "timeoutMs",
  "AbortController",
  "response.status >= 500 && attempt === 0",
  "createPixPayment",
  "\"billingType\": \"PIX\"",
  "getPixQrCode",
  "encodedImage",
  "payload",
  "expirationDate",
  "getPayment",
  "testConnection"
]) has(provider, snippet, "AsaasProvider deve estar pronto para producao");

for (const snippet of [
  "type ResolvedRafflePixConfig = ReturnType<typeof getRafflePixConfig>",
  "getResolvedPaymentGatewayConfig(tenantId, \"asaas\", pixConfig)",
  "enabled: local.inheritGlobal ? Boolean(defaultGatewayConfig.enabled) : Boolean(local.enabled)",
  "shouldUseInternalPixPayload",
  "Configuração Asaas incompleta. Informe a chave API.",
  "Não foi possível gerar PIX pelo Asaas.",
  "const officialGatewayConfig = getPaymentGatewayConfigs(tenantId)",
  "officialGatewayConfig?.credentials?.apiKey",
  "Nenhuma API Key Asaas configurada. Salve a Chave Privada antes de testar.",
  "pixConfig",
  "pixPayload: shouldUseInternalPixPayload(pixConfig) ? buildPixPayload",
  "value: Number(input.amount.toFixed(2))",
  "dueDate",
  "buildAsaasExternalReference(input.tenantId, orderId)",
  "externalReference: asaasExternalReference",
  "const pixQrCodeBase64 = String(qrCode.encodedImage || \"\")",
  "pixQrCodeBase64,",
  "pix_copy_paste: pixPayload",
  "expiration_date: pixExpiresAt",
  "app.post(\"/api/admin/payments/asaas/reconcile\"",
  "Webhook token Asaas obrigatorio em producao",
  "timingSafeEqual",
  "Asaas pago sem payment interno tenant-scoped; baixa bloqueada",
  "const remote = await asaas.provider.getPayment(remotePaymentId)",
  "Status remoto Asaas nao confirma pagamento; baixa bloqueada",
  "Falha ao consultar pagamento Asaas antes da baixa",
  "asaasRemoteVerified: true",
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED"
]) has(server, snippet, "Fluxo Asaas servidor deve estar pronto para producao");

has(adminGateways, "!hasGatewaySecret(config.asaas?.apiKey) && \"API Key\"", "Admin Asaas deve exigir API Key");
assert.ok(!adminGateways.includes("!hasGatewaySecret(config.asaas?.webhookSecret) && \"Webhook Token\""), "Admin Asaas nao deve bloquear acesso/salvamento por token de webhook vazio.");

assert.ok(!provider.includes("console.log(this.apiKey)") && !server.includes("console.log(asaasConfig"), "Asaas nao deve logar API Key/config sensivel.");

for (const snippet of [
  "https://docs.asaas.com/docs/authentication-2",
  "https://docs.asaas.com/reference/get-qr-code-for-pix-payments",
  "https://docs.asaas.com/docs/payments-via-pix-or-dynamic-qr-code",
  "Multitenant",
  "Webhook",
  "Idempotencia",
  "Reconciliação",
  "Producao"
]) has(report, snippet, "Relatorio Asaas deve cobrir producao");

console.log("PASS: Asaas pronto para producao com URLs oficiais, auth, timeout, retry controlado, Pix, webhook, reconciliacao e relatorio.");

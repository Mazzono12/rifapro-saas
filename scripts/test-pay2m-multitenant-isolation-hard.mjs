import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(join(root, file), "utf8");

const server = read("server.ts");
const admin = read("src/pages/admin/AdminPaymentGateways.tsx");
const migration = read("supabase/migrations/40_pay2m_pix_gateway.sql");
const provider = read("src/server/payments/Pay2mProvider.ts");

function requireSnippet(source, snippet, label) {
  assert.ok(source.includes(snippet), `${label}: faltando ${snippet}`);
}

function requireRegex(source, regex, label) {
  assert.match(source, regex, label);
}

function blockBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.ok(startIndex >= 0, `Bloco nao encontrado: ${start}`);
  const endIndex = end ? source.indexOf(end, startIndex + start.length) : -1;
  return source.slice(startIndex, endIndex >= 0 ? endIndex : undefined);
}

const pay2mConfigBlock = blockBetween(server, "function getPay2mGatewayConfig", "function getPay2mProvider");
requireSnippet(pay2mConfigBlock, "getDefaultPaymentGatewayConfig(tenantId)", "Pay2M config deve ser por tenant");
requireSnippet(pay2mConfigBlock, "provider !== \"pay2m\" || !config.enabled", "Pay2M config deve respeitar provider ativo do tenant");
requireSnippet(pay2mConfigBlock, "clientId", "Pay2M tenant A/B precisam credenciais separadas");
requireSnippet(pay2mConfigBlock, "clientSecret", "Pay2M tenant A/B precisam segredo separado");

const pay2mAttachBlock = blockBetween(server, "async function attachPay2mPixToOrder", "async function attachActiveGatewayPixToOrder");
for (const snippet of [
  "const pay2m = getPay2mProvider(input.tenantId)",
  "tenant_id: input.tenantId",
  "externalReference: orderId",
  "provider: \"pay2m\"",
  "provider_payment_id: referenceCode",
  "provider_reference: referenceCode",
  "pix_copy_paste: pixPayload",
  "recordPaymentWebhookLog({ tenant_id: input.tenantId"
]) {
  requireSnippet(pay2mAttachBlock, snippet, "Criacao de cobranca/payment Pay2M deve preservar tenant");
}

const webhookBlock = blockBetween(server, "app.post(\"/api/webhooks/pay2m\"", "app.post(\"/api/admin/payments/pay2m/reconcile\"");
for (const snippet of [
  "const tenant = getRequestTenant(req)",
  "const tenantId = tenant?.id || \"unknown\"",
  "getPay2mGatewayConfig(tenant.id)",
  "item.tenant_id === tenantId && String(item.provider) === \"pay2m\" && item.id === eventKey",
  "tenant_id: tenantId",
  "provider: \"pay2m\" as IntegrationProviderId",
  "external_reference: parsed.externalReference",
  "reference_code: parsed.referenceCode",
  "end_to_end: parsed.endToEnd",
  "item.tenant_id === tenantId",
  "item.provider === \"pay2m\"",
  "item.provider_payment_id === parsed.referenceCode",
  "item.provider_reference === parsed.referenceCode",
  "item.order_id === parsed.externalReference",
  "purchases.find(item => item.tenant_id === tenantId && item.purchaseId === payment.order_id)",
  "numberModePurchases.find(item => item.tenant_id === tenantId && item.id === payment.order_id)",
  "fazendinhaCompras.find(item => item.tenant_id === tenantId && item.id === payment.order_id)",
  "raffles.find(item => item.tenant_id === tenantId && item.id === purchase.raffleId)",
  "enqueuePaymentJob({ tenant_id: tenantId, gateway",
  "updatePaymentRecordStatus(tenantId, gateway, payment.order_id",
  "recordPaymentWebhookLog({ tenant_id: tenantId"
]) {
  requireSnippet(webhookBlock, snippet, "Webhook Pay2M deve isolar por tenant");
}

const reconcileBlock = blockBetween(server, "app.post(\"/api/admin/payments/pay2m/reconcile\"", "// Universal Webhook for Payment Gateways");
for (const snippet of [
  "const tenantId = resolveRequestTenantId(req)",
  "item.tenant_id === tenantId && item.provider === \"pay2m\"",
  "getPay2mProvider(tenantId)",
  "enqueuePaymentJob({ tenant_id: tenantId, gateway: \"pay2m\"",
  "updatePaymentRecordStatus(tenantId, \"pay2m\"",
  "recordPaymentWebhookLog({ tenant_id: tenantId"
]) {
  requireSnippet(reconcileBlock, snippet, "Reconciliacao Pay2M deve ser tenant scoped");
}

const queueBlock = blockBetween(server, "function buildPaymentIdempotencyKey", "function markPaymentJob");
for (const snippet of [
  "input.gateway === \"pay2m\"",
  "pay2mMessage?.reference_code",
  "pay2mMessage?.status",
  "pay2mMessage?.end_to_end",
  "return `${input.tenant_id}:${input.gateway}:event:${String(explicitEventId)}`",
  "paymentQueue.find(job => job.tenant_id === input.tenant_id && job.idempotencyKey === idempotencyKey)",
  "tenant_id: input.tenant_id"
]) {
  requireSnippet(queueBlock, snippet, "Idempotencia Pay2M deve incluir tenant/provider/reference/status/e2e");
}

const processBlock = blockBetween(server, "async function processPaymentJob", "app.post(\"/api/webhooks/asaas\"");
for (const snippet of [
  "purchases.find(p => p.tenant_id === job.tenant_id && p.purchaseId === purchaseId)",
  "numberModePurchases.find(item => item.tenant_id === job.tenant_id && item.id === purchaseId)",
  "fazendinhaCompras.find(item => item.tenant_id === job.tenant_id && item.id === purchaseId)",
  "updatePaymentRecordStatus(job.tenant_id, job.gateway, purchaseId",
  "recordPaymentWebhookLog({ tenant_id: job.tenant_id"
]) {
  requireSnippet(processBlock, snippet, "Baixa/liberacao de cotas Pay2M deve respeitar tenant da fila");
}

requireRegex(server, /function updatePaymentRecordStatus[\s\S]*item\.tenant_id === tenantId[\s\S]*item\.provider === provider[\s\S]*item\.order_id === orderId/, "Atualizacao de payment deve filtrar tenant/provider/order.");
requireSnippet(admin, "provider: normalized.active", "Admin deve salvar gateway no config normalizado do tenant autenticado.");
requireSnippet(admin, "normalized.active === \"pay2m\"", "Admin deve suportar configuracao Pay2M separada por tenant.");
requireSnippet(provider, "external_reference: String(payload.externalReference", "Provider deve usar external_reference interno do pedido.");

for (const snippet of [
  "on public.payments (tenant_id, provider, provider_payment_id)",
  "on public.payments (tenant_id, provider, provider_reference)",
  "on public.webhook_events (tenant_id, provider, reference_code, status, coalesce(end_to_end, 'no-e2e'))",
  "where provider = 'pay2m'"
]) {
  requireSnippet(migration, snippet, "Indices Pay2M devem separar tenants");
}

const pay2mPaymentFinds = server.match(/payments\.find\([\s\S]{0,360}?provider === "pay2m"[\s\S]{0,360}?\);/g) || [];
assert.ok(pay2mPaymentFinds.length >= 2, "Auditoria deve encontrar consultas de payments Pay2M.");
for (const query of pay2mPaymentFinds) {
  assert.match(query, /tenant_id === (tenantId|payment\.tenant_id|input\.tenantId)/, `payments.find Pay2M sem tenant_id no mesmo bloco:\n${query}`);
}

const scopedCollectionQueries = [
  ...server.match(/purchases\.find\([\s\S]{0,220}?(?:payment\.order_id|purchaseId)[\s\S]{0,220}?\);/g) || [],
  ...server.match(/numberModePurchases\.find\([\s\S]{0,220}?(?:payment\.order_id|purchaseId)[\s\S]{0,220}?\);/g) || [],
  ...server.match(/fazendinhaCompras\.find\([\s\S]{0,220}?(?:payment\.order_id|purchaseId)[\s\S]{0,220}?\);/g) || []
].filter(query => /pay2m|job\.tenant_id|tenantId/.test(query));

for (const query of scopedCollectionQueries) {
  assert.match(query, /tenant_id === (tenantId|job\.tenant_id)/, `Busca de pedido/cotas sem tenant_id no mesmo bloco:\n${query}`);
}

const pay2mStatusUpdates = server.match(/updatePaymentRecordStatus\([\s\S]{0,120}?"pay2m"[\s\S]{0,120}?\)/g) || [];
assert.ok(pay2mStatusUpdates.length >= 2, "Auditoria deve encontrar updates de status Pay2M.");
for (const updateCall of pay2mStatusUpdates) {
  assert.match(updateCall, /tenantId/, `updatePaymentRecordStatus Pay2M sem tenantId explicito:\n${updateCall}`);
}

console.log("PASS: Pay2M isolado por tenant em configuracao, cobranca, webhook, idempotencia, reconciliacao e liberacao.");

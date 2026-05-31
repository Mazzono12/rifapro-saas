import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const migration = readFileSync("supabase/migrations/42_mercadopago_pix_gateway.sql", "utf8");

const queueStart = server.indexOf("function buildPaymentIdempotencyKey");
const queueEnd = server.indexOf("function markPaymentJob", queueStart);
assert.ok(queueStart >= 0 && queueEnd > queueStart, "Bloco de idempotencia nao encontrado.");
const queueBlock = server.slice(queueStart, queueEnd);

for (const needle of [
  "input.gateway === \"mercadopago\"",
  "mercadoPagoPaymentId",
  "mercadoPagoStatus",
  "return `${input.tenant_id}:${input.gateway}:event:${String(explicitEventId)}`",
  "paymentQueue.find(job => job.tenant_id === input.tenant_id && job.idempotencyKey === idempotencyKey)"
]) assert.ok(queueBlock.includes(needle), `Idempotencia Mercado Pago incompleta: ${needle}`);

const webhookStart = server.indexOf("app.post(\"/api/webhooks/mercadopago\"");
const webhookEnd = server.indexOf("app.post(\"/api/admin/payments/mercadopago/reconcile\"", webhookStart);
const webhookBlock = server.slice(webhookStart, webhookEnd);
for (const needle of [
  "existingEvent?.processed",
  "Webhook Mercado Pago duplicado ignorado por payment/status",
  "queueJob.duplicateReceipt",
  "provider_payment_id: String(remote.id || parsed.paymentId)",
  "status"
]) assert.ok(webhookBlock.includes(needle), `Webhook Mercado Pago sem idempotencia: ${needle}`);

assert.ok(migration.includes("on public.webhook_events (tenant_id, provider, provider_payment_id, status)"), "Migration deve ter indice unico tenant/provider/payment/status.");

console.log("PASS: Mercado Pago idempotente por tenant, provider, provider_payment_id e status.");

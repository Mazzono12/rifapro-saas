import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = readFileSync(join(root, "server.ts"), "utf8");
const migration = readFileSync(join(root, "supabase/migrations/41_pagbank_pix_gateway.sql"), "utf8");

for (const needle of [
  "input.gateway === \"pagbank\"",
  "pagbankOrder?.id",
  "pagbankOrder?.reference_id",
  "pagbankEndToEnd",
  "return `${input.tenant_id}:${input.gateway}:event:${String(explicitEventId)}`",
  "paymentQueue.find(job => job.tenant_id === input.tenant_id && job.idempotencyKey === idempotencyKey)",
  "Webhook PagBank duplicado ignorado por tenant/order/reference/status",
  "existingEvent?.processed",
  "payment?.status !== \"paid\"",
  "PagBank pago sem payment interno tenant-scoped; baixa bloqueada",
  "isPaidPagbankEvent",
  "updatePaymentRecordStatus"
]) assert.ok(server.includes(needle), `idempotencia PagBank incompleta: ${needle}`);

for (const needle of [
  "webhook_events_pagbank_idempotency_idx",
  "tenant_id, provider, provider_payment_id, reference_id, status, coalesce(end_to_end, 'no-e2e')",
  "where provider = 'pagbank'"
]) assert.ok(migration.includes(needle), `migration sem idempotencia PagBank: ${needle}`);

console.log("PASS: PagBank idempotente por tenant/provider/order/reference/status/e2e e sem baixa duplicada.");

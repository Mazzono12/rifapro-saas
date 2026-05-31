import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const migration = readFileSync("supabase/migrations/44_primepag_pix_gateway.sql", "utf8");

for (const needle of [
  "primepagMessage",
  "primepagReferenceCode",
  "primepagStatus",
  "primepagEndToEnd",
  "input.gateway === \"primepag\"",
  "`${primepagReferenceCode}:${primepagStatus}:${primepagEndToEnd}`",
  "tenant_id: tenantId",
  "provider: \"primepag\"",
  "end_to_end: parsed.endToEnd"
]) assert.ok(server.includes(needle), `Idempotencia PrimePag incompleta: ${needle}`);

for (const needle of [
  "webhook_events_primepag_idempotency_idx",
  "tenant_id, provider, provider_payment_id, status, coalesce(end_to_end, 'no-e2e')",
  "where provider = 'primepag'"
]) assert.ok(migration.includes(needle), `Migration PrimePag deve ter idempotencia tenant-scoped: ${needle}`);

console.log("PASS: PrimePag idempotente por tenant, provider, reference_code, status e end_to_end.");

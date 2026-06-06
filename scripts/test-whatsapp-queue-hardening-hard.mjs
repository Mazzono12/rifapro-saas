import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const ui = readFileSync("src/pages/admin/AdminWhatsAppCenter.tsx", "utf8");
const migration = readFileSync("supabase/migrations/50_whatsapp_queue_hardening.sql", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

function includesAll(source, terms, label) {
  for (const term of terms) assert.ok(source.includes(term), `${label}: ausente ${term}`);
}

function blockBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `bloco ausente: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `fim do bloco ausente: ${end}`);
  return source.slice(startIndex, endIndex);
}

includesAll(migration, [
  "create table if not exists public.whatsapp_queue_jobs",
  "create table if not exists public.whatsapp_queue_dead_letter",
  "tenant_id text not null references public.tenants",
  "job_type text not null",
  "payload jsonb not null",
  "status text not null",
  "'queued', 'claimed', 'processing', 'sent', 'failed', 'dead_letter'",
  "attempts integer not null default 0",
  "max_attempts integer not null default 5",
  "claim_token text",
  "claimed_at timestamptz",
  "scheduled_at timestamptz",
  "processed_at timestamptz",
  "unique (tenant_id, job_type, entity_id, event_type)"
], "migration estrutura fila");

includesAll(migration, [
  "idx_whatsapp_queue_jobs_tenant_id",
  "idx_whatsapp_queue_jobs_status",
  "idx_whatsapp_queue_jobs_scheduled_at",
  "idx_whatsapp_queue_jobs_claim_token",
  "idx_whatsapp_queue_jobs_job_type",
  "enable row level security",
  "public.can_access_tenant(tenant_id)"
], "migration indices e RLS");

includesAll(migration, [
  "create or replace function public.claim_whatsapp_queue_jobs",
  "p_job_types text[] default null",
  "job_type = any(p_job_types)",
  "for update skip locked",
  "set status = 'claimed'",
  "claim_token = p_claim_token",
  "claimed_at = now()",
  "create or replace function public.finish_whatsapp_queue_job",
  "and claim_token = p_claim_token",
  "interval '1 minute'",
  "interval '5 minutes'",
  "interval '15 minutes'",
  "interval '1 hour'",
  "status = 'dead_letter'",
  "insert into public.whatsapp_queue_dead_letter"
], "migration claim transacional, backoff e DLQ");

includesAll(server, [
  "WhatsAppQueueJobStatus",
  "WhatsAppQueueDeadLetterRecord",
  "whatsappQueueDeadLetter",
  "canUseSupabaseWhatsAppQueue",
  "canFallbackToMemoryWhatsAppQueue",
  "recordWhatsAppQueueFallback",
  "listWhatsAppQueueJobs",
  "listWhatsAppQueueDeadLetter",
  "getWhatsAppQueueStats",
  "claimWhatsAppQueueJobsFromSupabase",
  "finishWhatsAppQueueJobInSupabase",
  "claimWhatsAppQueueJobs",
  "claimToken = randomUUID()",
  "claim_token = claimToken",
  "claimed_at",
  "assertWhatsAppQueueClaim",
  "finalizeWhatsAppQueueJob",
  "scheduleWhatsAppQueueRetry",
  "moveWhatsAppQueueJobToDeadLetter",
  "retryWhatsAppQueueDeadLetter",
  "buildWhatsAppQueueStats",
  "whatsappQueueBackoffMinutes = [1, 5, 15, 60]",
  "whatsappQueueMaxAttempts = 5"
], "backend infraestrutura multi instancia");

includesAll(server, [
  ".rpc(\"claim_whatsapp_queue_jobs\"",
  ".rpc(\"finish_whatsapp_queue_job\"",
  "p_claim_token: claimToken",
  "if (!claimToken) throw new Error(\"claim_token obrigatorio para finalizar job WhatsApp\")",
  "if (!canFallbackToMemoryWhatsAppQueue()) throw error",
  "backend: \"supabase\"",
  "backend: \"memory\", fallback: true"
], "worker usa Supabase transacional com fallback explicito");

includesAll(server, [
  "app.get(\"/api/admin/whatsapp-center/queue\"",
  "app.get(\"/api/admin/whatsapp-center/queue/stats\"",
  "app.get(\"/api/admin/whatsapp-center/queue/dead-letter\"",
  "app.post(\"/api/admin/whatsapp-center/queue/run\"",
  "app.post(\"/api/admin/whatsapp-center/queue/dead-letter/:id/retry\""
], "endpoints fila hardening");

const queueEndpointBlock = blockBetween(server, 'app.get("/api/admin/whatsapp-center/queue"', 'app.get("/api/admin/whatsapp-center/campaigns"');
includesAll(queueEndpointBlock, [
  "requireWhatsAppCrmCampaignAccess",
  "resolveRequestTenantId(req)",
  "await listWhatsAppQueueJobs(tenantId",
  "await getWhatsAppQueueStats(tenantId)",
  "await listWhatsAppQueueDeadLetter(tenantId)",
  "await retryWhatsAppQueueDeadLetterForTenant(tenantId, req.params.id)"
], "endpoints fila isolados por tenant");

const queueInfraBlock = blockBetween(server, "function canUseSupabaseWhatsAppQueue", "function buildWhatsAppQueueIdempotencyKey");
includesAll(queueInfraBlock, [
  ".from(\"whatsapp_queue_jobs\")",
  ".from(\"whatsapp_queue_dead_letter\")",
  ".eq(\"tenant_id\", tenantId)",
  ".select(\"status,attempts\")",
  ".select(\"id\", { count: \"exact\", head: true })"
], "endpoints e dashboard priorizam tabelas reais");

const mainQueueRunBlock = blockBetween(server, "async function processWhatsAppCenterQueue", "function confirmPurchase");
includesAll(mainQueueRunBlock, [
  "processWhatsAppCenterQueueWithSupabase",
  "claimWhatsAppQueueJobsFromSupabase(tenantId, limit, [\"ticket_confirmation\", \"test\"])",
  "finishWhatsAppQueueJobInSupabase(job.id, claimToken, \"sent\"",
  "finishWhatsAppQueueJobInSupabase(job.id, claimToken, \"failed\"",
  "backend: \"supabase\"",
  "backend: \"memory\", fallback: true"
], "run principal usa claim e finish SQL antes do fallback");

const campaignRunBlock = blockBetween(server, 'app.post("/api/admin/whatsapp-center/campaigns/queue/run"', 'app.get("/api/admin/whatsapp-center/automations"');
includesAll(campaignRunBlock, [
  "claimWhatsAppQueueJobs(tenantId, limit, [\"whatsapp_crm_campaign\"])",
  "finalizeWhatsAppQueueJob(message, claimToken, \"sent\"",
  "scheduleWhatsAppQueueRetry(message, claimToken",
  "finalizeWhatsAppQueueJob(message, claimToken, \"skipped\""
], "campanhas usam claim token sem alterar regra");

const automationRunBlock = blockBetween(server, 'app.post("/api/admin/whatsapp-center/automations/run"', 'app.get("/api/admin/whatsapp-center/contacts/:id"');
includesAll(automationRunBlock, [
  "claimWhatsAppQueueJobs(tenantId, limit, [\"whatsapp_crm_automation\"])",
  "finalizeWhatsAppQueueJob(message, claimToken, \"sent\"",
  "scheduleWhatsAppQueueRetry(message, claimToken",
  "finalizeWhatsAppQueueJob(message, claimToken, \"skipped\""
], "automacoes usam claim token sem alterar regra");

const pixBlock = blockBetween(server, "async function processWhatsappPixRecoveryQueue", "function defaultWhatsAppPurchaseConfirmationSettings");
includesAll(pixBlock, [
  "claimWhatsAppQueueJobs(tenantId, Math.max(1, Math.min(100, limit)), [\"whatsapp_cloud_pix_recovery\"])",
  "finalizeWhatsAppQueueJob(message, claimToken, \"sent\"",
  "scheduleWhatsAppQueueRetry(message, claimToken",
  "finalizeWhatsAppQueueJob(message, claimToken, \"skipped\""
], "recuperacao PIX usa claim token");

const confirmationBlock = blockBetween(server, "async function processWhatsappPurchaseConfirmationQueue", "function handlePurchaseConfirmedWhatsAppCloudEvent");
includesAll(confirmationBlock, [
  "claimWhatsAppQueueJobs(tenantId, Math.max(1, Math.min(100, limit)), [\"whatsapp_cloud_purchase_confirmation\"])",
  "finalizeWhatsAppQueueJob(message, claimToken, \"sent\"",
  "scheduleWhatsAppQueueRetry(message, claimToken",
  "finalizeWhatsAppQueueJob(message, claimToken, \"skipped\""
], "confirmacao usa claim token");

includesAll(ui, [
  "queueQueued",
  "queueProcessing",
  "queueSent",
  "queueFailed",
  "queueDeadLetter",
  "queueRetryRate",
  "queueSuccessRate",
  "Fila pendente",
  "Sucesso fila"
], "dashboard exibe metricas de fila");

includesAll(server, [
  "case \"whatsappQueueDeadLetter\"",
  "whatsappQueueDeadLetter,"
], "DLQ persistida");

for (const forbidden of [
  "/api/admin/checkout",
  "paymentGatewayConfigs =",
  "affiliateWithdrawals =",
  "billing",
  "commission"
]) {
  assert.ok(!queueEndpointBlock.includes(forbidden), `hardening da fila nao deve tocar area proibida: ${forbidden}`);
}

assert.equal(pkg.scripts["test:whatsapp-queue-hardening-hard"], "node scripts/test-whatsapp-queue-hardening-hard.mjs", "script npm ausente");

console.log("[whatsapp-queue-hardening-hard] ok");

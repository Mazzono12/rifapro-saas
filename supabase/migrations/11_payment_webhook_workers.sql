-- Workers reais de pagamento/webhook/reconciliacao PIX.
-- Mantem compatibilidade com a fila existente e adiciona uma tabela generica de jobs de webhook.

alter table if exists public.payment_queue_jobs
  drop constraint if exists payment_queue_jobs_status_check;

alter table if exists public.payment_queue_jobs
  add constraint payment_queue_jobs_status_check
  check (status in ('pending', 'processing', 'paid', 'failed', 'cancelled'));

alter table if exists public.payment_queue_jobs
  add column if not exists idempotency_key text,
  add column if not exists event_status text,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists result jsonb not null default '{}'::jsonb,
  add column if not exists processed_at timestamptz;

create unique index if not exists idx_payment_queue_jobs_idempotency
  on public.payment_queue_jobs (tenant_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_payment_queue_jobs_worker_ready
  on public.payment_queue_jobs (status, next_retry_at, tenant_id);

create table if not exists public.webhook_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  provider text not null,
  gateway text,
  event_type text not null default '',
  purchase_id text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  next_retry_at timestamptz not null default now(),
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  last_error text not null default '',
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_webhook_jobs_idempotency
  on public.webhook_jobs (tenant_id, provider, idempotency_key);

create index if not exists idx_webhook_jobs_worker_ready
  on public.webhook_jobs (status, next_retry_at, tenant_id);

alter table public.webhook_jobs enable row level security;

drop policy if exists webhook_jobs_select on public.webhook_jobs;
drop policy if exists webhook_jobs_insert on public.webhook_jobs;
drop policy if exists webhook_jobs_update on public.webhook_jobs;
drop policy if exists webhook_jobs_delete on public.webhook_jobs;

create policy webhook_jobs_select
  on public.webhook_jobs
  for select
  using (public.can_access_tenant(tenant_id));

create policy webhook_jobs_insert
  on public.webhook_jobs
  for insert
  with check (public.can_access_tenant(tenant_id));

create policy webhook_jobs_update
  on public.webhook_jobs
  for update
  using (public.can_access_tenant(tenant_id))
  with check (public.can_access_tenant(tenant_id));

create policy webhook_jobs_delete
  on public.webhook_jobs
  for delete
  using (public.can_access_tenant(tenant_id));

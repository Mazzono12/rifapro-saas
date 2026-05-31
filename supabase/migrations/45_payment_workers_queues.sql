create table if not exists public.payment_webhook_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  provider text not null,
  event_id text not null,
  event_status text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_retry_at timestamptz not null default now(),
  last_error text not null default '',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_reconciliation_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  provider text not null,
  provider_payment_id text,
  provider_reference text,
  order_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_retry_at timestamptz not null default now(),
  last_error text not null default '',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_release_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  provider text not null,
  purchase_id text not null,
  release_type text not null check (release_type in ('raffle', 'number_mode', 'fazendinha')),
  payment_job_id text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  next_retry_at timestamptz not null default now(),
  last_error text not null default '',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_dead_letter_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  queue text not null,
  source_job_id text not null,
  provider text not null,
  idempotency_key text not null,
  attempts integer not null default 0,
  reason text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists payment_webhook_jobs_tenant_idempotency_idx
  on public.payment_webhook_jobs (tenant_id, provider, idempotency_key);
create unique index if not exists payment_reconciliation_jobs_tenant_idempotency_idx
  on public.payment_reconciliation_jobs (tenant_id, provider, idempotency_key);
create unique index if not exists payment_release_jobs_tenant_idempotency_idx
  on public.payment_release_jobs (tenant_id, provider, idempotency_key);
create index if not exists payment_webhook_jobs_ready_idx
  on public.payment_webhook_jobs (tenant_id, status, next_retry_at);
create index if not exists payment_reconciliation_jobs_ready_idx
  on public.payment_reconciliation_jobs (tenant_id, status, next_retry_at);
create index if not exists payment_release_jobs_ready_idx
  on public.payment_release_jobs (tenant_id, status, next_retry_at);
create index if not exists payment_dead_letter_queue_tenant_idx
  on public.payment_dead_letter_queue (tenant_id, provider, created_at desc);

alter table public.payment_webhook_jobs enable row level security;
alter table public.payment_reconciliation_jobs enable row level security;
alter table public.payment_release_jobs enable row level security;
alter table public.payment_dead_letter_queue enable row level security;

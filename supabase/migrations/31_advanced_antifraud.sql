create table if not exists public.fraud_score_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid,
  order_id text,
  affiliate_id text,
  signal_type text not null,
  severity text not null check (severity in ('low','medium','high')),
  score integer not null default 0 check (score between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.fraud_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid,
  order_id text,
  affiliate_id text,
  signal_type text not null,
  severity text not null check (severity in ('low','medium','high')),
  score integer not null default 0 check (score between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  action text not null default 'log_only',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.fraud_signals
  add column if not exists affiliate_id text,
  add column if not exists score integer default 0 check (score between 0 and 100),
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz;

create index if not exists fraud_score_events_tenant_idx on public.fraud_score_events (tenant_id, score desc, created_at desc);
create index if not exists fraud_cases_tenant_status_idx on public.fraud_cases (tenant_id, status, score desc, created_at desc);
create index if not exists fraud_cases_customer_idx on public.fraud_cases (tenant_id, customer_id, status);

alter table public.fraud_score_events enable row level security;
alter table public.fraud_cases enable row level security;

drop policy if exists fraud_score_events_tenant_access on public.fraud_score_events;
create policy fraud_score_events_tenant_access on public.fraud_score_events
  for all using (public.can_access_tenant(tenant_id))
  with check (public.can_access_tenant(tenant_id));

drop policy if exists fraud_cases_tenant_access on public.fraud_cases;
create policy fraud_cases_tenant_access on public.fraud_cases
  for all using (public.can_access_tenant(tenant_id))
  with check (public.can_access_tenant(tenant_id));

create table if not exists public.automation_flows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  name text not null,
  trigger_type text not null,
  enabled boolean not null default true,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  delay_minutes integer not null default 0,
  max_runs_per_customer integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automation_flows_tenant_trigger_idx on public.automation_flows (tenant_id, trigger_type);
create index if not exists automation_flows_tenant_enabled_idx on public.automation_flows (tenant_id, enabled);

alter table public.automation_flows enable row level security;

drop policy if exists automation_flows_tenant_all on public.automation_flows;
create policy automation_flows_tenant_all
  on public.automation_flows for all
  using (public.can_access_tenant(tenant_id))
  with check (public.can_access_tenant(tenant_id));

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  flow_id uuid not null references public.automation_flows(id),
  customer_id uuid,
  order_id text,
  status text not null default 'scheduled' check (status in ('scheduled','running','completed','failed','skipped')),
  attempts integer not null default 0,
  last_error text,
  scheduled_at timestamptz not null,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  idempotency_key text not null
);

create unique index if not exists automation_runs_idempotency_idx on public.automation_runs (idempotency_key);
create index if not exists automation_runs_tenant_status_idx on public.automation_runs (tenant_id, status, scheduled_at);

alter table public.automation_runs enable row level security;

drop policy if exists automation_runs_tenant_all on public.automation_runs;
create policy automation_runs_tenant_all
  on public.automation_runs for all
  using (public.can_access_tenant(tenant_id))
  with check (public.can_access_tenant(tenant_id));

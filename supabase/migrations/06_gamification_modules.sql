-- Advanced gamification modules. Every table is tenant-scoped.

create table if not exists public.gamification_module_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  raffle_id text not null,
  module text not null,
  status text not null default 'inactive',
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, raffle_id, module)
);

create table if not exists public.gamification_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  raffle_id text not null,
  purchase_id text not null,
  customer_id text,
  module text not null,
  status text not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.gamification_winners (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  raffle_id text not null,
  purchase_id text not null,
  customer_id text,
  module text not null,
  prize text not null,
  value numeric(12,2) not null default 0,
  ticket_number integer,
  created_at timestamptz not null default now(),
  unique (tenant_id, raffle_id, module, purchase_id, prize)
);

create table if not exists public.gamification_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  raffle_id text,
  module text,
  action text not null,
  actor_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_gamification_configs_tenant_raffle on public.gamification_module_configs (tenant_id, raffle_id);
create index if not exists idx_gamification_events_tenant_raffle on public.gamification_events (tenant_id, raffle_id);
create index if not exists idx_gamification_winners_tenant_raffle on public.gamification_winners (tenant_id, raffle_id);
create index if not exists idx_gamification_audit_tenant on public.gamification_audit_logs (tenant_id, created_at desc);

begin;

create table if not exists public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  wallet_owner_type text not null check (wallet_owner_type in ('customer', 'affiliate', 'tenant')),
  wallet_owner_id text not null,
  entry_type text not null check (entry_type in ('credit', 'debit', 'hold', 'release', 'reversal')),
  amount numeric(14,2) not null check (amount >= 0),
  balance_after numeric(14,2) not null check (balance_after >= 0),
  reference_type text,
  reference_id text,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists wallet_ledger_tenant_idempotency_idx
  on public.wallet_ledger (tenant_id, idempotency_key);

create index if not exists wallet_ledger_owner_idx
  on public.wallet_ledger (tenant_id, wallet_owner_type, wallet_owner_id, created_at desc);

create index if not exists wallet_ledger_reference_idx
  on public.wallet_ledger (tenant_id, reference_type, reference_id);

create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  scope text not null,
  idempotency_key text not null,
  resource_type text,
  resource_id text,
  request_hash text,
  response_status integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create unique index if not exists idempotency_keys_scope_key_idx
  on public.idempotency_keys (coalesce(tenant_id::text, 'platform'), scope, idempotency_key);

create index if not exists idempotency_keys_expiry_idx
  on public.idempotency_keys (expires_at)
  where expires_at is not null;

create table if not exists public.tenant_feature_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  flag text not null,
  enabled boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tenant_feature_flags_unique_idx
  on public.tenant_feature_flags (tenant_id, flag);

create table if not exists public.tenant_maintenance_windows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  active boolean not null default false,
  message text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_maintenance_windows_active_idx
  on public.tenant_maintenance_windows (tenant_id, active, starts_at, ends_at);

create table if not exists public.platform_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  component text not null,
  status text not null check (status in ('ok', 'degraded', 'down', 'unknown')),
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create index if not exists platform_health_snapshots_component_idx
  on public.platform_health_snapshots (coalesce(tenant_id::text, 'platform'), component, checked_at desc);

alter table public.wallet_ledger enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.tenant_feature_flags enable row level security;
alter table public.tenant_maintenance_windows enable row level security;
alter table public.platform_health_snapshots enable row level security;

drop policy if exists "tenant scoped wallet ledger select" on public.wallet_ledger;
drop policy if exists "service role wallet ledger insert" on public.wallet_ledger;
drop policy if exists "service role wallet ledger no update" on public.wallet_ledger;
drop policy if exists "service role wallet ledger no delete" on public.wallet_ledger;

create policy "tenant scoped wallet ledger select"
  on public.wallet_ledger
  for select
  using (public.can_access_tenant(tenant_id::text));

create policy "service role wallet ledger insert"
  on public.wallet_ledger
  for insert
  with check (auth.role() = 'service_role');

create policy "service role wallet ledger no update"
  on public.wallet_ledger
  for update
  using (false)
  with check (false);

create policy "service role wallet ledger no delete"
  on public.wallet_ledger
  for delete
  using (false);

drop policy if exists "tenant scoped idempotency select" on public.idempotency_keys;
drop policy if exists "service role idempotency write" on public.idempotency_keys;

create policy "tenant scoped idempotency select"
  on public.idempotency_keys
  for select
  using (tenant_id is null or public.can_access_tenant(tenant_id::text));

create policy "service role idempotency write"
  on public.idempotency_keys
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "tenant scoped feature flags" on public.tenant_feature_flags;
create policy "tenant scoped feature flags"
  on public.tenant_feature_flags
  for all
  using (public.can_access_tenant(tenant_id::text))
  with check (public.can_access_tenant(tenant_id::text));

drop policy if exists "tenant scoped maintenance windows" on public.tenant_maintenance_windows;
create policy "tenant scoped maintenance windows"
  on public.tenant_maintenance_windows
  for all
  using (public.can_access_tenant(tenant_id::text))
  with check (public.can_access_tenant(tenant_id::text));

drop policy if exists "tenant scoped health snapshots select" on public.platform_health_snapshots;
drop policy if exists "service role health snapshots write" on public.platform_health_snapshots;

create policy "tenant scoped health snapshots select"
  on public.platform_health_snapshots
  for select
  using (tenant_id is null or public.can_access_tenant(tenant_id::text));

create policy "service role health snapshots write"
  on public.platform_health_snapshots
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

commit;

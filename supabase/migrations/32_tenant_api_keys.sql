create table if not exists public.tenant_api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  key_hash text not null,
  prefix text not null,
  scopes jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);

create unique index if not exists tenant_api_keys_key_hash_idx
  on public.tenant_api_keys(key_hash);

create index if not exists tenant_api_keys_tenant_active_idx
  on public.tenant_api_keys(tenant_id, active);

create index if not exists tenant_api_keys_prefix_idx
  on public.tenant_api_keys(prefix);

alter table public.tenant_api_keys enable row level security;

drop policy if exists tenant_api_keys_select on public.tenant_api_keys;
create policy tenant_api_keys_select
  on public.tenant_api_keys
  for select
  using (public.can_access_tenant(tenant_id));

drop policy if exists tenant_api_keys_insert on public.tenant_api_keys;
create policy tenant_api_keys_insert
  on public.tenant_api_keys
  for insert
  with check (public.can_access_tenant(tenant_id));

drop policy if exists tenant_api_keys_update on public.tenant_api_keys;
create policy tenant_api_keys_update
  on public.tenant_api_keys
  for update
  using (public.can_access_tenant(tenant_id))
  with check (public.can_access_tenant(tenant_id));

drop policy if exists tenant_api_keys_delete_blocked on public.tenant_api_keys;
create policy tenant_api_keys_delete_blocked
  on public.tenant_api_keys
  for delete
  using (false);

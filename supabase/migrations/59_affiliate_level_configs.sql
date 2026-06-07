create table if not exists public.affiliate_level_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  level_id text not null check (level_id in ('BRONZE', 'PRATA', 'OURO', 'DIAMANTE', 'IMPERADOR', 'LENDARIO')),
  display_name text not null,
  emoji text not null default '',
  commission_rate numeric(7, 4) not null default 0 check (commission_rate >= 0 and commission_rate <= 100),
  minimum_points numeric(14, 2) not null default 0 check (minimum_points >= 0),
  enabled boolean not null default true,
  benefits jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_level_configs_tenant_level_unique unique (tenant_id, level_id)
);

create index if not exists idx_affiliate_level_configs_tenant
  on public.affiliate_level_configs (tenant_id);

create index if not exists idx_affiliate_level_configs_tenant_points
  on public.affiliate_level_configs (tenant_id, minimum_points);

alter table public.affiliate_level_configs enable row level security;

drop policy if exists affiliate_level_configs_tenant_select on public.affiliate_level_configs;
create policy affiliate_level_configs_tenant_select
  on public.affiliate_level_configs
  for select
  using (
    tenant_id = coalesce(nullif(current_setting('request.jwt.claim.tenant_id', true), ''), tenant_id)
  );

drop policy if exists affiliate_level_configs_tenant_admin_write on public.affiliate_level_configs;
create policy affiliate_level_configs_tenant_admin_write
  on public.affiliate_level_configs
  for all
  using (
    tenant_id = coalesce(nullif(current_setting('request.jwt.claim.tenant_id', true), ''), tenant_id)
    and coalesce(current_setting('request.jwt.claim.role', true), '') in ('admin', 'superadmin')
  )
  with check (
    tenant_id = coalesce(nullif(current_setting('request.jwt.claim.tenant_id', true), ''), tenant_id)
    and coalesce(current_setting('request.jwt.claim.role', true), '') in ('admin', 'superadmin')
  );

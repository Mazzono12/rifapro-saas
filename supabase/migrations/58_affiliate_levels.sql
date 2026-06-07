create table if not exists public.affiliate_levels (
  id text primary key,
  tenant_id text not null,
  affiliate_id text not null,
  current_level text not null default 'BRONZE' check (current_level in ('BRONZE', 'PRATA', 'OURO', 'DIAMANTE', 'IMPERADOR', 'LENDARIO')),
  points numeric(14,2) not null default 0 check (points >= 0),
  sales_points numeric(14,2) not null default 0 check (sales_points >= 0),
  network_points numeric(14,2) not null default 0 check (network_points >= 0),
  sponsor_points numeric(14,2) not null default 0 check (sponsor_points >= 0),
  next_level text not null default 'PRATA',
  next_level_points numeric(14,2) not null default 10000 check (next_level_points >= 0),
  progress_percent numeric(5,2) not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_levels_affiliate_unique unique (tenant_id, affiliate_id)
);

create table if not exists public.affiliate_level_history (
  id text primary key,
  tenant_id text not null,
  affiliate_id text not null,
  old_level text not null default 'BRONZE',
  new_level text not null,
  reason text not null default '',
  points numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_affiliate_levels_tenant_level on public.affiliate_levels (tenant_id, current_level);
create index if not exists idx_affiliate_levels_tenant_points on public.affiliate_levels (tenant_id, points desc);
create index if not exists idx_affiliate_level_history_affiliate on public.affiliate_level_history (tenant_id, affiliate_id, created_at desc);

alter table public.affiliate_levels enable row level security;
alter table public.affiliate_level_history enable row level security;

drop policy if exists "affiliate_levels_tenant_access" on public.affiliate_levels;
create policy "affiliate_levels_tenant_access" on public.affiliate_levels
for all
using (auth.jwt() ->> 'role' = 'superadmin' or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId'))
with check (auth.jwt() ->> 'role' = 'superadmin' or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId'));

drop policy if exists "affiliate_level_history_tenant_access" on public.affiliate_level_history;
create policy "affiliate_level_history_tenant_access" on public.affiliate_level_history
for all
using (auth.jwt() ->> 'role' = 'superadmin' or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId'))
with check (auth.jwt() ->> 'role' = 'superadmin' or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId'));

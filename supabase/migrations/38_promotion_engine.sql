-- Commercial promotion engine: tenant-scoped rules, idempotent usages and audit-ready metadata.

create table if not exists public.promotion_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  raffle_id uuid null,
  name text not null,
  type text not null check (type in (
    'double_tickets',
    'buy_and_win',
    'pre_pix_upsell',
    'lucky_hour',
    'abandoned_pix_recovery',
    'package_bonus',
    'affiliate_bonus',
    'first_purchase_bonus',
    'vip_bonus',
    'buyer_ranking'
  )),
  enabled boolean not null default true,
  priority integer not null default 100,
  starts_at timestamptz null,
  ends_at timestamptz null,
  conditions jsonb not null default '{}'::jsonb,
  rewards jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  stackable boolean not null default false,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.promotion_usages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  promotion_id uuid not null references public.promotion_rules(id) on delete cascade,
  raffle_id uuid null,
  customer_id uuid null,
  order_id text null,
  usage_type text not null,
  quantity integer not null default 0,
  amount numeric(12, 2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_promotion_rules_tenant_raffle on public.promotion_rules (tenant_id, raffle_id, enabled, priority);
create index if not exists idx_promotion_rules_type_window on public.promotion_rules (tenant_id, type, starts_at, ends_at);
create index if not exists idx_promotion_usages_tenant_rule on public.promotion_usages (tenant_id, promotion_id, created_at desc);
create index if not exists idx_promotion_usages_customer on public.promotion_usages (tenant_id, customer_id, promotion_id);

create unique index if not exists uq_promotion_usages_order_rule_type
  on public.promotion_usages (tenant_id, promotion_id, coalesce(order_id, ''), usage_type);

create or replace function public.set_promotion_rules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_promotion_rules_updated_at on public.promotion_rules;
create trigger trg_promotion_rules_updated_at
before update on public.promotion_rules
for each row
execute function public.set_promotion_rules_updated_at();

alter table public.promotion_rules enable row level security;
alter table public.promotion_usages enable row level security;

drop policy if exists promotion_rules_tenant_select on public.promotion_rules;
create policy promotion_rules_tenant_select on public.promotion_rules
for select using (
  tenant_id::text = coalesce(current_setting('app.current_tenant_id', true), tenant_id::text)
  or coalesce(current_setting('app.current_role', true), '') in ('superadmin', 'service_role')
);

drop policy if exists promotion_rules_tenant_write on public.promotion_rules;
create policy promotion_rules_tenant_write on public.promotion_rules
for all using (
  tenant_id::text = coalesce(current_setting('app.current_tenant_id', true), tenant_id::text)
  or coalesce(current_setting('app.current_role', true), '') in ('superadmin', 'service_role')
) with check (
  tenant_id::text = coalesce(current_setting('app.current_tenant_id', true), tenant_id::text)
  or coalesce(current_setting('app.current_role', true), '') in ('superadmin', 'service_role')
);

drop policy if exists promotion_usages_tenant_select on public.promotion_usages;
create policy promotion_usages_tenant_select on public.promotion_usages
for select using (
  tenant_id::text = coalesce(current_setting('app.current_tenant_id', true), tenant_id::text)
  or coalesce(current_setting('app.current_role', true), '') in ('superadmin', 'service_role')
);

drop policy if exists promotion_usages_tenant_write on public.promotion_usages;
create policy promotion_usages_tenant_write on public.promotion_usages
for all using (
  tenant_id::text = coalesce(current_setting('app.current_tenant_id', true), tenant_id::text)
  or coalesce(current_setting('app.current_role', true), '') in ('superadmin', 'service_role')
) with check (
  tenant_id::text = coalesce(current_setting('app.current_tenant_id', true), tenant_id::text)
  or coalesce(current_setting('app.current_role', true), '') in ('superadmin', 'service_role')
);

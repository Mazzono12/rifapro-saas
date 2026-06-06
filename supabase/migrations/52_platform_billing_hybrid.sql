-- Billing hibrido SaaS: revenue share da plataforma + add-ons mensais opcionais.

create table if not exists public.platform_commission_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  order_type text not null check (order_type in ('rifa', 'fazendinha', 'number_mode')),
  order_id text not null,
  gross_amount numeric(14,2) not null default 0,
  gateway_fee_amount numeric(14,2) not null default 0,
  commission_mode text not null default 'gross_revenue' check (commission_mode in ('gross_revenue', 'net_after_gateway_fee')),
  commission_rate numeric(6,3) not null default 0,
  commission_amount numeric(14,2) not null default 0,
  status text not null default 'active' check (status in ('active', 'cancelled', 'reversed')),
  reversal_of_entry_id uuid references public.platform_commission_entries(id),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint platform_commission_entries_order_unique unique (tenant_id, order_type, order_id)
);

create table if not exists public.platform_addon_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  addon_key text not null check (addon_key in ('whatsapp_advanced', 'whatsapp_bulk', 'multi_attendant', 'crm_advanced', 'custom_domain', 'white_label', 'affiliates_advanced', 'priority_support')),
  enabled boolean not null default false,
  monthly_price numeric(14,2) not null default 0,
  billing_status text not null default 'cancelled' check (billing_status in ('active', 'pending', 'overdue', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint platform_addon_subscriptions_tenant_addon_unique unique (tenant_id, addon_key)
);

create table if not exists public.platform_addon_charges (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  addon_key text not null check (addon_key in ('whatsapp_advanced', 'whatsapp_bulk', 'multi_attendant', 'crm_advanced', 'custom_domain', 'white_label', 'affiliates_advanced', 'priority_support')),
  amount numeric(14,2) not null default 0,
  period_start date not null,
  period_end date not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'cancelled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint platform_addon_charges_period_unique unique (tenant_id, addon_key, period_start, period_end)
);

create table if not exists public.platform_billing_statements (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  period_start date not null,
  period_end date not null,
  gross_revenue numeric(14,2) not null default 0,
  revenue_share_amount numeric(14,2) not null default 0,
  add_ons_amount numeric(14,2) not null default 0,
  total_due numeric(14,2) not null default 0,
  status text not null default 'open' check (status in ('open', 'closed', 'paid', 'overdue')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint platform_billing_statements_period_unique unique (tenant_id, period_start, period_end)
);

create index if not exists idx_platform_commission_entries_tenant_id on public.platform_commission_entries (tenant_id);
create index if not exists idx_platform_commission_entries_order on public.platform_commission_entries (tenant_id, order_type, order_id);
create index if not exists idx_platform_commission_entries_created_at on public.platform_commission_entries (created_at desc);
create index if not exists idx_platform_commission_entries_status on public.platform_commission_entries (status);

create index if not exists idx_platform_addon_subscriptions_tenant_id on public.platform_addon_subscriptions (tenant_id);
create index if not exists idx_platform_addon_subscriptions_status on public.platform_addon_subscriptions (billing_status);

create index if not exists idx_platform_addon_charges_tenant_period on public.platform_addon_charges (tenant_id, period_start, period_end);
create index if not exists idx_platform_addon_charges_status on public.platform_addon_charges (status);

create index if not exists idx_platform_billing_statements_tenant_period on public.platform_billing_statements (tenant_id, period_start, period_end);
create index if not exists idx_platform_billing_statements_status on public.platform_billing_statements (status);

alter table public.platform_commission_entries enable row level security;
alter table public.platform_addon_subscriptions enable row level security;
alter table public.platform_addon_charges enable row level security;
alter table public.platform_billing_statements enable row level security;

drop policy if exists "platform_commission_entries_tenant_select" on public.platform_commission_entries;
create policy "platform_commission_entries_tenant_select"
on public.platform_commission_entries for select
using (tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id') or auth.jwt() ->> 'role' = 'superadmin');

drop policy if exists "platform_addon_subscriptions_tenant_select" on public.platform_addon_subscriptions;
create policy "platform_addon_subscriptions_tenant_select"
on public.platform_addon_subscriptions for select
using (tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id') or auth.jwt() ->> 'role' = 'superadmin');

drop policy if exists "platform_addon_charges_tenant_select" on public.platform_addon_charges;
create policy "platform_addon_charges_tenant_select"
on public.platform_addon_charges for select
using (tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id') or auth.jwt() ->> 'role' = 'superadmin');

drop policy if exists "platform_billing_statements_tenant_select" on public.platform_billing_statements;
create policy "platform_billing_statements_tenant_select"
on public.platform_billing_statements for select
using (tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id') or auth.jwt() ->> 'role' = 'superadmin');

drop policy if exists "platform_billing_service_write_commission" on public.platform_commission_entries;
create policy "platform_billing_service_write_commission"
on public.platform_commission_entries for all
using (auth.jwt() ->> 'role' in ('superadmin', 'service_role'))
with check (auth.jwt() ->> 'role' in ('superadmin', 'service_role'));

drop policy if exists "platform_billing_service_write_addons" on public.platform_addon_subscriptions;
create policy "platform_billing_service_write_addons"
on public.platform_addon_subscriptions for all
using (auth.jwt() ->> 'role' in ('superadmin', 'service_role'))
with check (auth.jwt() ->> 'role' in ('superadmin', 'service_role'));

drop policy if exists "platform_billing_service_write_charges" on public.platform_addon_charges;
create policy "platform_billing_service_write_charges"
on public.platform_addon_charges for all
using (auth.jwt() ->> 'role' in ('superadmin', 'service_role'))
with check (auth.jwt() ->> 'role' in ('superadmin', 'service_role'));

drop policy if exists "platform_billing_service_write_statements" on public.platform_billing_statements;
create policy "platform_billing_service_write_statements"
on public.platform_billing_statements for all
using (auth.jwt() ->> 'role' in ('superadmin', 'service_role'))
with check (auth.jwt() ->> 'role' in ('superadmin', 'service_role'));

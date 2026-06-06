-- WhatsApp Enterprise - Fase 1: multi-numeros por tenant.

create table if not exists public.whatsapp_cloud_numbers (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  display_name text not null default '',
  phone_number text not null default '',
  phone_number_id text not null,
  waba_id text not null default '',
  business_manager_id text not null default '',
  access_token_encrypted text not null default '',
  app_secret_encrypted text not null default '',
  verify_token_encrypted text not null default '',
  status text not null default 'inactive' check (status in ('active', 'inactive', 'blocked', 'error')),
  quality_rating text not null default 'unknown' check (quality_rating in ('unknown', 'green', 'yellow', 'red')),
  daily_limit integer not null default 1000 check (daily_limit > 0),
  daily_sent_count integer not null default 0 check (daily_sent_count >= 0),
  last_sent_at timestamptz,
  last_error_at timestamptz,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_cloud_numbers_phone_number_id_unique unique (phone_number_id)
);

create table if not exists public.whatsapp_routing_settings (
  tenant_id text primary key,
  whatsapp_routing_mode text not null default 'automatic' check (whatsapp_routing_mode in ('automatic', 'default_number')),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_whatsapp_cloud_numbers_default_unique
on public.whatsapp_cloud_numbers (tenant_id)
where is_default;

create index if not exists idx_whatsapp_cloud_numbers_tenant_id on public.whatsapp_cloud_numbers (tenant_id);
create index if not exists idx_whatsapp_cloud_numbers_phone_number_id on public.whatsapp_cloud_numbers (phone_number_id);
create index if not exists idx_whatsapp_cloud_numbers_status on public.whatsapp_cloud_numbers (status);
create index if not exists idx_whatsapp_cloud_numbers_is_default on public.whatsapp_cloud_numbers (is_default);
create index if not exists idx_whatsapp_routing_settings_tenant_id on public.whatsapp_routing_settings (tenant_id);

alter table public.whatsapp_cloud_numbers enable row level security;
alter table public.whatsapp_routing_settings enable row level security;

drop policy if exists "whatsapp_cloud_numbers_tenant_select" on public.whatsapp_cloud_numbers;
create policy "whatsapp_cloud_numbers_tenant_select"
on public.whatsapp_cloud_numbers for select
using (
  tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  or auth.jwt() ->> 'role' = 'superadmin'
);

drop policy if exists "whatsapp_cloud_numbers_tenant_write" on public.whatsapp_cloud_numbers;
create policy "whatsapp_cloud_numbers_tenant_write"
on public.whatsapp_cloud_numbers for all
using (
  auth.jwt() ->> 'role' in ('superadmin', 'service_role')
  or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id')
)
with check (
  auth.jwt() ->> 'role' in ('superadmin', 'service_role')
  or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

drop policy if exists "whatsapp_routing_settings_tenant_select" on public.whatsapp_routing_settings;
create policy "whatsapp_routing_settings_tenant_select"
on public.whatsapp_routing_settings for select
using (
  tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  or auth.jwt() ->> 'role' = 'superadmin'
);

drop policy if exists "whatsapp_routing_settings_tenant_write" on public.whatsapp_routing_settings;
create policy "whatsapp_routing_settings_tenant_write"
on public.whatsapp_routing_settings for all
using (
  auth.jwt() ->> 'role' in ('superadmin', 'service_role')
  or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id')
)
with check (
  auth.jwt() ->> 'role' in ('superadmin', 'service_role')
  or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

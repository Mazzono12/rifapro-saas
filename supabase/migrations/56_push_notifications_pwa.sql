create table if not exists public.push_subscriptions (
  id text primary key,
  tenant_id text not null,
  customer_id text not null default '',
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  device_type text not null default 'desktop' check (device_type in ('desktop', 'android', 'ios')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint push_subscriptions_tenant_endpoint_unique unique (tenant_id, endpoint)
);

create table if not exists public.push_notifications (
  id text primary key,
  tenant_id text not null,
  customer_id text not null default '',
  title text not null,
  body text not null,
  icon text not null default '',
  image text not null default '',
  action_url text not null default '/',
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'clicked')),
  event_type text not null default 'manual',
  campaign_id text not null default '',
  error text not null default '',
  sent_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.push_campaigns (
  id text primary key,
  tenant_id text not null,
  name text not null,
  title text not null,
  body text not null,
  segment text not null default 'todos' check (segment in ('todos', 'compradores', 'VIP', 'inativos', 'afiliados', 'personalizado')),
  custom_customer_ids text[] not null default '{}',
  icon text not null default '',
  image text not null default '',
  action_url text not null default '/',
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.push_settings (
  tenant_id text primary key,
  enabled boolean not null default true,
  vapid_public_key text not null default '',
  vapid_private_key text not null default '',
  default_icon text not null default '/icons/pwa-icon.svg',
  fallback_order text not null default 'whatsapp_push_internal' check (fallback_order in ('whatsapp_push_internal', 'push_internal', 'internal_only')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_tenant_id on public.push_subscriptions (tenant_id);
create index if not exists idx_push_subscriptions_customer_id on public.push_subscriptions (customer_id);
create index if not exists idx_push_subscriptions_status on public.push_subscriptions (status);
create index if not exists idx_push_subscriptions_created_at on public.push_subscriptions (created_at desc);

create index if not exists idx_push_notifications_tenant_id on public.push_notifications (tenant_id);
create index if not exists idx_push_notifications_customer_id on public.push_notifications (customer_id);
create index if not exists idx_push_notifications_status on public.push_notifications (status);
create index if not exists idx_push_notifications_created_at on public.push_notifications (created_at desc);
create index if not exists idx_push_notifications_campaign_id on public.push_notifications (campaign_id);

create index if not exists idx_push_campaigns_tenant_id on public.push_campaigns (tenant_id);
create index if not exists idx_push_campaigns_status on public.push_campaigns (status);
create index if not exists idx_push_campaigns_created_at on public.push_campaigns (created_at desc);

create index if not exists idx_push_settings_tenant_id on public.push_settings (tenant_id);
create index if not exists idx_push_settings_created_at on public.push_settings (created_at desc);

alter table public.push_subscriptions enable row level security;
alter table public.push_notifications enable row level security;
alter table public.push_campaigns enable row level security;
alter table public.push_settings enable row level security;

drop policy if exists "push_subscriptions_select_tenant" on public.push_subscriptions;
create policy "push_subscriptions_select_tenant"
on public.push_subscriptions
for select
using (
  auth.jwt() ->> 'role' = 'superadmin'
  or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId')
);

drop policy if exists "push_subscriptions_write_tenant" on public.push_subscriptions;
create policy "push_subscriptions_write_tenant"
on public.push_subscriptions
for all
using (
  auth.jwt() ->> 'role' = 'superadmin'
  or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId')
)
with check (
  auth.jwt() ->> 'role' = 'superadmin'
  or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId')
);

drop policy if exists "push_notifications_select_tenant" on public.push_notifications;
create policy "push_notifications_select_tenant"
on public.push_notifications
for select
using (
  auth.jwt() ->> 'role' = 'superadmin'
  or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId')
);

drop policy if exists "push_notifications_write_tenant" on public.push_notifications;
create policy "push_notifications_write_tenant"
on public.push_notifications
for all
using (
  auth.jwt() ->> 'role' = 'superadmin'
  or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId')
)
with check (
  auth.jwt() ->> 'role' = 'superadmin'
  or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId')
);

drop policy if exists "push_campaigns_select_tenant" on public.push_campaigns;
create policy "push_campaigns_select_tenant"
on public.push_campaigns
for select
using (
  auth.jwt() ->> 'role' = 'superadmin'
  or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId')
);

drop policy if exists "push_campaigns_write_tenant" on public.push_campaigns;
create policy "push_campaigns_write_tenant"
on public.push_campaigns
for all
using (
  auth.jwt() ->> 'role' = 'superadmin'
  or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId')
)
with check (
  auth.jwt() ->> 'role' = 'superadmin'
  or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId')
);

drop policy if exists "push_settings_select_tenant" on public.push_settings;
create policy "push_settings_select_tenant"
on public.push_settings
for select
using (
  auth.jwt() ->> 'role' = 'superadmin'
  or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId')
);

drop policy if exists "push_settings_write_tenant" on public.push_settings;
create policy "push_settings_write_tenant"
on public.push_settings
for all
using (
  auth.jwt() ->> 'role' = 'superadmin'
  or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId')
)
with check (
  auth.jwt() ->> 'role' = 'superadmin'
  or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() ->> 'tenantId')
);

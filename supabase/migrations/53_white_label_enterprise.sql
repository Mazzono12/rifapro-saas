-- White Label Enterprise - Fase 1.

create table if not exists public.brand_settings (
  tenant_id text primary key,
  company_name text not null default '',
  display_name text not null default '',
  logo_url text not null default '',
  favicon_url text not null default '',
  primary_color text not null default '#00d66b',
  secondary_color text not null default '#0f2d1d',
  accent_color text not null default '#f5c451',
  success_color text not null default '#22c55e',
  warning_color text not null default '#f59e0b',
  error_color text not null default '#ef4444',
  login_background_url text not null default '',
  custom_css text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  domain text not null,
  subdomain text not null default '',
  status text not null default 'pending' check (status in ('pending', 'verified', 'active', 'failed')),
  ssl_status text not null default 'pending' check (ssl_status in ('pending', 'active', 'failed')),
  dns_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_domains_domain_unique unique (domain),
  constraint tenant_domains_tenant_domain_unique unique (tenant_id, domain)
);

alter table public.tenant_domains add column if not exists subdomain text not null default '';
alter table public.tenant_domains add column if not exists dns_verified_at timestamptz;
alter table public.tenant_domains add column if not exists updated_at timestamptz not null default now();

alter table public.tenant_domains drop constraint if exists tenant_domains_status_check;
alter table public.tenant_domains
  add constraint tenant_domains_status_check
  check (status in ('pending', 'verified', 'active', 'failed', 'disabled'));

alter table public.tenant_domains drop constraint if exists tenant_domains_ssl_status_check;
alter table public.tenant_domains
  add constraint tenant_domains_ssl_status_check
  check (ssl_status in ('pending', 'active', 'issued', 'failed', 'not_configured'));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenant_domains_tenant_domain_unique'
  ) then
    alter table public.tenant_domains
      add constraint tenant_domains_tenant_domain_unique unique (tenant_id, domain);
  end if;
end $$;

create table if not exists public.tenant_seo_settings (
  tenant_id text primary key,
  meta_title text not null default '',
  meta_description text not null default '',
  meta_keywords text not null default '',
  og_title text not null default '',
  og_description text not null default '',
  og_image text not null default '',
  twitter_title text not null default '',
  twitter_description text not null default '',
  twitter_image text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_legal_pages (
  tenant_id text primary key,
  privacy_policy text not null default '',
  terms_of_service text not null default '',
  lgpd_policy text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_landing_settings (
  tenant_id text primary key,
  headline text not null default '',
  subheadline text not null default '',
  about_company text not null default '',
  whatsapp text not null default '',
  instagram text not null default '',
  facebook text not null default '',
  youtube text not null default '',
  telegram text not null default '',
  banner_image text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_brand_settings_tenant_id on public.brand_settings (tenant_id);
create index if not exists idx_tenant_domains_tenant_id on public.tenant_domains (tenant_id);
create index if not exists idx_tenant_domains_domain on public.tenant_domains (domain);
create index if not exists idx_tenant_domains_status on public.tenant_domains (status);
create index if not exists idx_tenant_domains_ssl_status on public.tenant_domains (ssl_status);
create index if not exists idx_tenant_seo_settings_tenant_id on public.tenant_seo_settings (tenant_id);
create index if not exists idx_tenant_legal_pages_tenant_id on public.tenant_legal_pages (tenant_id);
create index if not exists idx_tenant_landing_settings_tenant_id on public.tenant_landing_settings (tenant_id);

alter table public.brand_settings enable row level security;
alter table public.tenant_domains enable row level security;
alter table public.tenant_seo_settings enable row level security;
alter table public.tenant_legal_pages enable row level security;
alter table public.tenant_landing_settings enable row level security;

drop policy if exists "brand_settings_tenant_select" on public.brand_settings;
create policy "brand_settings_tenant_select"
on public.brand_settings for select
using (tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id') or auth.jwt() ->> 'role' = 'superadmin');

drop policy if exists "tenant_domains_tenant_select" on public.tenant_domains;
create policy "tenant_domains_tenant_select"
on public.tenant_domains for select
using (tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id') or auth.jwt() ->> 'role' = 'superadmin');

drop policy if exists "tenant_seo_settings_tenant_select" on public.tenant_seo_settings;
create policy "tenant_seo_settings_tenant_select"
on public.tenant_seo_settings for select
using (tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id') or auth.jwt() ->> 'role' = 'superadmin');

drop policy if exists "tenant_legal_pages_tenant_select" on public.tenant_legal_pages;
create policy "tenant_legal_pages_tenant_select"
on public.tenant_legal_pages for select
using (tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id') or auth.jwt() ->> 'role' = 'superadmin');

drop policy if exists "tenant_landing_settings_tenant_select" on public.tenant_landing_settings;
create policy "tenant_landing_settings_tenant_select"
on public.tenant_landing_settings for select
using (tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id') or auth.jwt() ->> 'role' = 'superadmin');

drop policy if exists "white_label_service_write_brand" on public.brand_settings;
create policy "white_label_service_write_brand"
on public.brand_settings for all
using (auth.jwt() ->> 'role' in ('superadmin', 'service_role') or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
with check (auth.jwt() ->> 'role' in ('superadmin', 'service_role') or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

drop policy if exists "white_label_service_write_domains" on public.tenant_domains;
create policy "white_label_service_write_domains"
on public.tenant_domains for all
using (auth.jwt() ->> 'role' in ('superadmin', 'service_role') or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
with check (auth.jwt() ->> 'role' in ('superadmin', 'service_role') or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

drop policy if exists "white_label_service_write_seo" on public.tenant_seo_settings;
create policy "white_label_service_write_seo"
on public.tenant_seo_settings for all
using (auth.jwt() ->> 'role' in ('superadmin', 'service_role') or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
with check (auth.jwt() ->> 'role' in ('superadmin', 'service_role') or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

drop policy if exists "white_label_service_write_legal" on public.tenant_legal_pages;
create policy "white_label_service_write_legal"
on public.tenant_legal_pages for all
using (auth.jwt() ->> 'role' in ('superadmin', 'service_role') or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
with check (auth.jwt() ->> 'role' in ('superadmin', 'service_role') or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

drop policy if exists "white_label_service_write_landing" on public.tenant_landing_settings;
create policy "white_label_service_write_landing"
on public.tenant_landing_settings for all
using (auth.jwt() ->> 'role' in ('superadmin', 'service_role') or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id'))
with check (auth.jwt() ->> 'role' in ('superadmin', 'service_role') or tenant_id = coalesce(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

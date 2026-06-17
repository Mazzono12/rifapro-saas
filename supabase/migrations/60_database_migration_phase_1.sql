-- Database Migration Phase 1
-- Fonte de verdade PostgreSQL para entidades criticas iniciais do runtime CIFHER/RifaPro.
-- Mantem IDs textuais atuais do app para evitar impacto em checkout, PIX, webhook e pedidos.

create table if not exists public.app_tenants (
  id text primary key,
  nome text not null default '',
  slug text not null default '',
  dominio text,
  dominio_customizado text not null default '',
  status text not null default 'active',
  plano text not null default 'starter',
  logo_url text not null default '',
  cor_primaria text not null default '#00d66b',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists app_tenants_slug_idx on public.app_tenants (slug);
create index if not exists app_tenants_status_idx on public.app_tenants (status);
create index if not exists app_tenants_dominio_idx on public.app_tenants (dominio) where dominio is not null;

create table if not exists public.tenant_settings (
  tenant_id text primary key references public.app_tenants(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_branding_settings (
  tenant_id text primary key references public.app_tenants(id) on delete cascade,
  company_name text not null default '',
  display_name text not null default '',
  header_name text not null default '',
  logo_url text not null default '',
  favicon_url text not null default '',
  primary_color text not null default '#00d66b',
  secondary_color text not null default '#0f2d1d',
  cta_color text not null default '#00d66b',
  branding jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_raffles (
  id text primary key,
  tenant_id text not null references public.app_tenants(id) on delete cascade,
  title text not null default '',
  status text not null default 'draft',
  total_tickets integer not null default 0,
  ticket_price numeric(14,2) not null default 0,
  sold_tickets integer not null default 0,
  draw_date timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_raffles_tenant_idx on public.app_raffles (tenant_id);
create index if not exists app_raffles_tenant_status_idx on public.app_raffles (tenant_id, status);
create index if not exists app_raffles_updated_idx on public.app_raffles (updated_at desc);

create table if not exists public.app_payment_gateway_configs (
  id text primary key,
  tenant_id text not null references public.app_tenants(id) on delete cascade,
  provider text not null,
  display_name text not null default '',
  enabled boolean not null default true,
  is_default boolean not null default false,
  priority integer not null default 0,
  environment text not null default 'production',
  credentials jsonb not null default '{}'::jsonb,
  webhook_secret text not null default '',
  pix_key text not null default '',
  config_json jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_payment_gateway_configs_environment_check
    check (environment in ('production', 'sandbox', 'staging', 'mock'))
);

create index if not exists app_payment_gateway_configs_tenant_idx
  on public.app_payment_gateway_configs (tenant_id);

create index if not exists app_payment_gateway_configs_tenant_provider_idx
  on public.app_payment_gateway_configs (tenant_id, provider);

create unique index if not exists app_payment_gateway_configs_one_default_per_tenant_idx
  on public.app_payment_gateway_configs (tenant_id)
  where is_default;

create or replace function public.touch_phase1_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_tenants_touch_updated_at on public.app_tenants;
create trigger app_tenants_touch_updated_at
  before update on public.app_tenants
  for each row execute function public.touch_phase1_updated_at();

drop trigger if exists tenant_settings_touch_updated_at on public.tenant_settings;
create trigger tenant_settings_touch_updated_at
  before update on public.tenant_settings
  for each row execute function public.touch_phase1_updated_at();

drop trigger if exists tenant_branding_settings_touch_updated_at on public.tenant_branding_settings;
create trigger tenant_branding_settings_touch_updated_at
  before update on public.tenant_branding_settings
  for each row execute function public.touch_phase1_updated_at();

drop trigger if exists app_raffles_touch_updated_at on public.app_raffles;
create trigger app_raffles_touch_updated_at
  before update on public.app_raffles
  for each row execute function public.touch_phase1_updated_at();

drop trigger if exists app_payment_gateway_configs_touch_updated_at on public.app_payment_gateway_configs;
create trigger app_payment_gateway_configs_touch_updated_at
  before update on public.app_payment_gateway_configs
  for each row execute function public.touch_phase1_updated_at();

alter table public.app_tenants enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.tenant_branding_settings enable row level security;
alter table public.app_raffles enable row level security;
alter table public.app_payment_gateway_configs enable row level security;

drop policy if exists app_tenants_phase1_select on public.app_tenants;
create policy app_tenants_phase1_select on public.app_tenants
  for select using (public.is_service_role() or public.jwt_app_role() = 'superadmin' or id = public.jwt_tenant_id_text());

drop policy if exists app_tenants_phase1_write on public.app_tenants;
create policy app_tenants_phase1_write on public.app_tenants
  for all using (public.is_service_role() or public.jwt_app_role() = 'superadmin')
  with check (public.is_service_role() or public.jwt_app_role() = 'superadmin');

drop policy if exists tenant_settings_phase1_access on public.tenant_settings;
create policy tenant_settings_phase1_access on public.tenant_settings
  for all using (public.can_access_tenant(tenant_id))
  with check (public.can_access_tenant(tenant_id));

drop policy if exists tenant_branding_settings_phase1_access on public.tenant_branding_settings;
create policy tenant_branding_settings_phase1_access on public.tenant_branding_settings
  for all using (public.can_access_tenant(tenant_id))
  with check (public.can_access_tenant(tenant_id));

drop policy if exists app_raffles_phase1_access on public.app_raffles;
create policy app_raffles_phase1_access on public.app_raffles
  for all using (public.can_access_tenant(tenant_id))
  with check (public.can_access_tenant(tenant_id));

drop policy if exists app_payment_gateway_configs_phase1_access on public.app_payment_gateway_configs;
create policy app_payment_gateway_configs_phase1_access on public.app_payment_gateway_configs
  for all using (public.can_access_tenant(tenant_id))
  with check (public.can_access_tenant(tenant_id));

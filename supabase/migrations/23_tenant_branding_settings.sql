create table if not exists public.tenant_branding_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  header_name text,
  logo_url text,
  logo_mime_type text,
  favicon_url text,
  primary_color text,
  secondary_color text,
  cta_color text,
  theme_mode text default 'premium' check (theme_mode in ('dark', 'light', 'premium')),
  slogan text,
  support_whatsapp text,
  footer_text text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint tenant_branding_settings_tenant_unique unique (tenant_id)
);

alter table public.tenant_branding_settings enable row level security;

drop policy if exists "tenant branding select own tenant" on public.tenant_branding_settings;
create policy "tenant branding select own tenant"
  on public.tenant_branding_settings for select
  using (
    auth.role() = 'service_role'
    or public.is_superadmin()
    or tenant_id = public.current_tenant_id()
  );

drop policy if exists "tenant branding admin update own tenant" on public.tenant_branding_settings;
create policy "tenant branding admin update own tenant"
  on public.tenant_branding_settings for update
  using (
    auth.role() = 'service_role'
    or public.is_superadmin()
    or (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'operador'))
  )
  with check (
    auth.role() = 'service_role'
    or public.is_superadmin()
    or (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'operador'))
  );

drop policy if exists "tenant branding admin insert own tenant" on public.tenant_branding_settings;
create policy "tenant branding admin insert own tenant"
  on public.tenant_branding_settings for insert
  with check (
    auth.role() = 'service_role'
    or public.is_superadmin()
    or (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'operador'))
  );

create index if not exists idx_tenant_branding_settings_tenant
  on public.tenant_branding_settings(tenant_id);

create or replace function public.touch_tenant_branding_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tenant_branding_settings_updated_at on public.tenant_branding_settings;
create trigger trg_tenant_branding_settings_updated_at
before update on public.tenant_branding_settings
for each row execute function public.touch_tenant_branding_settings_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-assets',
  'tenant-assets',
  true,
  4194304,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

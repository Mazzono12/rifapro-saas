create table if not exists public.tenant_theme_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  theme_key text not null,
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists tenant_theme_templates_tenant_active_idx
  on public.tenant_theme_templates(tenant_id, active);

create index if not exists tenant_theme_templates_theme_key_idx
  on public.tenant_theme_templates(theme_key);

create unique index if not exists tenant_theme_templates_one_active_per_tenant_idx
  on public.tenant_theme_templates(tenant_id)
  where active is true and tenant_id is not null;

alter table public.tenant_theme_templates enable row level security;

drop policy if exists tenant_theme_templates_select on public.tenant_theme_templates;
create policy tenant_theme_templates_select
  on public.tenant_theme_templates
  for select
  using (tenant_id is null or public.can_access_tenant(tenant_id));

drop policy if exists tenant_theme_templates_insert on public.tenant_theme_templates;
create policy tenant_theme_templates_insert
  on public.tenant_theme_templates
  for insert
  with check (tenant_id is null or public.can_access_tenant(tenant_id));

drop policy if exists tenant_theme_templates_update on public.tenant_theme_templates;
create policy tenant_theme_templates_update
  on public.tenant_theme_templates
  for update
  using (tenant_id is null or public.can_access_tenant(tenant_id))
  with check (tenant_id is null or public.can_access_tenant(tenant_id));

drop policy if exists tenant_theme_templates_delete_blocked on public.tenant_theme_templates;
create policy tenant_theme_templates_delete_blocked
  on public.tenant_theme_templates
  for delete
  using (false);

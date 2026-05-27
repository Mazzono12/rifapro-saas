-- Autenticacao SaaS multitenant com Supabase Auth.
-- Espelha auth.users em public.usuarios e aplica RLS por tenant.

create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id),
  nome text,
  email text unique,
  role text,
  ativo boolean default true,
  created_at timestamptz default now()
);

alter table public.usuarios add column if not exists tenant_id uuid references public.tenants(id);
alter table public.usuarios add column if not exists nome text;
alter table public.usuarios add column if not exists email text unique;
alter table public.usuarios add column if not exists role text;
alter table public.usuarios add column if not exists ativo boolean default true;
alter table public.usuarios add column if not exists created_at timestamptz default now();

alter table public.usuarios
  drop constraint if exists usuarios_role_check;

alter table public.usuarios
  add constraint usuarios_role_check
  check (role in ('superadmin', 'admin', 'operador', 'afiliado', 'tenant_admin', 'tenant_user'));

create index if not exists usuarios_tenant_id_idx on public.usuarios (tenant_id);
create index if not exists usuarios_tenant_role_idx on public.usuarios (tenant_id, role);
create index if not exists usuarios_ativo_idx on public.usuarios (ativo);
create unique index if not exists usuarios_email_unique_idx on public.usuarios (lower(email));

alter table public.usuarios enable row level security;

drop policy if exists usuarios_saas_select on public.usuarios;
drop policy if exists usuarios_saas_insert on public.usuarios;
drop policy if exists usuarios_saas_update on public.usuarios;
drop policy if exists usuarios_saas_delete on public.usuarios;

create policy usuarios_saas_select
  on public.usuarios
  for select
  using (
    public.is_service_role()
    or public.jwt_app_role() = 'superadmin'
    or id = auth.uid()
    or public.can_access_tenant(tenant_id::text)
  );

create policy usuarios_saas_insert
  on public.usuarios
  for insert
  with check (
    public.is_service_role()
    or public.jwt_app_role() = 'superadmin'
    or public.can_access_tenant(tenant_id::text)
  );

create policy usuarios_saas_update
  on public.usuarios
  for update
  using (
    public.is_service_role()
    or public.jwt_app_role() = 'superadmin'
    or id = auth.uid()
    or public.can_access_tenant(tenant_id::text)
  )
  with check (
    public.is_service_role()
    or public.jwt_app_role() = 'superadmin'
    or id = auth.uid()
    or public.can_access_tenant(tenant_id::text)
  );

create policy usuarios_saas_delete
  on public.usuarios
  for delete
  using (public.is_service_role() or public.jwt_app_role() = 'superadmin');

insert into public.usuarios (id, tenant_id, nome, email, role, ativo)
select
  auth.users.id,
  null,
  coalesce(auth.users.raw_user_meta_data ->> 'nome', 'Superadmin Inicial'),
  auth.users.email,
  'superadmin',
  true
from auth.users
where lower(auth.users.email) = lower(coalesce(nullif(current_setting('app.seed_superadmin_email', true), ''), auth.users.email))
on conflict (id) do nothing;


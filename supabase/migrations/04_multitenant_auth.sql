-- Base multitenant de autenticacao e autorizacao.
-- Consolida o acesso futuro em usuarios/tenants sem armazenar senha em texto puro.

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  dominio_customizado text,
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  logo_url text,
  cor_primaria text not null default '#06b6d4',
  plano text not null default 'basico',
  percentual_plataforma numeric(5,2) not null default 0 check (percentual_plataforma >= 0 and percentual_plataforma <= 100),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.tenants add column if not exists slug text;
alter table public.tenants add column if not exists dominio_customizado text;
alter table public.tenants add column if not exists status text not null default 'active';
alter table public.tenants add column if not exists logo_url text;
alter table public.tenants add column if not exists cor_primaria text not null default '#06b6d4';
alter table public.tenants add column if not exists plano text not null default 'basico';
alter table public.tenants add column if not exists percentual_plataforma numeric(5,2) not null default 0;
alter table public.tenants add column if not exists atualizado_em timestamptz not null default now();

insert into public.tenants (id, nome, slug, status, cor_primaria, plano, percentual_plataforma)
values
  ('00000000-0000-0000-0000-000000000001', 'Plataforma Principal', 'principal', 'active', '#06b6d4', 'plataforma', 0),
  ('00000000-0000-0000-0000-000000000002', 'Cliente A', 'cliente-a', 'active', '#10b981', 'teste', 10),
  ('00000000-0000-0000-0000-000000000003', 'Cliente B', 'cliente-b', 'active', '#f59e0b', 'teste', 10)
on conflict (id) do update set
  nome = excluded.nome,
  slug = excluded.slug,
  status = excluded.status,
  cor_primaria = excluded.cor_primaria,
  plano = excluded.plano,
  percentual_plataforma = excluded.percentual_plataforma,
  atualizado_em = now();

create unique index if not exists tenants_slug_unique_idx on public.tenants (slug);

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  senha_hash text not null,
  role text not null default 'tenant_user',
  tenant_id uuid references public.tenants(id),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table public.usuarios add column if not exists nome text;
alter table public.usuarios add column if not exists email text;
alter table public.usuarios add column if not exists senha_hash text;
alter table public.usuarios add column if not exists tenant_id uuid references public.tenants(id);
alter table public.usuarios add column if not exists ativo boolean not null default true;
alter table public.usuarios add column if not exists criado_em timestamptz not null default now();

alter table public.usuarios alter column role drop default;
alter table public.usuarios alter column role type text using role::text;
update public.usuarios set role = 'tenant_admin' where role = 'admin';
update public.usuarios set role = 'tenant_user' where role = 'user';
update public.usuarios
set tenant_id = '00000000-0000-0000-0000-000000000001'
where tenant_id is null and role <> 'superadmin';
alter table public.usuarios alter column role set default 'tenant_user';
alter table public.usuarios drop constraint if exists usuarios_role_check;
alter table public.usuarios add constraint usuarios_role_check
  check (role in ('superadmin', 'tenant_admin', 'tenant_user'));
alter table public.usuarios add constraint usuarios_tenant_role_check
  check (
    (role = 'superadmin' and tenant_id is null) or
    (role in ('tenant_admin', 'tenant_user') and tenant_id is not null)
  );

create unique index if not exists usuarios_email_unique_ci
  on public.usuarios (lower(email));
create index if not exists usuarios_tenant_role_idx
  on public.usuarios (tenant_id, role, ativo);

alter table public.tenants enable row level security;
alter table public.usuarios enable row level security;

create or replace function public.jwt_app_role()
returns text language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', '');
$$;

create or replace function public.jwt_tenant_id()
returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'tenant_id', '')::uuid;
$$;

drop policy if exists "superadmin manages tenants" on public.tenants;
create policy "superadmin manages tenants" on public.tenants
  for all using (public.jwt_app_role() = 'superadmin')
  with check (public.jwt_app_role() = 'superadmin');

drop policy if exists "tenant admin reads own tenant" on public.tenants;
create policy "tenant admin reads own tenant" on public.tenants
  for select using (
    public.jwt_app_role() in ('tenant_admin', 'tenant_user')
    and id = public.jwt_tenant_id()
  );

drop policy if exists "superadmin manages usuarios" on public.usuarios;
create policy "superadmin manages usuarios" on public.usuarios
  for all using (public.jwt_app_role() = 'superadmin')
  with check (public.jwt_app_role() = 'superadmin');

drop policy if exists "tenant admin reads own usuarios" on public.usuarios;
create policy "tenant admin reads own usuarios" on public.usuarios
  for select using (
    public.jwt_app_role() = 'tenant_admin'
    and tenant_id = public.jwt_tenant_id()
  );

drop policy if exists "tenant user reads own usuario" on public.usuarios;
create policy "tenant user reads own usuario" on public.usuarios
  for select using (
    public.jwt_app_role() = 'tenant_user'
    and tenant_id = public.jwt_tenant_id()
    and id = auth.uid()
  );

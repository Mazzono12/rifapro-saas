-- Fundacao SaaS multitenant profissional.
-- Garante tenants, tenant_id nas tabelas operacionais, indices e RLS tenant-scoped.

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique not null,
  dominio text unique,
  ativo boolean default true,
  plano text default 'starter',
  created_at timestamptz default now()
);

alter table public.tenants add column if not exists nome text;
alter table public.tenants add column if not exists slug text;
alter table public.tenants add column if not exists dominio text;
alter table public.tenants add column if not exists ativo boolean default true;
alter table public.tenants add column if not exists plano text default 'starter';
alter table public.tenants add column if not exists created_at timestamptz default now();

create unique index if not exists tenants_slug_unique_idx on public.tenants (slug);
create unique index if not exists tenants_dominio_unique_idx on public.tenants (dominio) where dominio is not null;
create index if not exists tenants_ativo_idx on public.tenants (ativo);

insert into public.tenants (id, nome, slug, dominio, ativo, plano)
values ('00000000-0000-0000-0000-000000000001', 'Tenant Desenvolvimento', 'dev', null, true, 'starter')
on conflict (id) do update set
  nome = excluded.nome,
  slug = excluded.slug,
  ativo = excluded.ativo,
  plano = excluded.plano;

create or replace function public.jwt_app_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'role', auth.role(), '');
$$;

create or replace function public.jwt_tenant_id_text()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'tenant_id', '');
$$;

create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select auth.role() = 'service_role';
$$;

create or replace function public.can_access_tenant(p_tenant_id text)
returns boolean
language sql
stable
as $$
  select
    public.is_service_role()
    or public.jwt_app_role() = 'superadmin'
    or (
      public.jwt_app_role() in ('tenant_admin', 'tenant_user')
      and p_tenant_id = public.jwt_tenant_id_text()
    );
$$;

create or replace function public.create_tenant_operational_table(p_table_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  execute format(
    'create table if not exists public.%I (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid references public.tenants(id),
      payload jsonb not null default ''{}''::jsonb,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )',
    p_table_name
  );
end;
$$;

select public.create_tenant_operational_table('campanhas');
select public.create_tenant_operational_table('rifas');
select public.create_tenant_operational_table('pedidos');
select public.create_tenant_operational_table('pagamentos');
select public.create_tenant_operational_table('afiliados');
select public.create_tenant_operational_table('webhooks');
select public.create_tenant_operational_table('automacoes');
select public.create_tenant_operational_table('logs');

alter table public.clientes add column if not exists tenant_id uuid references public.tenants(id);

update public.clientes
set tenant_id = '00000000-0000-0000-0000-000000000001'
where tenant_id is null;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'clientes',
    'campanhas',
    'rifas',
    'pedidos',
    'pagamentos',
    'afiliados',
    'webhooks',
    'automacoes',
    'logs'
  ]
  loop
    execute format('create index if not exists %I on public.%I (tenant_id)', table_name || '_tenant_id_idx', table_name);
    execute format('create index if not exists %I on public.%I (tenant_id, created_at desc)', table_name || '_tenant_created_idx', table_name);
  end loop;
end;
$$;

create index if not exists campanhas_tenant_status_idx on public.campanhas (tenant_id, (payload ->> 'status'));
create index if not exists rifas_tenant_status_idx on public.rifas (tenant_id, (payload ->> 'status'));
create index if not exists pedidos_tenant_status_idx on public.pedidos (tenant_id, (payload ->> 'status'));
create index if not exists pagamentos_tenant_status_idx on public.pagamentos (tenant_id, (payload ->> 'status'));
create index if not exists webhooks_tenant_provider_idx on public.webhooks (tenant_id, (payload ->> 'provider'));
create index if not exists logs_tenant_action_idx on public.logs (tenant_id, (payload ->> 'action'), created_at desc);

alter table public.tenants enable row level security;
alter table public.clientes enable row level security;
alter table public.campanhas enable row level security;
alter table public.rifas enable row level security;
alter table public.pedidos enable row level security;
alter table public.pagamentos enable row level security;
alter table public.afiliados enable row level security;
alter table public.webhooks enable row level security;
alter table public.automacoes enable row level security;
alter table public.logs enable row level security;

drop policy if exists tenants_saas_select on public.tenants;
drop policy if exists tenants_saas_insert on public.tenants;
drop policy if exists tenants_saas_update on public.tenants;
drop policy if exists tenants_saas_delete on public.tenants;

create policy tenants_saas_select
  on public.tenants
  for select
  using (
    public.is_service_role()
    or public.jwt_app_role() = 'superadmin'
    or id::text = public.jwt_tenant_id_text()
  );

create policy tenants_saas_insert
  on public.tenants
  for insert
  with check (public.is_service_role() or public.jwt_app_role() = 'superadmin');

create policy tenants_saas_update
  on public.tenants
  for update
  using (public.is_service_role() or public.jwt_app_role() = 'superadmin')
  with check (public.is_service_role() or public.jwt_app_role() = 'superadmin');

create policy tenants_saas_delete
  on public.tenants
  for delete
  using (public.is_service_role() or public.jwt_app_role() = 'superadmin');

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'clientes',
    'campanhas',
    'rifas',
    'pedidos',
    'pagamentos',
    'afiliados',
    'webhooks',
    'automacoes',
    'logs'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_saas_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_saas_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_saas_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_saas_delete', table_name);

    execute format(
      'create policy %I on public.%I for select using (public.can_access_tenant(tenant_id::text))',
      table_name || '_saas_select',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert with check (public.can_access_tenant(tenant_id::text))',
      table_name || '_saas_insert',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update using (public.can_access_tenant(tenant_id::text)) with check (public.can_access_tenant(tenant_id::text))',
      table_name || '_saas_update',
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete using (public.can_access_tenant(tenant_id::text))',
      table_name || '_saas_delete',
      table_name
    );
  end loop;
end;
$$;

drop function if exists public.create_tenant_operational_table(text);

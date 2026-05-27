-- Strong multitenant RLS.
-- Frontend must not provide tenant_id. The API resolves tenant by JWT/domain and
-- backend service role writes trusted tenant_id. Direct Supabase access is limited
-- by JWT claims: role + tenant_id.

begin;

create or replace function public.jwt_app_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'role', auth.jwt() ->> 'app_role', '');
$$;

create or replace function public.jwt_tenant_id_text()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'tenant_id', '');
$$;

create or replace function public.is_app_superadmin()
returns boolean
language sql
stable
as $$
  select public.jwt_app_role() = 'superadmin';
$$;

create or replace function public.can_access_tenant(p_tenant_id text)
returns boolean
language sql
stable
as $$
  select
    auth.role() = 'service_role'
    or public.is_app_superadmin()
    or (
      public.jwt_app_role() in ('tenant_admin', 'tenant_user')
      and p_tenant_id = public.jwt_tenant_id_text()
    );
$$;

-- Tenants: superadmin sees all; tenant roles see only their tenant.
alter table public.tenants enable row level security;

drop policy if exists "superadmin manages tenants" on public.tenants;
drop policy if exists "tenant admin reads own tenant" on public.tenants;
drop policy if exists "tenant scoped tenants select" on public.tenants;
drop policy if exists "superadmin tenants write" on public.tenants;

create policy "tenant scoped tenants select"
  on public.tenants
  for select
  using (
    auth.role() = 'service_role'
    or public.is_app_superadmin()
    or id::text = public.jwt_tenant_id_text()
  );

create policy "superadmin tenants write"
  on public.tenants
  for all
  using (auth.role() = 'service_role' or public.is_app_superadmin())
  with check (auth.role() = 'service_role' or public.is_app_superadmin());

-- Usuarios: superadmin sees all; tenant_admin sees own tenant; tenant_user sees self.
alter table public.usuarios enable row level security;

drop policy if exists "superadmin manages usuarios" on public.usuarios;
drop policy if exists "tenant admin reads own usuarios" on public.usuarios;
drop policy if exists "tenant user reads own usuario" on public.usuarios;
drop policy if exists "tenant scoped usuarios select" on public.usuarios;
drop policy if exists "tenant scoped usuarios write" on public.usuarios;

create policy "tenant scoped usuarios select"
  on public.usuarios
  for select
  using (
    auth.role() = 'service_role'
    or public.is_app_superadmin()
    or (
      public.jwt_app_role() = 'tenant_admin'
      and tenant_id::text = public.jwt_tenant_id_text()
    )
    or (
      public.jwt_app_role() = 'tenant_user'
      and tenant_id::text = public.jwt_tenant_id_text()
      and id = auth.uid()
    )
  );

create policy "tenant scoped usuarios write"
  on public.usuarios
  for all
  using (
    auth.role() = 'service_role'
    or public.is_app_superadmin()
    or (
      public.jwt_app_role() = 'tenant_admin'
      and tenant_id::text = public.jwt_tenant_id_text()
    )
  )
  with check (
    auth.role() = 'service_role'
    or public.is_app_superadmin()
    or (
      public.jwt_app_role() = 'tenant_admin'
      and tenant_id::text = public.jwt_tenant_id_text()
    )
  );

-- Apply tenant scoped policies to every public table that has tenant_id.
-- Existing broad/public policies are dropped first because PostgreSQL combines
-- permissive policies with OR.
do $$
declare
  table_record record;
  policy_record record;
begin
  for table_record in
    select table_schema, table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'tenant_id'
      and table_name not in ('tenants', 'usuarios', 'persistent_state_records')
    group by table_schema, table_name
  loop
    execute format('alter table %I.%I enable row level security', table_record.table_schema, table_record.table_name);

    for policy_record in
      select policyname
      from pg_policies
      where schemaname = table_record.table_schema
        and tablename = table_record.table_name
    loop
      execute format(
        'drop policy if exists %I on %I.%I',
        policy_record.policyname,
        table_record.table_schema,
        table_record.table_name
      );
    end loop;

    execute format(
      'create policy %I on %I.%I for select using (public.can_access_tenant(tenant_id::text))',
      'tenant scoped select',
      table_record.table_schema,
      table_record.table_name
    );

    execute format(
      'create policy %I on %I.%I for insert with check (public.can_access_tenant(tenant_id::text))',
      'tenant scoped insert',
      table_record.table_schema,
      table_record.table_name
    );

    execute format(
      'create policy %I on %I.%I for update using (public.can_access_tenant(tenant_id::text)) with check (public.can_access_tenant(tenant_id::text))',
      'tenant scoped update',
      table_record.table_schema,
      table_record.table_name
    );

    execute format(
      'create policy %I on %I.%I for delete using (public.can_access_tenant(tenant_id::text))',
      'tenant scoped delete',
      table_record.table_schema,
      table_record.table_name
    );
  end loop;
end $$;

-- Persistent monolith state contains all tenants; only backend service role can
-- read/write it. It must never be exposed to browser clients.
alter table public.persistent_state_records enable row level security;

drop policy if exists "persistent_state_service_role_only" on public.persistent_state_records;
drop policy if exists "persistent state service role only" on public.persistent_state_records;

create policy "persistent state service role only"
  on public.persistent_state_records
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

commit;

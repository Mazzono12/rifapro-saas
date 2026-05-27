-- Superadmin finance, assisted access and tenant domains foundation.

create table if not exists public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  domain text unique not null,
  type text not null check (type in ('subdomain','custom_domain')),
  status text default 'pending' check (status in ('pending','verified','failed','disabled')),
  verification_token text,
  dns_target text,
  ssl_status text default 'pending',
  is_primary boolean default false,
  created_at timestamptz default now(),
  verified_at timestamptz
);

create unique index if not exists tenant_domains_one_primary_per_tenant_idx
  on public.tenant_domains (tenant_id)
  where is_primary = true;

create index if not exists tenant_domains_tenant_id_idx on public.tenant_domains (tenant_id);
create index if not exists tenant_domains_domain_status_idx on public.tenant_domains (lower(domain), status);

create table if not exists public.superadmin_impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  superadmin_user_id uuid,
  tenant_id uuid references public.tenants(id),
  reason text not null,
  started_at timestamptz default now(),
  ended_at timestamptz,
  expires_at timestamptz,
  ip_address text,
  user_agent text,
  active boolean default true
);

create index if not exists superadmin_impersonation_tenant_idx on public.superadmin_impersonation_sessions (tenant_id, active);
create index if not exists superadmin_impersonation_superadmin_idx on public.superadmin_impersonation_sessions (superadmin_user_id, started_at desc);

create table if not exists public.superadmin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  superadmin_user_id uuid,
  tenant_id uuid,
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

create index if not exists superadmin_audit_logs_superadmin_idx on public.superadmin_audit_logs (superadmin_user_id, created_at desc);
create index if not exists superadmin_audit_logs_tenant_idx on public.superadmin_audit_logs (tenant_id, created_at desc);

alter table public.tenant_domains enable row level security;
alter table public.superadmin_impersonation_sessions enable row level security;
alter table public.superadmin_audit_logs enable row level security;

drop policy if exists tenant_domains_select on public.tenant_domains;
create policy tenant_domains_select on public.tenant_domains
  for select using (
    public.is_service_role()
    or public.jwt_app_role() = 'superadmin'
    or public.can_access_tenant(tenant_id::text)
  );

drop policy if exists tenant_domains_write on public.tenant_domains;
create policy tenant_domains_write on public.tenant_domains
  for all using (
    public.is_service_role()
    or public.jwt_app_role() = 'superadmin'
    or public.can_access_tenant(tenant_id::text)
  )
  with check (
    public.is_service_role()
    or public.jwt_app_role() = 'superadmin'
    or public.can_access_tenant(tenant_id::text)
  );

drop policy if exists superadmin_impersonation_superadmin_only on public.superadmin_impersonation_sessions;
create policy superadmin_impersonation_superadmin_only on public.superadmin_impersonation_sessions
  for all using (public.is_service_role() or public.jwt_app_role() = 'superadmin')
  with check (public.is_service_role() or public.jwt_app_role() = 'superadmin');

drop policy if exists superadmin_audit_logs_superadmin_select on public.superadmin_audit_logs;
create policy superadmin_audit_logs_superadmin_select on public.superadmin_audit_logs
  for select using (public.is_service_role() or public.jwt_app_role() = 'superadmin');

drop policy if exists superadmin_audit_logs_insert_backend on public.superadmin_audit_logs;
create policy superadmin_audit_logs_insert_backend on public.superadmin_audit_logs
  for insert with check (public.is_service_role() or public.jwt_app_role() = 'superadmin');

-- Critical audit logs are append-only for normal users. No update/delete policy is created.

create table if not exists public.report_exports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  report_type text not null,
  filters jsonb not null default '{}'::jsonb,
  file_url text not null,
  file_hash text not null,
  generated_by text,
  status text not null default 'generated' check (status in ('generated','failed')),
  created_at timestamptz not null default now()
);

alter table public.report_exports
  add column if not exists format text default 'pdf' check (format in ('pdf','csv','xlsx')),
  add column if not exists request_id text,
  add column if not exists qr_validation_url text;

create index if not exists report_exports_tenant_created_idx on public.report_exports (tenant_id, created_at desc);
create index if not exists report_exports_type_created_idx on public.report_exports (report_type, created_at desc);
create unique index if not exists report_exports_request_id_idx on public.report_exports (request_id) where request_id is not null;

alter table public.report_exports enable row level security;

drop policy if exists report_exports_tenant_select on public.report_exports;
create policy report_exports_tenant_select
  on public.report_exports
  for select
  using (tenant_id is null or public.can_access_tenant(tenant_id));

drop policy if exists report_exports_tenant_insert on public.report_exports;
create policy report_exports_tenant_insert
  on public.report_exports
  for insert
  with check (tenant_id is null or public.can_access_tenant(tenant_id));

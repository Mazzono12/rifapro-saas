create table if not exists public.integrations (
  id text primary key,
  tenant_id text not null,
  provider text not null,
  type text not null,
  status text not null check (status in ('active', 'inactive', 'error', 'pending_config')),
  name text not null,
  encrypted_credentials text not null,
  settings jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_integrations_tenant on public.integrations (tenant_id);
create index if not exists idx_integrations_tenant_provider on public.integrations (tenant_id, provider);
create index if not exists idx_integrations_status on public.integrations (status);

create table if not exists public.integration_logs (
  id text primary key,
  tenant_id text not null,
  integration_id text not null references public.integrations(id) on delete cascade,
  provider text not null,
  action text not null,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  status_code integer not null default 0,
  success boolean not null default false,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_integration_logs_tenant on public.integration_logs (tenant_id, created_at desc);
create index if not exists idx_integration_logs_integration on public.integration_logs (integration_id, created_at desc);

create table if not exists public.webhook_endpoints (
  id text primary key,
  tenant_id text not null,
  provider text not null,
  url text not null,
  secret text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_webhook_endpoints_tenant_provider on public.webhook_endpoints (tenant_id, provider);

create table if not exists public.webhook_events (
  id text primary key,
  tenant_id text not null,
  provider text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_webhook_events_tenant_provider on public.webhook_events (tenant_id, provider, created_at desc);
create index if not exists idx_webhook_events_processed on public.webhook_events (processed, created_at desc);

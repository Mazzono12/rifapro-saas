create table if not exists public.whatsapp_provider_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null default 'mock',
  enabled boolean default false,
  environment text default 'sandbox',
  phone_number_id text,
  business_account_id text,
  access_token_encrypted text,
  webhook_verify_token_encrypted text,
  template_namespace text,
  default_language text default 'pt_BR',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id)
);

create table if not exists public.whatsapp_message_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid,
  customer_id uuid,
  phone text not null,
  message_type text not null,
  message_body text not null,
  provider text default 'mock',
  status text default 'pending',
  attempts integer default 0,
  max_attempts integer default 3,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  idempotency_key text unique
);

create index if not exists idx_whatsapp_provider_configs_tenant_id on public.whatsapp_provider_configs(tenant_id);
create index if not exists idx_whatsapp_message_queue_tenant_status on public.whatsapp_message_queue(tenant_id, status);
create index if not exists idx_whatsapp_message_queue_order_type on public.whatsapp_message_queue(order_id, message_type);

alter table public.whatsapp_provider_configs enable row level security;
alter table public.whatsapp_message_queue enable row level security;

drop policy if exists whatsapp_provider_configs_tenant_select on public.whatsapp_provider_configs;
create policy whatsapp_provider_configs_tenant_select
  on public.whatsapp_provider_configs
  for select
  using (tenant_id = ((auth.jwt()->>'tenant_id')::uuid) or auth.jwt()->>'role' = 'superadmin');

drop policy if exists whatsapp_provider_configs_tenant_write on public.whatsapp_provider_configs;
create policy whatsapp_provider_configs_tenant_write
  on public.whatsapp_provider_configs
  for all
  using (tenant_id = ((auth.jwt()->>'tenant_id')::uuid) or auth.jwt()->>'role' = 'service_role' or auth.jwt()->>'role' = 'superadmin')
  with check (tenant_id = ((auth.jwt()->>'tenant_id')::uuid) or auth.jwt()->>'role' = 'service_role' or auth.jwt()->>'role' = 'superadmin');

drop policy if exists whatsapp_message_queue_tenant_select on public.whatsapp_message_queue;
create policy whatsapp_message_queue_tenant_select
  on public.whatsapp_message_queue
  for select
  using (tenant_id = ((auth.jwt()->>'tenant_id')::uuid) or auth.jwt()->>'role' = 'superadmin');

drop policy if exists whatsapp_message_queue_service_write on public.whatsapp_message_queue;
create policy whatsapp_message_queue_service_write
  on public.whatsapp_message_queue
  for all
  using (tenant_id = ((auth.jwt()->>'tenant_id')::uuid) or auth.jwt()->>'role' = 'service_role' or auth.jwt()->>'role' = 'superadmin')
  with check (tenant_id = ((auth.jwt()->>'tenant_id')::uuid) or auth.jwt()->>'role' = 'service_role' or auth.jwt()->>'role' = 'superadmin');

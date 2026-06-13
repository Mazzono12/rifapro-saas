-- Gateway Asaas Pix plug and play por tenant.
-- Mantem compatibilidade com payment_gateway_configs e adiciona as tabelas
-- normalizadas solicitadas para pedidos, pagamentos e idempotencia de webhooks.

create table if not exists public.payment_gateways (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null check (provider in ('asaas')),
  environment text not null default 'production' check (environment in ('sandbox', 'production')),
  api_key_encrypted text,
  webhook_token text,
  is_active boolean not null default false,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id text,
  raffle_id text,
  quantity integer not null default 0,
  total_value numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'cancelled')),
  external_reference text,
  reserved_until timestamptz,
  pix_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id text not null,
  provider text not null check (provider in ('asaas')),
  asaas_payment_id text,
  billing_type text not null default 'PIX',
  status text not null default 'PENDING',
  qr_code_base64 text,
  pix_payload text,
  expiration_date timestamptz,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider, order_id)
);

alter table public.webhook_events add column if not exists event_id text;
alter table public.webhook_events add column if not exists payment_id text;
alter table public.webhook_events add column if not exists raw_payload jsonb not null default '{}'::jsonb;

create unique index if not exists webhook_events_provider_event_id_idx
  on public.webhook_events (provider, event_id)
  where event_id is not null;

create index if not exists payment_gateways_tenant_provider_idx on public.payment_gateways (tenant_id, provider);
create index if not exists orders_tenant_status_idx on public.orders (tenant_id, status, created_at desc);
create index if not exists payments_tenant_order_idx on public.payments (tenant_id, order_id);
create index if not exists payments_asaas_payment_id_idx on public.payments (asaas_payment_id);

alter table public.payment_gateways enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;

drop policy if exists payment_gateways_tenant_scope on public.payment_gateways;
drop policy if exists orders_tenant_scope on public.orders;
drop policy if exists payments_tenant_scope on public.payments;

create policy payment_gateways_tenant_scope
  on public.payment_gateways
  for all
  using (public.can_access_tenant(tenant_id::text))
  with check (public.can_access_tenant(tenant_id::text));

create policy orders_tenant_scope
  on public.orders
  for all
  using (public.can_access_tenant(tenant_id::text))
  with check (public.can_access_tenant(tenant_id::text));

create policy payments_tenant_scope
  on public.payments
  for all
  using (public.can_access_tenant(tenant_id::text))
  with check (public.can_access_tenant(tenant_id::text));

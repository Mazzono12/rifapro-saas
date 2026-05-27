-- Modelo normalizado de gateways PIX por tenant.
-- Mantem troca de gateway segura: pedidos antigos preservam provider usado e
-- cada tenant possui no maximo um gateway padrao ativo.

create table if not exists public.payment_gateway_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  display_name text,
  enabled boolean default true,
  environment text default 'sandbox',
  credentials jsonb not null default '{}'::jsonb,
  webhook_secret text,
  pix_key text,
  priority integer default 0,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint payment_gateway_configs_environment_check
    check (environment in ('sandbox', 'production', 'mock')),
  constraint payment_gateway_configs_provider_check
    check (provider in (
      'primepag',
      'paggue',
      'cashpay',
      'fakeprocessor',
      'sandbox',
      'mock',
      'mercadopago',
      'pagbank',
      'asaas',
      'infinitypay',
      'pay2m',
      'cora'
    ))
);

create index if not exists payment_gateway_configs_tenant_id_idx
  on public.payment_gateway_configs (tenant_id);

create index if not exists payment_gateway_configs_tenant_provider_idx
  on public.payment_gateway_configs (tenant_id, provider);

create index if not exists payment_gateway_configs_tenant_enabled_idx
  on public.payment_gateway_configs (tenant_id, enabled);

create unique index if not exists payment_gateway_configs_tenant_provider_environment_idx
  on public.payment_gateway_configs (tenant_id, provider, environment);

create unique index if not exists payment_gateway_configs_one_default_per_tenant_idx
  on public.payment_gateway_configs (tenant_id)
  where is_default;

create or replace function public.touch_payment_gateway_configs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payment_gateway_configs_touch_updated_at on public.payment_gateway_configs;
create trigger payment_gateway_configs_touch_updated_at
  before update on public.payment_gateway_configs
  for each row
  execute function public.touch_payment_gateway_configs_updated_at();

alter table public.payment_gateway_configs enable row level security;

drop policy if exists payment_gateway_configs_saas_select on public.payment_gateway_configs;
drop policy if exists payment_gateway_configs_saas_insert on public.payment_gateway_configs;
drop policy if exists payment_gateway_configs_saas_update on public.payment_gateway_configs;
drop policy if exists payment_gateway_configs_saas_delete on public.payment_gateway_configs;

create policy payment_gateway_configs_saas_select
  on public.payment_gateway_configs
  for select
  using (public.can_access_tenant(tenant_id::text));

create policy payment_gateway_configs_saas_insert
  on public.payment_gateway_configs
  for insert
  with check (public.can_access_tenant(tenant_id::text));

create policy payment_gateway_configs_saas_update
  on public.payment_gateway_configs
  for update
  using (public.can_access_tenant(tenant_id::text))
  with check (public.can_access_tenant(tenant_id::text));

create policy payment_gateway_configs_saas_delete
  on public.payment_gateway_configs
  for delete
  using (public.can_access_tenant(tenant_id::text));

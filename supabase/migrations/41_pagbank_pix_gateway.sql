-- Gateway PagBank Pix plug and play por tenant.
-- Expande as tabelas normalizadas de pagamentos para provider pagbank.

alter table if exists public.payment_gateways
  drop constraint if exists payment_gateways_provider_check;

alter table if exists public.payment_gateways
  add constraint payment_gateways_provider_check
  check (provider in ('asaas', 'pay2m', 'pagbank'));

alter table if exists public.payments
  drop constraint if exists payments_provider_check;

alter table if exists public.payments
  add constraint payments_provider_check
  check (provider in ('asaas', 'pay2m', 'pagbank'));

alter table public.payments add column if not exists provider_payment_id text;
alter table public.payments add column if not exists provider_reference text;
alter table public.payments add column if not exists pix_copy_paste text;
alter table public.payments add column if not exists qr_code_url text;
alter table public.payments add column if not exists end_to_end text;
alter table public.payments add column if not exists paid_at timestamptz;

alter table public.webhook_events add column if not exists provider_payment_id text;
alter table public.webhook_events add column if not exists reference_id text;
alter table public.webhook_events add column if not exists status text;
alter table public.webhook_events add column if not exists end_to_end text;

create index if not exists payments_pagbank_order_idx
  on public.payments (tenant_id, provider, provider_payment_id)
  where provider = 'pagbank' and provider_payment_id is not null;

create index if not exists payments_pagbank_reference_idx
  on public.payments (tenant_id, provider, provider_reference)
  where provider = 'pagbank' and provider_reference is not null;

create unique index if not exists webhook_events_pagbank_idempotency_idx
  on public.webhook_events (tenant_id, provider, provider_payment_id, reference_id, status, coalesce(end_to_end, 'no-e2e'))
  where provider = 'pagbank' and (provider_payment_id is not null or reference_id is not null) and status is not null;

comment on column public.payments.provider_payment_id is
  'Identificador do pagamento/pedido no provedor. Para PagBank, recebe order.id.';

comment on column public.payments.provider_reference is
  'Referencia interna enviada ao provedor. Para PagBank, recebe reference_id/order_id interno.';

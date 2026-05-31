-- Gateway PrimePag Pix real por tenant.
-- Adiciona suporte a QRCode de cobranca via POST /v1/pix/qrcodes.

alter table if exists public.payment_gateways
  drop constraint if exists payment_gateways_provider_check;

alter table if exists public.payment_gateways
  add constraint payment_gateways_provider_check
  check (provider in ('asaas', 'pay2m', 'pagbank', 'mercadopago', 'cora', 'primepag'));

alter table if exists public.payments
  drop constraint if exists payments_provider_check;

alter table if exists public.payments
  add constraint payments_provider_check
  check (provider in ('asaas', 'pay2m', 'pagbank', 'mercadopago', 'cora', 'primepag'));

alter table public.payments add column if not exists provider_payment_id text;
alter table public.payments add column if not exists provider_reference text;
alter table public.payments add column if not exists pix_copy_paste text;
alter table public.payments add column if not exists qr_code_base64 text;
alter table public.payments add column if not exists end_to_end text;
alter table public.payments add column if not exists paid_at timestamptz;

alter table public.webhook_events add column if not exists provider_payment_id text;
alter table public.webhook_events add column if not exists reference_id text;
alter table public.webhook_events add column if not exists status text;
alter table public.webhook_events add column if not exists end_to_end text;

create index if not exists payments_primepag_payment_idx
  on public.payments (tenant_id, provider, provider_payment_id)
  where provider = 'primepag' and provider_payment_id is not null;

create index if not exists payments_primepag_reference_idx
  on public.payments (tenant_id, provider, provider_reference)
  where provider = 'primepag' and provider_reference is not null;

create index if not exists payments_primepag_end_to_end_idx
  on public.payments (tenant_id, provider, end_to_end)
  where provider = 'primepag' and end_to_end is not null;

create unique index if not exists webhook_events_primepag_idempotency_idx
  on public.webhook_events (tenant_id, provider, provider_payment_id, status, coalesce(end_to_end, 'no-e2e'))
  where provider = 'primepag' and provider_payment_id is not null and status is not null;

comment on column public.payments.provider_payment_id is
  'Identificador externo da cobranca no provedor, como reference_code PrimePag.';

-- Gateway Mercado Pago Pix real por tenant.
-- Expande tabelas normalizadas para cobrancas Pix via /v1/payments.

alter table if exists public.payment_gateways
  drop constraint if exists payment_gateways_provider_check;

alter table if exists public.payment_gateways
  add constraint payment_gateways_provider_check
  check (provider in ('asaas', 'pay2m', 'pagbank', 'mercadopago'));

alter table if exists public.payments
  drop constraint if exists payments_provider_check;

alter table if exists public.payments
  add constraint payments_provider_check
  check (provider in ('asaas', 'pay2m', 'pagbank', 'mercadopago'));

alter table public.payments add column if not exists provider_payment_id text;
alter table public.payments add column if not exists provider_reference text;
alter table public.payments add column if not exists pix_copy_paste text;
alter table public.payments add column if not exists qr_code_base64 text;
alter table public.payments add column if not exists ticket_url text;
alter table public.payments add column if not exists paid_at timestamptz;

alter table public.webhook_events add column if not exists provider_payment_id text;
alter table public.webhook_events add column if not exists status text;
alter table public.webhook_events add column if not exists external_reference text;

create index if not exists payments_mercadopago_payment_idx
  on public.payments (tenant_id, provider, provider_payment_id)
  where provider = 'mercadopago' and provider_payment_id is not null;

create index if not exists payments_mercadopago_reference_idx
  on public.payments (tenant_id, provider, provider_reference)
  where provider = 'mercadopago' and provider_reference is not null;

create unique index if not exists webhook_events_mercadopago_idempotency_idx
  on public.webhook_events (tenant_id, provider, provider_payment_id, status)
  where provider = 'mercadopago' and provider_payment_id is not null and status is not null;

comment on column public.payments.provider_payment_id is
  'Identificador do pagamento no provedor. Para Mercado Pago, recebe payment.id.';

comment on column public.payments.ticket_url is
  'URL de instrucoes/checkout Pix retornada em point_of_interaction.transaction_data.ticket_url.';

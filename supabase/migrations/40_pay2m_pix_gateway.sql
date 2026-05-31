-- Gateway Pay2M Pix plug and play por tenant.
-- Expande as tabelas normalizadas criadas para Asaas sem quebrar pedidos antigos.

alter table if exists public.payment_gateways
  drop constraint if exists payment_gateways_provider_check;

alter table if exists public.payment_gateways
  add constraint payment_gateways_provider_check
  check (provider in ('asaas', 'pay2m'));

alter table if exists public.payments
  drop constraint if exists payments_provider_check;

alter table if exists public.payments
  add constraint payments_provider_check
  check (provider in ('asaas', 'pay2m'));

alter table public.payments add column if not exists provider_payment_id text;
alter table public.payments add column if not exists provider_reference text;
alter table public.payments add column if not exists pix_copy_paste text;
alter table public.payments add column if not exists end_to_end text;
alter table public.payments add column if not exists paid_at timestamptz;

alter table public.webhook_events add column if not exists status text;
alter table public.webhook_events add column if not exists external_reference text;
alter table public.webhook_events add column if not exists reference_code text;
alter table public.webhook_events add column if not exists end_to_end text;

create index if not exists payments_provider_payment_id_idx
  on public.payments (tenant_id, provider, provider_payment_id)
  where provider_payment_id is not null;

create index if not exists payments_provider_reference_idx
  on public.payments (tenant_id, provider, provider_reference)
  where provider_reference is not null;

create unique index if not exists webhook_events_pay2m_idempotency_idx
  on public.webhook_events (tenant_id, provider, reference_code, status, coalesce(end_to_end, 'no-e2e'))
  where provider = 'pay2m' and reference_code is not null and status is not null;

comment on column public.payments.provider_payment_id is
  'Identificador do pagamento no provedor. Para Pay2M, recebe reference_code.';

comment on column public.payments.pix_copy_paste is
  'Payload PIX copia e cola retornado pelo provedor, sem QR Code obrigatorio.';

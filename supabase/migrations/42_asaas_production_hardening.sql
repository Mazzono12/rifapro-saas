-- Hardening de producao para Asaas Pix.
-- Alinha idempotencia e consultas com Pay2M/PagBank usando tenant + provider + payment/status.

alter table public.payments add column if not exists provider_payment_id text;
alter table public.payments add column if not exists provider_reference text;
alter table public.payments add column if not exists pix_copy_paste text;
alter table public.payments add column if not exists end_to_end text;
alter table public.payments add column if not exists paid_at timestamptz;

alter table public.webhook_events add column if not exists provider_payment_id text;
alter table public.webhook_events add column if not exists status text;
alter table public.webhook_events add column if not exists external_reference text;

create index if not exists payments_asaas_provider_payment_idx
  on public.payments (tenant_id, provider, provider_payment_id)
  where provider = 'asaas' and provider_payment_id is not null;

create index if not exists payments_asaas_order_idx
  on public.payments (tenant_id, provider, order_id)
  where provider = 'asaas' and order_id is not null;

create unique index if not exists webhook_events_asaas_idempotency_idx
  on public.webhook_events (tenant_id, provider, provider_payment_id, status)
  where provider = 'asaas' and provider_payment_id is not null and status is not null;

drop index if exists webhook_events_provider_event_id_idx;

create unique index if not exists webhook_events_provider_event_id_idx
  on public.webhook_events (tenant_id, provider, event_id)
  where event_id is not null;

comment on index public.webhook_events_asaas_idempotency_idx is
  'Garante idempotencia Asaas por tenant, provider, payment id e status.';

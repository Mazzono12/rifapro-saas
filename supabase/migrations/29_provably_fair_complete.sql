alter table public.raffle_draw_audit
  add column if not exists status text default 'prepared'
    check (status in ('prepared','locked','executed','published')),
  add column if not exists server_seed_secret text,
  add column if not exists eligible_numbers jsonb default '[]'::jsonb,
  add column if not exists locked_at timestamptz,
  add column if not exists scheduled_at timestamptz,
  add column if not exists executed_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists nonce integer default 1,
  add column if not exists verification_payload jsonb default '{}'::jsonb;

create unique index if not exists raffle_draw_audit_one_per_raffle_idx
  on public.raffle_draw_audit (tenant_id, raffle_id);

create index if not exists raffle_draw_audit_status_idx
  on public.raffle_draw_audit (tenant_id, status, created_at desc);

comment on column public.raffle_draw_audit.server_seed_hash is
  'Compromisso SHA-256 publicado antes do sorteio. A seed secreta so deve ser revelada apos execucao.';

comment on column public.raffle_draw_audit.eligible_numbers_hash is
  'Hash SHA-256 da lista de cotas elegiveis travada antes do sorteio.';

comment on column public.raffle_draw_audit.verification_payload is
  'Dados publicos apos sorteio para recalculo independente do resultado provably fair.';

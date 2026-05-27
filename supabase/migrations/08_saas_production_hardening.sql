create table if not exists public.saas_plans (
  id text primary key,
  nome text not null,
  limite_rifas integer not null default 0,
  limite_vendas_mes integer not null default 0,
  recursos jsonb not null default '[]'::jsonb,
  dominio_proprio boolean not null default false,
  integracoes_liberadas jsonb not null default '[]'::jsonb,
  percentual_comissao numeric(6,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.saas_plans (id, nome, limite_rifas, limite_vendas_mes, recursos, dominio_proprio, integracoes_liberadas, percentual_comissao)
values
  ('gratis', 'Gratis', 1, 100, '["checkout","pix_basico","relatorios_basicos"]', false, '["smtp"]', 12),
  ('basico', 'Basico', 5, 1000, '["checkout","pix","relatorios","afiliados"]', false, '["smtp","sendpulse"]', 10),
  ('profissional', 'Profissional', 25, 10000, '["checkout","pix","gamificacao","relatorios","afiliados","integracoes_ads"]', true, '["primepag","paggue","smtp","sendpulse","metaAds","googleAds"]', 7.5),
  ('premium', 'Premium', 100, 50000, '["checkout","pix","gamificacao","relatorios_avancados","afiliados","integracoes","webhooks"]', true, '["primepag","paggue","smtp","sendpulse","metaAds","googleAds","wetalkie","cashPay","nuvenda","fkeProcessor"]', 5),
  ('white-label', 'White-label', 999999, 999999, '["checkout","pix","gamificacao","relatorios_avancados","afiliados","integracoes","webhooks","white_label"]', true, '["primepag","paggue","smtp","sendpulse","metaAds","googleAds","wetalkie","cashPay","nuvenda","fkeProcessor"]', 2.5)
on conflict (id) do update set
  nome = excluded.nome,
  limite_rifas = excluded.limite_rifas,
  limite_vendas_mes = excluded.limite_vendas_mes,
  recursos = excluded.recursos,
  dominio_proprio = excluded.dominio_proprio,
  integracoes_liberadas = excluded.integracoes_liberadas,
  percentual_comissao = excluded.percentual_comissao,
  updated_at = now();

create table if not exists public.security_audit_logs (
  id text primary key,
  tenant_id text not null,
  action text not null,
  ip text,
  status text not null check (status in ('INFO', 'WARN', 'BLOCKED')),
  severity text not null check (severity in ('low', 'medium', 'high')),
  actor text,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_security_audit_logs_tenant on public.security_audit_logs (tenant_id, created_at desc);
create index if not exists idx_security_audit_logs_status on public.security_audit_logs (status, severity, created_at desc);

create table if not exists public.payment_queue_jobs (
  id text primary key,
  tenant_id text not null,
  gateway text not null,
  purchase_id text,
  status text not null check (status in ('pending', 'paid', 'failed', 'cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  next_retry_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_queue_jobs_tenant_status on public.payment_queue_jobs (tenant_id, status, next_retry_at);
create index if not exists idx_payment_queue_jobs_purchase on public.payment_queue_jobs (tenant_id, purchase_id);

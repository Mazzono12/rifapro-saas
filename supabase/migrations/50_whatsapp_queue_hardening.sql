create table if not exists public.whatsapp_queue_jobs (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'claimed', 'processing', 'sent', 'failed', 'dead_letter')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  claim_token text,
  claimed_at timestamptz,
  scheduled_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  entity_id text generated always as (coalesce(payload->>'entityId', payload->>'entity_id', payload->>'orderId', payload->>'purchaseId', payload->>'campaignId', id)) stored,
  event_type text generated always as (coalesce(payload->>'eventType', payload->>'event_type', job_type)) stored,
  unique (tenant_id, job_type, entity_id, event_type)
);

create table if not exists public.whatsapp_queue_dead_letter (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  source_job_id text not null,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  erro text not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_queue_jobs_tenant_id on public.whatsapp_queue_jobs(tenant_id);
create index if not exists idx_whatsapp_queue_jobs_status on public.whatsapp_queue_jobs(status);
create index if not exists idx_whatsapp_queue_jobs_scheduled_at on public.whatsapp_queue_jobs(scheduled_at);
create index if not exists idx_whatsapp_queue_jobs_claim_token on public.whatsapp_queue_jobs(claim_token);
create index if not exists idx_whatsapp_queue_jobs_job_type on public.whatsapp_queue_jobs(job_type);
create index if not exists idx_whatsapp_queue_dead_letter_tenant_id on public.whatsapp_queue_dead_letter(tenant_id);
create index if not exists idx_whatsapp_queue_dead_letter_job_type on public.whatsapp_queue_dead_letter(job_type);

alter table public.whatsapp_queue_jobs enable row level security;
alter table public.whatsapp_queue_dead_letter enable row level security;

drop policy if exists whatsapp_queue_jobs_tenant_access on public.whatsapp_queue_jobs;
create policy whatsapp_queue_jobs_tenant_access on public.whatsapp_queue_jobs
  using (public.can_access_tenant(tenant_id))
  with check (public.can_access_tenant(tenant_id));

drop policy if exists whatsapp_queue_dead_letter_tenant_access on public.whatsapp_queue_dead_letter;
create policy whatsapp_queue_dead_letter_tenant_access on public.whatsapp_queue_dead_letter
  using (public.can_access_tenant(tenant_id))
  with check (public.can_access_tenant(tenant_id));

create or replace function public.claim_whatsapp_queue_jobs(
  p_tenant_id text,
  p_limit integer default 20,
  p_claim_token text default gen_random_uuid()::text,
  p_job_types text[] default null
)
returns setof public.whatsapp_queue_jobs
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select id
    from public.whatsapp_queue_jobs
    where tenant_id = p_tenant_id
      and status = 'queued'
      and scheduled_at <= now()
      and attempts < max_attempts
      and (p_job_types is null or job_type = any(p_job_types))
    order by scheduled_at asc, created_at asc
    for update skip locked
    limit greatest(1, least(100, p_limit))
  )
  update public.whatsapp_queue_jobs job
     set status = 'claimed',
         claim_token = p_claim_token,
         claimed_at = now(),
         updated_at = now()
    from candidates
   where job.id = candidates.id
  returning job.*;
$$;

create or replace function public.finish_whatsapp_queue_job(
  p_job_id text,
  p_claim_token text,
  p_status text,
  p_error text default ''
)
returns public.whatsapp_queue_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.whatsapp_queue_jobs;
  v_next_scheduled_at timestamptz;
begin
  select * into v_job
  from public.whatsapp_queue_jobs
  where id = p_job_id
    and claim_token = p_claim_token
  for update;

  if not found then
    raise exception 'claim_token invalido para job WhatsApp %', p_job_id;
  end if;

  if p_status = 'sent' then
    update public.whatsapp_queue_jobs
       set status = 'sent',
           claim_token = null,
           claimed_at = null,
           processed_at = now(),
           updated_at = now()
     where id = p_job_id
     returning * into v_job;
    return v_job;
  end if;

  if v_job.attempts + 1 >= v_job.max_attempts then
    update public.whatsapp_queue_jobs
       set status = 'dead_letter',
           attempts = attempts + 1,
           claim_token = null,
           claimed_at = null,
           processed_at = now(),
           updated_at = now()
     where id = p_job_id
     returning * into v_job;

    insert into public.whatsapp_queue_dead_letter(id, tenant_id, source_job_id, job_type, payload, erro, attempts)
    values (gen_random_uuid()::text, v_job.tenant_id, v_job.id, v_job.job_type, v_job.payload, p_error, v_job.attempts)
    on conflict do nothing;

    return v_job;
  end if;

  v_next_scheduled_at := now() + case v_job.attempts
    when 0 then interval '1 minute'
    when 1 then interval '5 minutes'
    when 2 then interval '15 minutes'
    else interval '1 hour'
  end;

  update public.whatsapp_queue_jobs
     set status = 'queued',
         attempts = attempts + 1,
         claim_token = null,
         claimed_at = null,
         scheduled_at = v_next_scheduled_at,
         updated_at = now()
   where id = p_job_id
   returning * into v_job;

  return v_job;
end;
$$;

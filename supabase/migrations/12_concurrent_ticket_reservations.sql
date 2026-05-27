-- Reservas concorrentes de cotas por tenant/rifa.
-- A constraint abaixo impede que duas compras ativas tenham o mesmo numero/cota.

create table if not exists public.raffle_ticket_reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  raffle_id text not null,
  purchase_id text not null,
  numero integer not null check (numero > 0),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled', 'expired')),
  reserved_until timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_raffle_ticket_reservations_unique_active
  on public.raffle_ticket_reservations (tenant_id, raffle_id, numero)
  where status in ('pending', 'paid');

create index if not exists idx_raffle_ticket_reservations_purchase
  on public.raffle_ticket_reservations (tenant_id, purchase_id);

create index if not exists idx_raffle_ticket_reservations_expiration
  on public.raffle_ticket_reservations (status, reserved_until);

alter table public.raffle_ticket_reservations enable row level security;

drop policy if exists raffle_ticket_reservations_select on public.raffle_ticket_reservations;
drop policy if exists raffle_ticket_reservations_insert on public.raffle_ticket_reservations;
drop policy if exists raffle_ticket_reservations_update on public.raffle_ticket_reservations;
drop policy if exists raffle_ticket_reservations_delete on public.raffle_ticket_reservations;

create policy raffle_ticket_reservations_select
  on public.raffle_ticket_reservations
  for select
  using (public.can_access_tenant(tenant_id));

create policy raffle_ticket_reservations_insert
  on public.raffle_ticket_reservations
  for insert
  with check (public.can_access_tenant(tenant_id));

create policy raffle_ticket_reservations_update
  on public.raffle_ticket_reservations
  for update
  using (public.can_access_tenant(tenant_id))
  with check (public.can_access_tenant(tenant_id));

create policy raffle_ticket_reservations_delete
  on public.raffle_ticket_reservations
  for delete
  using (public.can_access_tenant(tenant_id));

create or replace function public.expire_raffle_ticket_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.raffle_ticket_reservations
     set status = 'expired',
         updated_at = now()
   where status = 'pending'
     and reserved_until <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.reserve_raffle_tickets(
  p_tenant_id text,
  p_raffle_id text,
  p_purchase_id text,
  p_quantity integer,
  p_total_tickets integer,
  p_ttl_seconds integer default 900
)
returns table(numero integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserved integer := 0;
  v_candidate integer;
  v_attempts integer := 0;
  v_max_attempts integer;
begin
  if p_tenant_id is null or p_tenant_id = '' then
    raise exception 'tenant_id is required';
  end if;
  if p_quantity < 1 or p_total_tickets < p_quantity then
    raise exception 'invalid ticket quantity';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_tenant_id || ':' || p_raffle_id));
  perform public.expire_raffle_ticket_reservations();

  if (
    select count(*)
      from public.raffle_ticket_reservations
     where tenant_id = p_tenant_id
       and raffle_id = p_raffle_id
       and status in ('pending', 'paid')
  ) + p_quantity > p_total_tickets then
    raise exception 'not enough tickets available';
  end if;

  v_max_attempts := greatest(p_quantity * 100, 500);

  while v_reserved < p_quantity and v_attempts < v_max_attempts loop
    v_attempts := v_attempts + 1;
    v_candidate := floor(random() * p_total_tickets + 1)::integer;

    begin
      insert into public.raffle_ticket_reservations (
        tenant_id,
        raffle_id,
        purchase_id,
        numero,
        status,
        reserved_until
      ) values (
        p_tenant_id,
        p_raffle_id,
        p_purchase_id,
        v_candidate,
        'pending',
        now() + make_interval(secs => greatest(p_ttl_seconds, 60))
      );
      v_reserved := v_reserved + 1;
      numero := v_candidate;
      return next;
    exception
      when unique_violation then
        null;
    end;
  end loop;

  if v_reserved < p_quantity then
    raise exception 'unable to reserve enough unique tickets';
  end if;
end;
$$;

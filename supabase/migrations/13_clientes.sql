create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  telefone text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists clientes_email_unique_ci
  on public.clientes (lower(email));

create index if not exists idx_clientes_created_at
  on public.clientes (created_at desc);

alter table public.clientes enable row level security;

drop policy if exists clientes_service_role_all on public.clientes;

create policy clientes_service_role_all
  on public.clientes
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.modalidades (
  id text primary key,
  nome text not null,
  tipo text not null check (tipo in ('rifa', 'grupo', 'dezena', 'centena', 'milhar')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.modalidades_configuracoes (
  id uuid primary key default gen_random_uuid(),
  modalidade_id text not null references public.modalidades(id),
  descricao text,
  media_url text,
  media_type text check (media_type in ('image', 'video', 'youtube', 'vimeo')),
  preco numeric(12,2) not null default 1,
  premio text,
  data_sorteio timestamptz,
  resultado text,
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  caixinha_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.modalidades_rodadas (
  id uuid primary key default gen_random_uuid(),
  modalidade_id text not null references public.modalidades(id),
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  data_inicio timestamptz not null default now(),
  data_sorteio timestamptz,
  resultado_oficial text
);

create table if not exists public.modalidades_compras (
  id uuid primary key default gen_random_uuid(),
  modalidade_id text not null references public.modalidades(id),
  usuario_id uuid references auth.users(id),
  valor_pago numeric(12,2) not null,
  status_pagamento text not null default 'paid' check (status_pagamento in ('reserved', 'paid', 'cancelled')),
  data_compra timestamptz not null default now()
);

create table if not exists public.modalidades_apostas (
  id uuid primary key default gen_random_uuid(),
  modalidade_id text not null references public.modalidades(id),
  compra_id uuid not null references public.modalidades_compras(id),
  usuario_id uuid references auth.users(id),
  numero text not null,
  status text not null default 'paid' check (status in ('reserved', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (modalidade_id, numero)
);

create table if not exists public.modalidades_resultados (
  id uuid primary key default gen_random_uuid(),
  resultado_oficial text not null,
  dezena text,
  centena text,
  milhar text,
  origem_resultado text,
  admin_id uuid references auth.users(id),
  data_resultado timestamptz not null default now()
);

create table if not exists public.modalidades_ganhadores (
  id uuid primary key default gen_random_uuid(),
  modalidade_id text not null references public.modalidades(id),
  usuario_id uuid references auth.users(id),
  compra_id uuid references public.modalidades_compras(id),
  numero text not null,
  premio text,
  sem_ganhador boolean not null default false,
  data timestamptz not null default now()
);

create index if not exists idx_modalidades_apostas_modalidade on public.modalidades_apostas(modalidade_id);
create index if not exists idx_modalidades_compras_usuario on public.modalidades_compras(usuario_id);
create index if not exists idx_modalidades_ganhadores_modalidade on public.modalidades_ganhadores(modalidade_id);

alter table public.modalidades enable row level security;
alter table public.modalidades_configuracoes enable row level security;
alter table public.modalidades_rodadas enable row level security;
alter table public.modalidades_compras enable row level security;
alter table public.modalidades_apostas enable row level security;
alter table public.modalidades_resultados enable row level security;
alter table public.modalidades_ganhadores enable row level security;

create policy "modalidades leitura publica" on public.modalidades for select using (true);
create policy "modalidades config leitura publica" on public.modalidades_configuracoes for select using (true);
create policy "modalidades apostas leitura publica" on public.modalidades_apostas for select using (true);
create policy "modalidades resultados leitura publica" on public.modalidades_resultados for select using (true);
create policy "modalidades ganhadores leitura publica" on public.modalidades_ganhadores for select using (true);
create policy "modalidades compras usuario" on public.modalidades_compras for select using (auth.uid() = usuario_id);

create policy "modalidades admin all" on public.modalidades
  for all using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.role = 'admin'));

create policy "modalidades config admin all" on public.modalidades_configuracoes
  for all using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.role = 'admin'));

create policy "modalidades resultados admin all" on public.modalidades_resultados
  for all using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.role = 'admin'));

insert into public.modalidades (id, nome, tipo) values
  ('rifas', 'Rifas', 'rifa'),
  ('fazendinha', 'A Fazendinha', 'grupo'),
  ('dezena', 'Dezena', 'dezena'),
  ('centena', 'Centena', 'centena'),
  ('milhar', 'Milhar', 'milhar')
on conflict (id) do nothing;

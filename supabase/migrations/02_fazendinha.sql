create table if not exists public.fazendinha_configuracoes (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default true,
  nome text not null default 'A Fazendinha',
  descricao text,
  preco_por_grupo numeric(12,2) not null default 10,
  premio_principal text not null default 'R$ 1.000,00',
  data_sorteio timestamptz,
  resultado_loteria text,
  origem_resultado text,
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fazendinha_grupos (
  id text primary key,
  nome_bicho text not null,
  numeros text[] not null,
  imagem_url text,
  status text not null default 'available' check (status in ('available', 'reserved', 'sold')),
  preco numeric(12,2) not null default 10,
  comprador_id uuid references auth.users(id),
  compra_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fazendinha_compras (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users(id),
  grupo_id text not null references public.fazendinha_grupos(id),
  nome_bicho text not null,
  numeros text[] not null,
  valor_pago numeric(12,2) not null,
  status_pagamento text not null default 'reserved' check (status_pagamento in ('reserved', 'paid', 'cancelled')),
  data_compra timestamptz not null default now()
);

create table if not exists public.fazendinha_resultados (
  id uuid primary key default gen_random_uuid(),
  numero_sorteado text not null,
  origem_resultado text,
  data_resultado timestamptz not null default now(),
  admin_id uuid references auth.users(id)
);

create table if not exists public.fazendinha_ganhadores (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users(id),
  grupo_id text references public.fazendinha_grupos(id),
  numero_sorteado text not null,
  premio text not null,
  data timestamptz not null default now()
);

create index if not exists idx_fazendinha_grupos_status on public.fazendinha_grupos(status);
create index if not exists idx_fazendinha_compras_usuario on public.fazendinha_compras(usuario_id);
create index if not exists idx_fazendinha_resultados_numero on public.fazendinha_resultados(numero_sorteado);

alter table public.fazendinha_configuracoes enable row level security;
alter table public.fazendinha_grupos enable row level security;
alter table public.fazendinha_compras enable row level security;
alter table public.fazendinha_resultados enable row level security;
alter table public.fazendinha_ganhadores enable row level security;

create policy "fazendinha leitura publica configuracoes" on public.fazendinha_configuracoes
  for select using (true);

create policy "fazendinha leitura publica grupos" on public.fazendinha_grupos
  for select using (true);

create policy "fazendinha usuarios veem suas compras" on public.fazendinha_compras
  for select using (auth.uid() = usuario_id);

create policy "fazendinha leitura publica ganhadores" on public.fazendinha_ganhadores
  for select using (true);

create policy "fazendinha leitura publica resultados" on public.fazendinha_resultados
  for select using (true);

create policy "fazendinha admin controla configuracoes" on public.fazendinha_configuracoes
  for all using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.role in ('superadmin', 'admin', 'tenant_admin')))
  with check (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.role in ('superadmin', 'admin', 'tenant_admin')));

create policy "fazendinha admin controla grupos" on public.fazendinha_grupos
  for all using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.role in ('superadmin', 'admin', 'tenant_admin')))
  with check (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.role in ('superadmin', 'admin', 'tenant_admin')));

create policy "fazendinha admin controla compras" on public.fazendinha_compras
  for all using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.role in ('superadmin', 'admin', 'tenant_admin')))
  with check (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.role in ('superadmin', 'admin', 'tenant_admin')));

create policy "fazendinha admin controla resultados" on public.fazendinha_resultados
  for all using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.role in ('superadmin', 'admin', 'tenant_admin')))
  with check (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.role in ('superadmin', 'admin', 'tenant_admin')));

create policy "fazendinha admin controla ganhadores" on public.fazendinha_ganhadores
  for all using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.role in ('superadmin', 'admin', 'tenant_admin')))
  with check (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.role in ('superadmin', 'admin', 'tenant_admin')));

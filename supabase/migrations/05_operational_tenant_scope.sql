-- Tenant scope for operational records. Existing records belong to the principal tenant.
begin;

do $$
declare
  principal_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  table_name text;
begin
  foreach table_name in array array[
    'rifas', 'raffles',
    'premios', 'instant_prizes', 'premios_instantaneos', 'historico_premios',
    'compras', 'purchases',
    'configuracoes',
    'stories', 'ganhadores', 'winners',
    'afiliados', 'affiliates', 'comissoes', 'affiliate_commissions',
    'caixinha_configuracoes', 'caixinha_premios', 'caixinhas', 'caixinha_recompensas', 'caixinha_historico',
    'user_lootboxes', 'lootbox_history',
    'fazendinha_configuracoes', 'fazendinha_grupos', 'fazendinha_compras',
    'fazendinha_resultados', 'fazendinha_ganhadores',
    'modalidades', 'modalidades_configuracoes', 'modalidades_rodadas',
    'modalidades_compras', 'modalidades_apostas', 'modalidades_resultados', 'modalidades_ganhadores'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'alter table public.%I add column if not exists tenant_id uuid references public.tenants(id)',
        table_name
      );
      execute format(
        'update public.%I set tenant_id = $1 where tenant_id is null',
        table_name
      ) using principal_id;
      execute format(
        'alter table public.%I alter column tenant_id set not null',
        table_name
      );
      if not exists (
        select 1
        from pg_constraint constraint_record
        where constraint_record.conrelid = to_regclass(format('public.%I', table_name))
          and constraint_record.contype = 'f'
          and pg_get_constraintdef(constraint_record.oid) like '%(tenant_id)%REFERENCES tenants(id)%'
      ) then
        execute format(
          'alter table public.%I add constraint %I foreign key (tenant_id) references public.tenants(id)',
          table_name,
          'fk_' || substr(table_name, 1, 45) || '_tenant'
        );
      end if;
      execute format(
        'create index if not exists %I on public.%I (tenant_id)',
        'idx_' || table_name || '_tenant_id',
        table_name
      );
    end if;
  end loop;
end $$;

-- usuarios permits NULL only for superadmin, as required by its role model.
create index if not exists idx_usuarios_tenant_id on public.usuarios (tenant_id);

create table if not exists public.pagamentos_pix (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  compra_referencia text not null,
  gateway text not null,
  txid text,
  status text not null default 'pending',
  qrcode_pix text,
  payload_pix text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_pagamentos_pix_tenant_id on public.pagamentos_pix (tenant_id);
create index if not exists idx_pagamentos_pix_tenant_compra on public.pagamentos_pix (tenant_id, compra_referencia);

alter table public.pagamentos_pix enable row level security;
drop policy if exists "Tenant scoped pagamentos pix" on public.pagamentos_pix;
create policy "Tenant scoped pagamentos pix"
  on public.pagamentos_pix
  for all
  using (
    public.jwt_app_role() = 'superadmin'
    or tenant_id = public.jwt_tenant_id()
  )
  with check (
    public.jwt_app_role() = 'superadmin'
    or tenant_id = public.jwt_tenant_id()
  );

-- Stored tenant identity must be derived from authenticated claims.
-- Browser payloads must never be used when writing tenant_id.
commit;

# Plano Seguro de Reconciliação Supabase

Gerado em: 2026-05-27

Fonte: `docs/supabase-real-schema-audit.md`, migrations em `supabase/migrations/*.sql` e inventario somente leitura via REST/OpenAPI do Supabase real.

Este plano nao aplica migrations, nao altera o banco real, nao apaga dados e nao sobrescreve tabelas.

## Decisao Recomendada

Recomendacao principal: **B) criar um Supabase novo limpo e aplicar todas as migrations**, mantendo o banco atual como origem de leitura e backup historico ate a validacao final.

Motivo: o banco atual esta em um modelo legado com tabelas JSONB genericas (`rifas`, `pedidos`, `pagamentos`, etc.) e algumas tabelas parcialmente alinhadas (`tenants`, `usuarios`, `clientes`, `payment_gateway_configs`, `persistent_state_records`). Aplicar migrations in-place aumenta risco de conflito silencioso, especialmente em `persistent_state_records`, que existe no banco real no formato `scope/state_key/state_value`, enquanto uma migration anterior esperava `tenant_id/collection/record_key/data`.

Decisao por cenario:

- **A) Migrar banco legado atual para modelo novo**: viavel apenas se houver exigencia de manter o mesmo projeto Supabase, URL e Auth. Deve ser feito com plano SQL incremental revisado, backup completo, janela de manutencao e testes em clone. Nao recomendado como primeira opcao.
- **B) Supabase novo clean-room**: recomendado. Reduz risco, permite aplicar migrations em ordem controlada, validar RLS/indices/constraints e importar somente dados necessarios.
- **C) Manter legado apenas como backup historico**: aceitavel se os dados reais forem descartaveis operacionalmente. Como ha registros em `clientes`, `tenants`, `usuarios` e `persistent_state_records`, nao tratar como descartavel sem aprovacao humana.

## Inventario do Banco Atual

Tabelas legadas ou divergentes encontradas:

- `afiliados`: 0 registros, tabela JSONB operacional legada.
- `automacoes`: 0 registros, tabela JSONB operacional legada.
- `campanhas`: 0 registros, tabela JSONB operacional legada.
- `logs`: 0 registros, tabela JSONB operacional legada.
- `pagamentos`: 0 registros, tabela JSONB operacional legada.
- `pedidos`: 0 registros, tabela JSONB operacional legada.
- `rifas`: 0 registros, tabela JSONB operacional legada.
- `webhooks`: 0 registros, tabela JSONB operacional legada.

Tabelas parcialmente alinhadas ou atuais:

- `clientes`: 1 registro.
- `tenants`: 1 registro.
- `usuarios`: 1 registro.
- `payment_gateway_configs`: 0 registros.
- `persistent_state_records`: 47 registros.

Conclusao sobre dado real a preservar:

- Nao ha pedidos, rifas, pagamentos, webhooks, campanhas ou afiliados legados com dados pelo inventario atual.
- Ha dados reais ou configuracionais a preservar em `clientes`, `tenants`, `usuarios` e `persistent_state_records`.
- `persistent_state_records` provavelmente contem estado de configuracao/seed do app e deve ser exportado integralmente antes de qualquer decisao.
- `usuarios` precisa ser conciliado com Supabase Auth (`auth.users`) antes de qualquer cutover, porque REST public nao confirma o historico completo de usuarios Auth.

## Tabelas Novas Esperadas

Modelo normalizado esperado pelas migrations locais:

- Core sorteios/compras: `profiles`, `raffles`, `instant_prizes`, `purchases`, `raffle_ticket_reservations`.
- Afiliados e carteira: `affiliates`, `affiliate_commissions`, `wallet_ledger`.
- Caixinha/lootbox: `user_lootboxes`, `lootbox_history`, `caixinha_configuracoes`, `caixinha_premios`, `caixinhas`, `caixinha_recompensas`, `caixinha_historico`.
- Fazendinha: `fazendinha_configuracoes`, `fazendinha_grupos`, `fazendinha_compras`, `fazendinha_resultados`, `fazendinha_ganhadores`.
- Modalidades: `modalidades`, `modalidades_configuracoes`, `modalidades_rodadas`, `modalidades_compras`, `modalidades_apostas`, `modalidades_resultados`, `modalidades_ganhadores`.
- SaaS/multitenant: `tenants`, `usuarios`, `clientes`, `tenant_domains`, `tenant_feature_flags`, `tenant_maintenance_windows`.
- Integracoes/webhooks: `integrations`, `integration_logs`, `webhook_endpoints`, `webhook_events`, `webhook_jobs`, `idempotency_keys`.
- Pagamentos/operacao: `pagamentos_pix`, `payment_gateway_configs`, `payment_queue_jobs`.
- Auditoria/admin: `security_audit_logs`, `superadmin_impersonation_sessions`, `superadmin_audit_logs`, `platform_health_snapshots`.
- Estado persistente: `persistent_state_records`.

## Plano de Backup

Antes de qualquer alteracao futura:

1. Criar snapshot/backup completo no painel Supabase do projeto atual.
2. Exportar schema e dados via `pg_dump` com roles/privileges quando houver acesso SQL direto.
3. Exportar separadamente tabelas com dados confirmados:
   - `clientes`
   - `tenants`
   - `usuarios`
   - `persistent_state_records`
4. Exportar tambem tabelas legadas vazias para auditoria, mesmo sem registros.
5. Exportar Auth users pelo painel Supabase ou Admin API, incluindo `id`, `email`, metadata e created date. Nao exportar senhas.
6. Exportar Storage buckets e objetos, se existirem, com manifesto de paths.
7. Guardar checksums dos dumps e contagens por tabela.
8. Validar restauracao em ambiente temporario antes de qualquer cutover.

Checklist minimo de backup:

- Backup do banco criado e identificado com data/hora.
- Dump SQL restaurado com sucesso em banco temporario.
- Export JSON/CSV de `persistent_state_records` conferido.
- Auth users inventariados.
- Variaveis de ambiente sensiveis copiadas para cofre seguro, nao para repositorio.
- Plano de rollback documentado.

## Plano Clean-Room

Objetivo: criar um Supabase novo, aplicar migrations e importar apenas dados necessarios.

Etapas:

1. Criar novo projeto Supabase.
2. Configurar regioes, planos, SMTP/Auth, URLs permitidas e CORS conforme producao.
3. Criar `.env.cleanroom` local com URL e chaves do novo projeto.
4. Aplicar migrations em ambiente novo, nunca no banco atual.
5. Rodar testes de schema, auth, RLS, checkout, PIX, webhooks e frontend contra o novo projeto.
6. Importar dados preservados em scripts idempotentes e revisados.
7. Validar contagens, relacionamentos e acesso por tenant.
8. Fazer dry-run de login, compra, webhook PIX e painel admin.
9. Planejar cutover de frontend/backend para as novas variaveis.
10. Manter banco antigo em modo somente leitura por periodo acordado.

## Ordem Correta para Aplicar Migrations

Em clean-room, aplicar em ordem cronologica de arquivo:

1. `00_initial_schema.sql`
2. `01_refactor_caixinha_premiada.sql`
3. `02_fazendinha.sql`
4. `03_modalidades_individuais.sql`
5. `04_multitenant_auth.sql`
6. `05_operational_tenant_scope.sql`
7. `06_gamification_modules.sql`
8. `07_global_integrations.sql`
9. `08_saas_production_hardening.sql`
10. `09_persistent_state_records.sql`
11. `10_strong_multitenant_rls.sql`
12. `11_payment_webhook_workers.sql`
13. `12_concurrent_ticket_reservations.sql`
14. `13_clientes.sql`
15. `14_persistent_state_records_complete.sql`
16. `15_saas_multitenant_foundation.sql`
17. `16_supabase_auth_usuarios.sql`
18. `17_payment_gateway_configs.sql`
19. `18_gateway_credentials_encryption_metadata.sql`
20. `19_superadmin_finance_domains_impersonation.sql`
21. `20_hardcore_readiness_improvements.sql`

Pre-flight obrigatorio antes de aplicar:

- Rodar as migrations em banco descartavel local/remoto primeiro.
- Confirmar se `09_persistent_state_records.sql` e `14_persistent_state_records_complete.sql` devem coexistir ou se uma migration corretiva deve consolidar o modelo. Hoje elas descrevem formatos diferentes para a mesma tabela.
- Confirmar se o produto final deve manter tabelas legadas JSONB criadas por `15_saas_multitenant_foundation.sql` (`rifas`, `pedidos`, `pagamentos`, etc.) ou se o caminho definitivo e o modelo normalizado (`raffles`, `purchases`, etc.).
- Validar que `usuarios` ficara coerente com Supabase Auth.

## Estrategia de Migracao de Dados Antigos

Como as tabelas legadas operacionais estao vazias, a migracao de vendas/sorteios parece nao ser necessaria agora. Ainda assim, preparar scripts para os dados existentes:

Mapeamento recomendado:

- `tenants` atual -> `tenants` novo:
  - Preservar `id`, `nome`, `slug`, `dominio`, `plano`, `ativo`.
  - Popular campos novos com defaults: `status`, `logo_url`, `cor_primaria`, `percentual_plataforma`, `criado_em`, `atualizado_em`.
- `usuarios` atual -> `usuarios` novo:
  - Preservar `id`, `tenant_id`, `nome`, `email`, `role`, `ativo`, `created_at`.
  - Confirmar se `id` existe em `auth.users`; se nao existir, criar usuario Auth antes ou mapear novo `id`.
  - Nao migrar `senha_hash` para o modelo Supabase Auth sem revisao; preferir reset/invite.
- `clientes` atual -> `clientes` novo:
  - Preservar `id`, `tenant_id`, `nome`, `email`, `telefone`, `created_at`.
  - Normalizar telefone/email se os codigos do app exigirem formato especifico.
- `persistent_state_records` atual -> `persistent_state_records` novo:
  - Se o modelo final for `scope/state_key/state_value`, copiar diretamente.
  - Se o modelo final for `tenant_id/collection/record_key/data`, mapear `scope -> tenant_id/collection` e `state_key -> record_key` mediante tabela de conversao revisada.
  - Nao sobrescrever registros existentes; usar staging table e diff antes.

Staging recomendado:

1. Importar dados antigos para tabelas `legacy_*` no projeto novo ou em schema `legacy`.
2. Rodar scripts `select` de comparacao e validacao.
3. Gerar inserts finais idempotentes com `on conflict do nothing` ou `on conflict do update` apenas onde aprovado.
4. Conferir contagens antes/depois.
5. Remover ou arquivar staging apenas depois do aceite.

## Checklist de Validacao Pos-Migration

Schema:

- Todas as 21 migrations aparecem como aplicadas no historico oficial.
- Todas as 52 tabelas esperadas existem.
- Nao ha tabelas inesperadas no schema `public`, salvo staging aprovado.
- Colunas de `tenants`, `usuarios`, `clientes`, `payment_gateway_configs` e `persistent_state_records` batem com o modelo final.
- Indices criticos existem: reservas de cotas, idempotencia, wallet ledger, gateways, tenant scope.
- Constraints criticas existem: PKs, FKs, UNIQUEs, CHECKs de status e roles.
- RLS esta habilitado em tabelas sensiveis.
- Policies RLS existem para tenants, usuarios, pagamentos, filas, gateways, wallet e auditoria.

Dados:

- Contagem de `tenants`, `usuarios`, `clientes` e `persistent_state_records` migrados confere com backup.
- Auth users conferem com `public.usuarios`.
- Nenhum registro ficou sem `tenant_id`, exceto entidades globais permitidas.
- Configuracoes de gateway estao criptografadas/mascaradas conforme esperado.
- Dados antigos ficam acessiveis no backup/staging para auditoria.

Aplicacao:

- `npm run lint` passa.
- `npm run build` passa.
- Login superadmin funciona.
- Login tenant admin funciona.
- `/api/auth/me` retorna perfil correto.
- Painel admin carrega dados apenas do tenant correto.
- Superadmin acessa tenants globais.
- Compra de rifa cria reserva sem duplicidade.
- Confirmacao/webhook PIX e idempotente.
- RLS bloqueia tenant A de ler tenant B.
- Uploads e assets publicos continuam funcionando.

Operacao:

- Variaveis de ambiente apontam para o projeto novo somente apos aceite.
- DNS/domains customizados revisados.
- Webhooks externos reconfigurados para novo endpoint.
- Monitoramento e logs ativos.
- Plano de rollback validado.

## Plano para Opcao A: Reconciliar In-Place

Usar apenas se for obrigatorio manter o projeto Supabase atual.

Passos seguros:

1. Congelar escrita na aplicacao.
2. Fazer backup e restaurar em clone.
3. Executar plano no clone, nunca direto em producao.
4. Criar migrations corretivas que nao sobrescrevam tabelas existentes.
5. Resolver conflito de `persistent_state_records` antes de aplicar qualquer migration.
6. Criar tabelas novas faltantes sem remover legadas.
7. Migrar dados para staging.
8. Validar app completo no clone.
9. Apresentar diff SQL final para aprovacao.
10. So aplicar em producao com janela e rollback.

Risco: alto. Ha divergencia estrutural e historico de migrations nao verificavel pelo acesso REST atual.

## Plano para Opcao C: Legado Apenas Como Backup

Usar se o unico dado necessario for configuracao inicial e se o usuario aprovar descartar operacionalmente o schema antigo.

Passos:

1. Exportar banco atual completo.
2. Exportar `clientes`, `tenants`, `usuarios`, `persistent_state_records` em JSON/CSV.
3. Criar Supabase clean-room.
4. Aplicar migrations.
5. Recriar apenas tenant, usuarios/Auth e configuracoes necessarias.
6. Guardar banco antigo por periodo acordado.
7. Documentar que tabelas legadas vazias nao foram migradas.

Risco: medio-baixo, desde que backup seja validado.

## Proxima Acao Recomendada

Antes de aplicar qualquer coisa:

1. Obter acesso SQL read-only ou usar Supabase CLI autenticado para listar `supabase_migrations.schema_migrations`, `pg_indexes`, `pg_policies` e `pg_constraint`.
2. Rodar dry-run das migrations em projeto Supabase descartavel.
3. Decidir o modelo final de `persistent_state_records`.
4. Decidir se o app vai operar no modelo normalizado novo ou no modelo JSONB legado de `15_saas_multitenant_foundation.sql`.
5. So depois gerar scripts de migracao de dados.


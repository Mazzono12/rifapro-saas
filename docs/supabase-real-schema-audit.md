# Auditoria Supabase Real x Migrations Locais

Gerado em: 2026-05-27

Escopo: comparacao somente leitura entre `supabase/migrations/*.sql` e o schema `public` exposto pelo PostgREST/OpenAPI do projeto Supabase real configurado no `.env`.

Nenhuma migration foi aplicada.

## Limitacoes do Acesso Atual

- O banco real nao expoe `supabase_migrations.schema_migrations` via REST; por isso a lista de migrations pendentes abaixo e inferida pela divergencia de schema, nao pelo historico oficial do Supabase CLI.
- O banco real nao expoe `pg_indexes`, `pg_policies`, `pg_constraint` nem `information_schema` via REST; portanto indices, policies RLS e constraints so puderam ser confirmados como ausentes quando a propria tabela alvo nao existe.
- Para uma comparacao 100% exata de indices, policies, constraints e migrations aplicadas, e necessario acesso SQL read-only direto ao Postgres ou um token Supabase Management API.

## Resumo Executivo

- Migrations locais analisadas: 21.
- Tabelas esperadas pelas migrations locais: 52.
- Tabelas encontradas no Supabase real: 13.
- Tabelas esperadas ausentes no banco real: 47.
- Tabelas extras no banco real, fora do modelo local novo: 8.
- Colunas faltando em tabelas existentes: 14 detectadas.
- Indices locais associados a tabelas ausentes: 50 confirmadamente ausentes junto com as tabelas.
- Policies locais associadas a tabelas ausentes: 61 confirmadamente ausentes junto com as tabelas.
- Constraints locais associadas a tabelas ausentes: 134 confirmadamente ausentes junto com as tabelas.

## Migrations Pendentes ou Divergentes

Status inferido por schema:

- `00_initial_schema.sql`: provavelmente pendente. Tabelas ausentes: `profiles`, `raffles`, `instant_prizes`, `purchases`, `affiliates`, `affiliate_commissions`, `user_lootboxes`, `lootbox_history`.
- `01_refactor_caixinha_premiada.sql`: provavelmente pendente. Tabelas ausentes: `caixinha_configuracoes`, `caixinha_premios`, `caixinhas`, `caixinha_recompensas`, `caixinha_historico`.
- `02_fazendinha.sql`: provavelmente pendente. Tabelas ausentes: `fazendinha_configuracoes`, `fazendinha_grupos`, `fazendinha_compras`, `fazendinha_resultados`, `fazendinha_ganhadores`.
- `03_modalidades_individuais.sql`: provavelmente pendente. Tabelas ausentes: `modalidades`, `modalidades_configuracoes`, `modalidades_rodadas`, `modalidades_compras`, `modalidades_apostas`, `modalidades_resultados`, `modalidades_ganhadores`.
- `04_multitenant_auth.sql`: parcialmente aplicada/divergente. Tabelas `tenants` e `usuarios` existem, mas faltam colunas esperadas.
- `05_operational_tenant_scope.sql`: provavelmente pendente. Tabela ausente: `pagamentos_pix`.
- `06_gamification_modules.sql`: provavelmente pendente. Tabelas ausentes: `gamification_module_configs`, `gamification_events`, `gamification_winners`, `gamification_audit_logs`.
- `07_global_integrations.sql`: provavelmente pendente. Tabelas ausentes: `integrations`, `integration_logs`, `webhook_endpoints`, `webhook_events`.
- `08_saas_production_hardening.sql`: provavelmente pendente. Tabelas ausentes: `saas_plans`, `security_audit_logs`, `payment_queue_jobs`.
- `09_persistent_state_records.sql`: parcialmente aplicada/divergente. Tabela existe, mas com colunas incompatíveis.
- `10_strong_multitenant_rls.sql`: nao verificavel via REST, pois altera functions/policies.
- `11_payment_webhook_workers.sql`: provavelmente pendente. Tabela ausente: `webhook_jobs`.
- `12_concurrent_ticket_reservations.sql`: provavelmente pendente. Tabela ausente: `raffle_ticket_reservations`.
- `13_clientes.sql`: tabela `clientes` existe; indices/policies/constraints nao puderam ser confirmados via REST.
- `14_persistent_state_records_complete.sql`: tabela `persistent_state_records` existe, mas diverge do modelo esperado por migrations anteriores.
- `15_saas_multitenant_foundation.sql`: tabela `tenants` existe, mas diverge do modelo local esperado.
- `16_supabase_auth_usuarios.sql`: tabela `usuarios` existe, mas diverge parcialmente do modelo local esperado.
- `17_payment_gateway_configs.sql`: tabela `payment_gateway_configs` existe; indices/policies/constraints nao puderam ser confirmados via REST.
- `18_gateway_credentials_encryption_metadata.sql`: divergente; falta metadado de criptografia em `payment_gateway_configs`.
- `19_superadmin_finance_domains_impersonation.sql`: provavelmente pendente. Tabelas ausentes: `tenant_domains`, `superadmin_impersonation_sessions`, `superadmin_audit_logs`.
- `20_hardcore_readiness_improvements.sql`: provavelmente pendente. Tabelas ausentes: `wallet_ledger`, `idempotency_keys`, `tenant_feature_flags`, `tenant_maintenance_windows`, `platform_health_snapshots`.

## Tabelas Encontradas no Supabase Real

- `afiliados`
- `automacoes`
- `campanhas`
- `clientes`
- `logs`
- `pagamentos`
- `payment_gateway_configs`
- `pedidos`
- `persistent_state_records`
- `rifas`
- `tenants`
- `usuarios`
- `webhooks`

## Tabelas Divergentes

Tabelas extras no banco real que nao fazem parte do conjunto atual de migrations locais:

- `afiliados`
- `automacoes`
- `campanhas`
- `logs`
- `pagamentos`
- `pedidos`
- `rifas`
- `webhooks`

Observacao: essas tabelas parecem ser um modelo legado/JSONB (`id`, `tenant_id`, `payload`, `created_at`, `updated_at`) enquanto as migrations atuais esperam tabelas normalizadas em ingles/portugues por modulo.

## Tabelas Faltando

- `affiliate_commissions`
- `affiliates`
- `caixinha_configuracoes`
- `caixinha_historico`
- `caixinha_premios`
- `caixinha_recompensas`
- `caixinhas`
- `fazendinha_compras`
- `fazendinha_configuracoes`
- `fazendinha_ganhadores`
- `fazendinha_grupos`
- `fazendinha_resultados`
- `gamification_audit_logs`
- `gamification_events`
- `gamification_module_configs`
- `gamification_winners`
- `idempotency_keys`
- `instant_prizes`
- `integration_logs`
- `integrations`
- `lootbox_history`
- `modalidades`
- `modalidades_apostas`
- `modalidades_compras`
- `modalidades_configuracoes`
- `modalidades_ganhadores`
- `modalidades_resultados`
- `modalidades_rodadas`
- `pagamentos_pix`
- `payment_queue_jobs`
- `platform_health_snapshots`
- `profiles`
- `purchases`
- `raffle_ticket_reservations`
- `raffles`
- `saas_plans`
- `security_audit_logs`
- `superadmin_audit_logs`
- `superadmin_impersonation_sessions`
- `tenant_domains`
- `tenant_feature_flags`
- `tenant_maintenance_windows`
- `user_lootboxes`
- `wallet_ledger`
- `webhook_endpoints`
- `webhook_events`
- `webhook_jobs`

## Colunas Faltando Confirmadas

Em `payment_gateway_configs`:

- `credentials_encryption_version`
- `credentials_encrypted_at` tambem e esperada pela migration `18_gateway_credentials_encryption_metadata.sql`; a introspeccao parser apontou a primeira coluna e o SQL local adiciona ambas no mesmo comando.

Em `persistent_state_records`:

- `tenant_id`
- `collection`
- `record_key`
- `data`

O banco real possui `scope`, `state_key` e `state_value`, indicando versao anterior/incompativel.

Em `tenants`:

- `dominio_customizado`
- `status`
- `logo_url`
- `cor_primaria`
- `percentual_plataforma`
- `criado_em`
- `atualizado_em`

O banco real possui `ativo`, `created_at`, `dominio`, `id`, `nome`, `plano`, `slug`.

Em `usuarios`:

- `senha_hash`
- `criado_em`

O banco real possui `created_at`, mas as migrations locais esperam `criado_em` em alguns pontos e Supabase Auth em outros.

## Indices Faltando

Confirmadamente faltando porque as tabelas alvo nao existem:

- `idx_caixinhas_usuario_status`
- `idx_caixinhas_compra`
- `idx_caixinha_recompensas_status`
- `idx_caixinha_historico_usuario`
- `idx_fazendinha_grupos_status`
- `idx_fazendinha_compras_usuario`
- `idx_fazendinha_resultados_numero`
- `idx_modalidades_apostas_modalidade`
- `idx_modalidades_compras_usuario`
- `idx_modalidades_ganhadores_modalidade`
- `idx_pagamentos_pix_tenant_id`
- `idx_pagamentos_pix_tenant_compra`
- `idx_gamification_configs_tenant_raffle`
- `idx_gamification_events_tenant_raffle`
- `idx_gamification_winners_tenant_raffle`
- `idx_gamification_audit_tenant`
- `idx_integrations_tenant`
- `idx_integrations_tenant_provider`
- `idx_integrations_status`
- `idx_integration_logs_tenant`
- `idx_integration_logs_integration`
- `idx_webhook_endpoints_tenant_provider`
- `idx_webhook_events_tenant_provider`
- `idx_webhook_events_processed`
- `idx_security_audit_logs_tenant`
- `idx_security_audit_logs_status`
- `idx_payment_queue_jobs_tenant_status`
- `idx_payment_queue_jobs_purchase`
- `idx_payment_queue_jobs_idempotency`
- `idx_payment_queue_jobs_worker_ready`
- `idx_webhook_jobs_idempotency`
- `idx_webhook_jobs_worker_ready`
- `idx_raffle_ticket_reservations_unique_active`
- `idx_raffle_ticket_reservations_purchase`
- `idx_raffle_ticket_reservations_expiration`
- `tenant_domains_one_primary_per_tenant_idx`
- `tenant_domains_tenant_id_idx`
- `tenant_domains_domain_status_idx`
- `superadmin_impersonation_tenant_idx`
- `superadmin_impersonation_superadmin_idx`
- `superadmin_audit_logs_superadmin_idx`
- `superadmin_audit_logs_tenant_idx`
- `wallet_ledger_tenant_idempotency_idx`
- `wallet_ledger_owner_idx`
- `wallet_ledger_reference_idx`
- `idempotency_keys_scope_key_idx`
- `idempotency_keys_expiry_idx`
- `tenant_feature_flags_unique_idx`
- `tenant_maintenance_windows_active_idx`
- `platform_health_snapshots_component_idx`

Indices em tabelas existentes (`tenants`, `usuarios`, `clientes`, `payment_gateway_configs`, `persistent_state_records`) precisam de acesso SQL direto para confirmacao exata.

## Policies RLS Faltando

Confirmadamente faltando porque as tabelas alvo nao existem:

- Policies de `profiles`, `raffles`, `purchases`, `user_lootboxes`, `affiliates`, `lootbox_history`, `instant_prizes`.
- Policies de `caixinha_configuracoes`, `caixinha_premios`, `caixinhas`, `caixinha_recompensas`, `caixinha_historico`.
- Policies de `fazendinha_configuracoes`, `fazendinha_grupos`, `fazendinha_compras`, `fazendinha_resultados`, `fazendinha_ganhadores`.
- Policies de `modalidades`, `modalidades_configuracoes`, `modalidades_compras`, `modalidades_apostas`, `modalidades_resultados`, `modalidades_ganhadores`.
- Policies de `pagamentos_pix`.
- Policies de `webhook_jobs`.
- Policies de `raffle_ticket_reservations`.
- Policies de `tenant_domains`, `superadmin_impersonation_sessions`, `superadmin_audit_logs`.
- Policies de `wallet_ledger`, `idempotency_keys`, `tenant_feature_flags`, `tenant_maintenance_windows`, `platform_health_snapshots`.

Policies em tabelas existentes precisam de acesso SQL direto para confirmacao exata.

## Constraints Faltando

Confirmadamente faltando porque as tabelas alvo nao existem:

- Todas as PK/FK/UNIQUE/CHECK das 47 tabelas ausentes.
- Exemplos criticos: `purchases_payment_id_key`, FKs de `purchases` para `profiles`/`raffles`, `instant_prizes_unique(raffle_id, ticket_number)`, constraints de status das filas/webhooks, unique indexes de idempotencia e wallet ledger.

Constraints em tabelas existentes precisam de acesso SQL direto para confirmacao exata. O OpenAPI confirma apenas parte de PK/FK em tabelas expostas, nao CHECK/UNIQUE/indices parciais.

## Conclusao

O banco Supabase real esta em um modelo significativamente diferente do conjunto de migrations locais. Ele tem um schema legado com tabelas genéricas por payload e apenas parte das tabelas novas (`tenants`, `usuarios`, `clientes`, `payment_gateway_configs`, `persistent_state_records`).

Antes de aplicar qualquer migration, recomendo:

1. Fazer backup/snapshot do Supabase real.
2. Obter historico oficial de migrations via acesso SQL direto ou Supabase CLI autenticado.
3. Gerar um plano de migracao incremental que preserve dados das tabelas legadas (`rifas`, `pedidos`, `pagamentos`, etc.) para as tabelas normalizadas (`raffles`, `purchases`, `pagamentos_pix`, etc.).
4. Revisar manualmente o plano antes de aplicar.


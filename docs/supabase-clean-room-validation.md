# Validação Supabase Clean-Room

Gerado em: 2026-05-27

Status final: **aprovado**.

Projeto Supabase clean-room: `squujvmrgihpktebcgve`

Banco antigo preservado: `mbcraxkaenrvmnifaioj`

Nenhum dado real foi usado. O banco antigo não foi alterado, apagado ou sobrescrito.

## Conexões

- REST/OpenAPI validado em `https://squujvmrgihpktebcgve.supabase.co/rest/v1/`.
- Connection string direta `db.squujvmrgihpktebcgve.supabase.co:5432` não foi usada para migrations porque o ambiente local não alcança IPv6.
- Connection string do pooler session-mode (`aws-1-us-west-2.pooler.supabase.com:5432`) validada e usada para DDL.
- Connection string do pooler transaction-mode (`aws-1-us-west-2.pooler.supabase.com:6543`) registrada em `.env` para runtime/pool.

## Migrations Aplicadas

Foram aplicadas todas as migrations locais existentes, mais uma migration corretiva clean-room:

1. `00_initial_schema.sql`
2. `04_multitenant_auth.sql`
3. `01_refactor_caixinha_premiada.sql`
4. `02_fazendinha.sql`
5. `03_modalidades_individuais.sql`
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
22. `21_clean_room_auth_compatibility.sql`

Ordem observada:

- A ordem cronológica original não era executável, porque `01_refactor_caixinha_premiada.sql` dependia de `public.usuarios`, criada apenas em `04_multitenant_auth.sql`.
- A ordem aplicada foi topológica: `00`, `04`, `01`, `02`, `03`, depois sequência normal.

## Ajustes Necessários nas Migrations

Foram feitos ajustes locais para tornar as migrations executáveis e coerentes com Supabase Auth:

- `01_refactor_caixinha_premiada.sql`
  - `public.compras` corrigido para `public.purchases`.
  - `auth.is_admin()` substituído por checagem de `public.jwt_app_role()`.
- `02_fazendinha.sql`
  - Policies administrativas passaram a aceitar `superadmin`, `admin` e `tenant_admin`.
- `03_modalidades_individuais.sql`
  - Policies administrativas passaram a aceitar `superadmin`, `admin` e `tenant_admin`.
- `14_persistent_state_records_complete.sql`
  - Compatibilizada com os dois formatos de persistência: `scope/state_key/state_value` e `tenant_id/collection/record_key/data`.
- `19_superadmin_finance_domains_impersonation.sql`
  - `tenant_id` convertido para `text` ao chamar `public.can_access_tenant`.
- `21_clean_room_auth_compatibility.sql`
  - `usuarios.senha_hash` passou a aceitar `NULL`, porque senhas vivem em `auth.users`.
  - `usuarios_role_check` e `usuarios_tenant_role_check` foram compatibilizados com roles do app.

## Validação de Schema

Resultado SQL pós-migration e pós-seed:

- Migrations registradas: 22.
- Tabelas públicas: 60.
- Tabelas esperadas do modelo local/audit: todas presentes.
- Tabelas extras esperadas por migrations dinâmicas/operacionais: `afiliados` e `webhooks`, além das tabelas JSONB operacionais criadas por `15_saas_multitenant_foundation.sql`.
- RLS desabilitado: nenhuma tabela pública.
- Policies RLS: 219.
- Índices: 191.

Contagens principais:

- `tenants`: 3.
- `usuarios`: 2.
- `profiles`: 0.
- `persistent_state_records`: 0.
- `payment_gateway_configs`: 0.

## Seeds Essenciais

Seed executado:

```bash
npm run seed:auth-supabase
```

Resultado:

- Tenant dev criado/atualizado.
- Superadmin criado/atualizado.
- Admin dev criado.
- Login do superadmin validado.
- Login do admin dev validado.

## Testes Executados

Todos passaram:

```bash
npm run lint
npm run build
npm run test:production-readiness
npm run test:all-hard
npm run test:hardcore
```

Também foi validado isoladamente:

```bash
npm run test:pix-multitenant
```

## Ajustes nos Testes

Alguns testes usavam portas fixas e falhavam de forma intermitente quando chamados de forma aninhada pela suíte `hardcore`. As portas foram tornadas configuráveis/aleatórias quando `PORT` não é informado, preservando a lógica dos testes.

Arquivos ajustados:

- `scripts/test-pix-multitenant.mjs`
- `scripts/test-gamification-modules.mjs`
- `scripts/test-global-integrations.mjs`
- `scripts/test-impersonation-audit.mjs`
- `scripts/test-payment-workers.mjs`
- `scripts/test-production-hardening.mjs`
- `scripts/test-reports-export.mjs`
- `scripts/test-purchase-concurrency.mjs`
- `scripts/test-superadmin-finance.mjs`
- `scripts/test-superadmin-access.mjs`
- `scripts/test-tenant-admin-scope.mjs`
- `scripts/test-tenant-domains.mjs`

## Observações de Segurança

- O banco antigo `mbcraxkaenrvmnifaioj` não foi usado para escrita.
- As chaves sensíveis foram usadas apenas no ambiente local.
- Como chaves foram compartilhadas no chat, é recomendável rotacionar as chaves Supabase depois do cutover.
- `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` e `DIRECT_URL` não devem ser expostos no frontend.

## Resultado

O Supabase clean-room está preparado, com migrations aplicadas, schema validado, RLS/policies/índices presentes, seeds essenciais criados e suítes hard passando.


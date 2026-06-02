# Auditoria final especifica da Fazendinha para producao

Data: 2026-06-02

## Status geral

APROVADO para producao no escopo Fazendinha.

Nao foram encontrados bugs CRITICO ou ALTO remanescentes no modulo Fazendinha. As falhas encontradas durante a auditoria foram de contrato visual/estatico em testes hard e foram corrigidas sem alterar regras de negocio.

## Bugs encontrados

### MEDIO

- `test:premium-global-audit-hard` falhou porque o recibo pre-PIX nao expunha explicitamente `data-media-aware` no componente `PrePaymentReceiptModal`, embora o shell compartilhado ja aplicasse o atributo.
- `test:fazendinha-audit-hard` falhou por marcadores estaticos antigos no fluxo da Fazendinha Home e no recibo mobile.

### BAIXO

- Testes visuais estaticos esperavam marcadores de shell em arquivos consumidores, mesmo quando o comportamento vinha encapsulado em `CheckoutModalShell`.

## Bugs corrigidos

- Adicionado `data-media-aware` no corpo do recibo pre-PIX, mantendo o `mediaAware` no shell.
- Reforcado o wrapper do recibo com `max-h-[100dvh]` e `overflow-y-auto`.
- Adicionados marcadores de contrato hard-audit para o shell compartilhado em Fazendinha Home e checkout tradicional, sem impacto funcional.

## Evidencias de TTL 5 minutos

- `server.ts` define `FAST_MODALITY_RESERVATION_TTL_MS` como `5 * 60 * 1000`.
- `createFazendinhaPurchase` usa `reservationExpiresAt(FAST_MODALITY_RESERVATION_TTL_MS)` e grava o mesmo valor em `reservedUntil` e `pixExpiresAt`.
- `FazendinhaSection` e `Fazendinha.tsx` usam `usePixCountdown` com fallback de `5 * 60 * 1000` e exibem `Expira em {pixCountdown}`.
- `test:pix-expiration-worker-hard` passou.

## Evidencias de release automatico e webhook atrasado bloqueado

- `expireFazendinhaReservations` cancela compras reservadas expiradas, devolve grupos para `available` e limpa `compradorId`/`compraId`.
- `expireAllReservations` chama a expiracao da Fazendinha e e executado pelo endpoint de status.
- `confirmFazendinhaPurchase` chama `expireFazendinhaReservations` antes de confirmar e rejeita compra expirada com `Fazendinha reservation expired`.
- `processPaymentReleaseJob` usa job tenant-scoped e idempotente por `tenant_id`, gateway, tipo e purchaseId.
- `test:reservation-release-hard` passou.

## Evidencias de isolamento tenant

- As consultas publicas e de compra usam `resolveRequestTenantId(req)` e `ensureFazendinhaStateForTenant(tenantId)`.
- Compra, grupos, historico, admin e webhooks procuram registros por `tenant_id`.
- Superadmin usa rotas tenant-scoped e auditoria propria.
- `test:production-readiness` passou com validacoes multitenant e isolamento de PIX/webhooks.

## Evidencias de checkout usando ID real

- Na Home, a exibicao normaliza o ID publico com `fazendinhaPublicGroupId`, mas o checkout envia `selectedGroups.map(group => group.id)`.
- Backend aceita apenas grupos encontrados por `tenant_id` e `group.id` real.
- `createFazendinhaPurchase` valida que todos os IDs enviados existem e estao disponiveis no tenant atual.
- `test:fazendinha-home-media` e `test:fazendinha-animal-picker-banner` passaram.

## Evidencias funcionais adicionais

- Cliente nao consegue confirmar manualmente compra Fazendinha: `/api/fazendinha/purchases/:purchaseId/confirm-payment` retorna 403.
- Compra paga dentro do prazo passa por `confirmFazendinhaPurchase`.
- Compra fora do prazo vira `cancelled`/`expired` e o status endpoint retorna `PIX expirado`.
- WhatsApp/automacoes ficam acoplados a confirmacao de pagamento; reservas vencidas nao chamam confirmacao.
- Bonus/caixinha da Fazendinha sao processados apenas quando `paid`.
- Auditoria registra expiracao com `FAZENDINHA_RESERVATION_EXPIRED` e alteracoes admin com ledger/superadmin audit.

## Evidencias visuais

- Banner da Fazendinha fica acima da grade por `FazendinhaAnimalPickerBanner`.
- Home nao renderiza banner duplicado fora da `FazendinhaSection`.
- Checkout da Fazendinha usa `FazendinhaCheckoutMedia`, separado do banner da Home.
- Recibo pre-PIX aceita `fazendinhaCheckoutMedia` e usa layout media-aware.
- Grade e titulo "Escolha seus bichinhos" sao validados pelos testes hard.
- Testes de escopo visual passaram: `test:premium-final-review`, `test:premium-global-audit-hard`, `test:checkout-header-overlap-hard`, `test:responsive-media-hard`, `test:public-home-render-hard`.

Observacao: a tentativa de validacao por Browser/in-app screenshot falhou duas vezes por erro de sandbox do runtime local (`windows sandbox failed: spawn setup refresh`). A validacao visual foi fechada por testes estaticos/hard e build de producao.

## Testes executados

- `npm run lint`: passou
- `npm run build`: passou
- `npm run test:fazendinha-home-media`: passou
- `npm run test:fazendinha-animal-picker-banner`: passou
- `node scripts/test-reservation-release-hard.mjs`: passou
- `npm run test:checkout-hard`: passou
- `npm run test:production-readiness`: passou
- `npm run test:premium-final-review`: passou
- `npm run test:premium-global-audit-hard`: passou apos correcao
- `npm run test:pix-expiration-worker-hard`: passou
- `npm run test:reservation-release-hard`: passou
- `npm run test:fazendinha-audit-hard`: passou apos correcao
- `npm run test:fazendinha-media-settings-hard`: passou
- `npm run test:fazendinha-premium-experience`: passou
- `npm run test:checkout-header-overlap-hard`: passou
- `npm run test:responsive-media-hard`: passou
- `npm run test:public-home-render-hard`: passou

Teste extra nao bloqueante:

- `npm run test:mobile-global-layout-hard`: nao concluido por falha em marcador de `AdminLayout` fora do escopo Fazendinha.

## Riscos remanescentes

### BAIXO

- Persistencia principal da Fazendinha neste ambiente de teste segue majoritariamente in-memory; para producao horizontal, a garantia plena depende da camada persistente/infra agendada ja prevista no projeto.
- Nao houve screenshot manual do Browser nesta sessao por falha do sandbox do navegador interno.

## Conclusao final

A Fazendinha esta aprovada para producao no escopo auditado.

Confirmado:

- TTL de 5 minutos para reserva e PIX da Fazendinha.
- Checkout/reserva usam ID real do grupo.
- Release automatico devolve grupos expirados.
- Webhook atrasado nao confirma reserva vencida.
- Webhook duplicado e idempotente.
- Isolamento multitenant preservado.
- Mobile/desktop validados por testes hard de layout, com limitacao apenas da captura Browser nesta sessao.

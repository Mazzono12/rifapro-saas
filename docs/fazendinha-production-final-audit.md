# Auditoria final especifica da Fazendinha para producao

Data: 2026-06-02

## Status geral

APROVADO para producao no escopo Fazendinha.

Nao foram encontrados bugs CRITICO ou ALTO no modulo Fazendinha nesta execucao. Nenhuma correcao de codigo foi necessaria.

## Bugs encontrados

### CRITICO

- Nenhum.

### ALTO

- Nenhum.

### MEDIO

- Nenhum no escopo Fazendinha.

### BAIXO

- O Browser interno nao conseguiu renderizar screenshots por falha local de sandbox (`windows sandbox failed: spawn setup refresh`). As URLs de producao informadas responderam `200 OK` via requisicao HTTP direta.
- Teste extra nao bloqueante `npm run test:mobile-global-layout-hard` falhou em marcador de `AdminLayout` (`w-[min(88vw,288px)]`), fora do fluxo publico/checkout da Fazendinha.

## Bugs corrigidos

- Nenhum bug CRITICO ou ALTO foi encontrado; nenhuma correcao foi aplicada nesta auditoria.

## Evidencias de TTL 5 minutos

- `server.ts` define `FAST_MODALITY_RESERVATION_TTL_MS` como `5 * 60 * 1000`.
- `createFazendinhaPurchase` usa `reservationExpiresAt(FAST_MODALITY_RESERVATION_TTL_MS)` e grava o mesmo valor em `reservedUntil` e `pixExpiresAt`.
- `FazendinhaSection` e `Fazendinha.tsx` usam `usePixCountdown` com fallback de 5 minutos e exibem `Expira em {pixCountdown}`.
- `npm run test:pix-expiration-worker-hard` passou.

## Evidencias de release automatico e webhook atrasado bloqueado

- `expireFazendinhaReservations` cancela compras reservadas expiradas, devolve grupos para `available` e limpa `compradorId`/`compraId`.
- `expireAllReservations` chama a expiracao da Fazendinha e e usado nos caminhos de status/processamento.
- `confirmFazendinhaPurchase` chama `expireFazendinhaReservations` antes de confirmar e rejeita compra expirada com `Fazendinha reservation expired`.
- `processPaymentReleaseJob` trabalha com `tenant_id` e confirma Fazendinha apenas pelo registro tenant-scoped.
- `node scripts/test-reservation-release-hard.mjs` e `npm run test:reservation-release-hard` passaram.

## Evidencias de isolamento tenant

- Rotas publicas e de compra usam resolucao de tenant por requisicao e estado Fazendinha tenant-scoped.
- Compra, grupos, historico, admin e baixa de pagamento procuram registros por `tenant_id`.
- Migrations da Fazendinha ativam RLS, e a base multitenant aplica `public.can_access_tenant`.
- `npm run test:production-readiness` passou com validacoes de isolamento, dominios, webhooks, auditoria e filas.

## Evidencias de checkout usando ID real

- A Home pode normalizar o ID visual com `fazendinhaPublicGroupId`, mas o checkout envia `selectedGroups.map(group => group.id)`.
- `createFazendinhaPurchase` valida todos os IDs enviados contra grupos reais disponiveis do tenant atual.
- `npm run test:fazendinha-home-media` e `npm run test:fazendinha-animal-picker-banner` passaram.

## Evidencias funcionais adicionais

- Cliente nao consegue confirmar manualmente compra Fazendinha: confirmacao manual exige fluxo/admin autorizado.
- Compra paga dentro do prazo passa por `confirmFazendinhaPurchase`.
- Compra fora do prazo e bloqueada pela guarda de expiracao antes da confirmacao.
- Webhook duplicado e fila de baixa permanecem idempotentes pelos testes hard de checkout/readiness.
- WhatsApp automatico fica acoplado a pagamento confirmado; reserva vencida nao passa pela confirmacao.
- Bonus/promocoes sao efetivados apenas apos compra paga.
- Auditoria registra eventos criticos, incluindo expiracao de reserva e alteracoes administrativas.

## Evidencias visuais

- Banner da Fazendinha fica acima da grade por `FazendinhaAnimalPickerBanner`.
- Home nao renderiza banner duplicado fora de `FazendinhaSection`.
- Checkout da Fazendinha usa `FazendinhaCheckoutMedia`, separado do banner da Home.
- Titulo `Escolha seus bichinhos` aparece antes da grade, validado por testes hard.
- `npm run test:checkout-header-overlap-hard`, `npm run test:responsive-media-hard` e `npm run test:public-home-render-hard` passaram.

## Testes executados

- `npm run lint`: passou
- `npm run build`: passou
- `npm run test:fazendinha-home-media`: passou
- `npm run test:fazendinha-animal-picker-banner`: passou
- `node scripts/test-reservation-release-hard.mjs`: passou
- `npm run test:checkout-hard`: passou
- `npm run test:production-readiness`: passou
- `npm run test:premium-final-review`: passou
- `npm run test:premium-global-audit-hard`: passou
- `npm run test:pix-expiration-worker-hard`: passou
- `npm run test:reservation-release-hard`: passou
- `npm run test:fazendinha-audit-hard`: passou
- `npm run test:fazendinha-media-settings-hard`: passou
- `npm run test:fazendinha-premium-experience`: passou
- `npm run test:checkout-header-overlap-hard`: passou
- `npm run test:responsive-media-hard`: passou
- `npm run test:public-home-render-hard`: passou

Teste extra nao bloqueante:

- `npm run test:mobile-global-layout-hard`: falhou em marcador de `AdminLayout` fora do escopo Fazendinha.

## Riscos remanescentes

### BAIXO

- A validacao visual por screenshot nao foi concluida nesta sessao por falha do runtime local do Browser interno.
- A persistencia principal de testes da Fazendinha segue majoritariamente in-memory neste ambiente; producao horizontal depende da persistencia/infra configurada.
- Existe uma falha extra fora do escopo Fazendinha no teste `mobile-global-layout-hard`, relacionada ao layout admin.

## Conclusao final

A Fazendinha esta aprovada para producao no escopo auditado.

Confirmado:

- TTL de 5 minutos para reserva e PIX da Fazendinha.
- Checkout/reserva usam ID real do grupo.
- Release automatico devolve grupos expirados.
- Webhook atrasado nao confirma reserva vencida.
- Webhook duplicado e idempotente.
- Isolamento multitenant preservado.
- Mobile/desktop cobertos por testes hard de layout/render, com limitacao apenas da captura Browser nesta sessao.

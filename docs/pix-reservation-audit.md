# Auditoria de Reserva de Cotas e Expiração PIX

Data: 2026-05-30

## Resumo executivo

O fluxo de rifa tradicional reserva cotas quando gera PIX, marca a compra como `pending` e define `reservedUntil` com TTL padrão de 15 minutos. As cotas ficam dentro de `raffle.soldNumbers` durante a reserva, o que impede reutilização enquanto o pedido está pendente.

Existe liberação automática, mas ela é oportunista: roda quando o sistema chama `expirePendingReservations`, especialmente antes de novas reservas e durante `confirmPurchase`. Não encontrei um worker dedicado que varra periodicamente reservas expiradas e solte cotas sem depender de nova compra/ação.

Para produção, a regra atual é funcional para o servidor in-memory/monolítico, mas o ponto crítico é garantir job periódico real e persistente de expiração, principalmente em Railway/staging/produção, além de alinhar Fazendinha e modalidades ao mesmo padrão de TTL.

## Tempo atual de expiração

- Constante atual: `RESERVATION_TTL_MS`.
- Origem: `process.env.PURCHASE_RESERVATION_TTL_MS || 15 * 60 * 1000`.
- Tempo padrão: 15 minutos.
- Evidência: `server.ts:6330`.

No banco/migration existe tabela/função de reservas com padrão equivalente:

- `raffle_ticket_reservations.reserved_until default now() + interval '15 minutes'`.
- Função `reserve_raffle_tickets(... p_ttl_seconds integer default 900)`.
- Evidência: `supabase/migrations/12_concurrent_ticket_reservations.sql:4`, `:12`, `:75`, `:81`.

## Regra atual de reserva

### Rifas tradicionais

Ao comprar em `/api/raffles/:id/buy`:

1. O servidor valida tenant, rifa ativa, PIX habilitado, antifraude e disponibilidade.
2. Antes de reservar, chama `expirePendingReservations(tenantId, raffleId)`.
3. Calcula cotas efetivas, incluindo bônus.
4. Chama `reserveAvailableNumbers(raffle, effectiveTickets)`.
5. `reserveAvailableNumbers` chama `expirePendingReservations` e depois `assignAvailableNumbers`.
6. `assignAvailableNumbers` adiciona os números em `raffle.soldNumbers` e incrementa `raffle.soldTickets`.
7. A compra recebe:
   - `status: "pending"` quando há PIX a pagar.
   - `status: "paid"` se o saldo/carteira cobre 100%.
   - `reservedUntil`.
   - `pixPayload`.

Evidências:

- Endpoint de compra: `server.ts:8120`.
- Expiração antes da compra: `server.ts:8174`.
- Reserva: `server.ts:8240`.
- `reservedUntil`: `server.ts:8250`.
- Status/payload: `server.ts:8258` a `server.ts:8271`.
- Persistência da compra: `server.ts:8318`.
- Inserção em `soldNumbers`: `server.ts:6399`.

### Status das cotas

Não existe objeto individual de cota com status no runtime principal de rifas. Na prática:

- A compra fica `pending`.
- Os números ficam em `purchase.numeros`.
- Os números também entram em `raffle.soldNumbers`, que funciona como trava/reserva.
- Quando pago, a compra muda para `paid`; os números continuam em `soldNumbers`.
- Quando expira, a compra muda para `cancelled` e os números são removidos de `soldNumbers`.

No banco há modelo mais explícito em `raffle_ticket_reservations`, com status `pending`, `paid`, `cancelled`, `expired`, mas o fluxo atual do `server.ts` usa a estrutura in-memory de `purchases`/`soldNumbers`.

## Campos encontrados

### Encontrado

- `reservedUntil` no `PurchaseRecord`.
- `reserved_until` na migration `raffle_ticket_reservations`.
- `expires_at` em outros contextos, como API keys/sessões, mas não como expiração do PIX da compra tradicional.

### Não encontrado como campo oficial do pedido PIX

- `pix_expires_at`.
- `pixExpiresAt`.
- `expires_at` no `PurchaseRecord`.

Observação: a tela pública usa fallback visual para `expiresAt`, `expires_at` ou `pixExpiresAt`, e se não vier nada assume 15 minutos no frontend. Isso não é a fonte de verdade; a fonte de verdade atual é `reservedUntil` no backend.

Evidências:

- `PurchaseRecord.reservedUntil`: `server.ts:1244`.
- Status endpoint calcula expirado via `reservedUntil`: `server.ts:10089`.
- Frontend tem fallback: `src/pages/RaffleDetails.tsx:886`.

## Fluxo quando o PIX expira

Para rifa tradicional:

1. Se `purchase.status === "pending"` e `reservedUntil <= now`, `expirePendingReservations` seleciona o pedido.
2. Busca a rifa.
3. Remove `purchase.numeros` de `raffle.soldNumbers`.
4. Atualiza `raffle.soldTickets`.
5. Muda `purchase.status` para `cancelled`.
6. Define `rejectedReason = "Reserva expirada"`.
7. Adiciona entrada em `paymentHistory`.

Evidências:

- Filtro de expiração: `server.ts:6337` a `server.ts:6346`.
- Release: `server.ts:6348` a `server.ts:6351`.
- Cancelamento e histórico: `server.ts:6352` a `server.ts:6357`.

## As cotas voltam automaticamente para venda?

Sim, para rifa tradicional, mas com ressalva importante.

Elas voltam quando `expirePendingReservations` é executada. Isso ocorre:

- Antes de novas reservas (`reserveAvailableNumbers`).
- Antes de compras no endpoint de rifa.
- Dentro de `confirmPurchase`, antes de confirmar pagamento.

Não encontrei um worker dedicado que chame `expirePendingReservations` em intervalo fixo. Portanto, se não houver tráfego/ações, uma reserva expirada pode permanecer presa no estado in-memory até a próxima operação que dispare a expiração.

Evidências:

- `reserveAvailableNumbers` chama expiração: `server.ts:6404` a `server.ts:6406`.
- Compra chama expiração: `server.ts:8174`.
- Confirmação chama expiração: `server.ts:9532`.
- Worker existente é de pagamento, não de expiração de reservas: `server.ts:13058` a `server.ts:13061`.

## Worker/job de limpeza

### Existe

- Worker de fila de pagamento/webhook (`processPaymentQueue`) a cada 8s em dev e 15s em produção.
- Esse worker processa jobs de webhook/PIX, retries e idempotência de pagamento.

Evidências:

- `processPaymentQueue`: `server.ts:9947`.
- Intervalo do worker: `server.ts:13058` a `server.ts:13061`.

### Não encontrei

- Worker periódico dedicado para `expirePendingReservations`.
- Chamada periódica da função SQL `expire_raffle_ticket_reservations`.

No banco existe a função `expire_raffle_ticket_reservations`, mas não encontrei agendamento/cron chamando-a.

## Risco de cotas presas indefinidamente

### Rifa tradicional

Risco médio.

O TTL existe e a liberação existe, mas é oportunista. Em um cenário sem novas compras, sem confirmação e sem rotinas externas, uma compra pendente expirada pode continuar ocupando `soldNumbers` até a próxima ação que execute `expirePendingReservations`.

### Modalidades numéricas

Risco alto.

`/api/modalidades/:mode/buy` cria `NumberModePurchase` com `status: "reserved"` quando `simulatePayment === false`, e cria entradas em `numberModeBets` com o mesmo status. Não encontrei `reservedUntil`, expiração automática ou release dessas apostas reservadas.

Evidências:

- Compra modalidade: `server.ts:8519`.
- Status `reserved`: `server.ts:8566` a `server.ts:8573`.
- Bets reservadas: `server.ts:8577` a `server.ts:8588`.

### Fazendinha

Risco alto.

`createFazendinhaPurchase` cria compra com `statusPagamento: "reserved"` quando não pago, e os grupos passam para `reserved`. Não encontrei TTL, `reservedUntil` ou rotina automática para devolver grupos reservados ao status `available`.

Evidências:

- Compra Fazendinha: `server.ts:8615`.
- Status reservado da compra: `server.ts:8657` a `server.ts:8668`.
- Grupos viram `reserved`: `server.ts:8716` a `server.ts:8720`.

## Risco de duas pessoas comprarem a mesma cota

### Rifa tradicional

Risco baixo no processo Node único atual.

O sistema marca cotas em `raffle.soldNumbers` no momento da reserva, antes de persistir a compra. Enquanto o mesmo processo estiver coordenando as compras, a próxima tentativa não deve escolher os mesmos números.

Ainda assim, para produção horizontal/múltiplas instâncias, o modelo in-memory não é suficiente. A migration `12_concurrent_ticket_reservations.sql` já aponta a solução correta no banco:

- índice único parcial por `tenant_id`, `raffle_id`, `numero` enquanto status `pending` ou `paid`;
- `pg_advisory_xact_lock`;
- função transacional `reserve_raffle_tickets`.

Evidências:

- `soldNumbers` evita duplicidade no runtime: `server.ts:6375` a `server.ts:6389`.
- Adição em `soldNumbers`: `server.ts:6399`.
- Índice único parcial no banco: `supabase/migrations/12_concurrent_ticket_reservations.sql:17` a `:19`.
- Lock transacional: `supabase/migrations/12_concurrent_ticket_reservations.sql:101`.

### Modalidades e Fazendinha

O risco lógico é baixo dentro de um único processo porque ambos checam disponibilidade antes de reservar. Em produção horizontal, sem constraint transacional equivalente sendo usada no fluxo runtime, o risco sobe.

## Idempotência para confirmação PIX

Existe.

O webhook cria jobs por chave idempotente. A chave usa evento explícito quando disponível ou fallback por `tenant_id`, gateway, `purchaseId` e status. Duplicatas retornam o job existente. Se a compra já está `paid`, o webhook é tratado como duplicado e não reaplica bônus/comissão/cotas.

Evidências:

- Geração de chave idempotente: `server.ts:9759` a `server.ts:9767`.
- Dedupe na fila: `server.ts:9769` a `server.ts:9777`.
- Compra já paga retorna duplicado: `server.ts:9902` a `server.ts:9914`.
- Confirmação efetiva chama `confirmPurchase`: `server.ts:9917` a `server.ts:9920`.

## Processo automático de release

Parcial.

Há release automático implementado em função (`expirePendingReservations`), mas não há processo autônomo recorrente dedicado. O release roda quando acionado por fluxo de compra/confirmacao.

## Riscos encontrados

### ALTO

- Fazendinha não possui TTL/release automático para `reserved`.
- Modalidades não possuem TTL/release automático para `reserved`.
- Não há worker dedicado para expirar reservas de rifa tradicional sem depender de tráfego.

### MÉDIO

- O runtime principal usa reserva in-memory (`raffle.soldNumbers`) em vez de usar a função/tabela transacional `raffle_ticket_reservations` já prevista em migration.
- O campo público de expiração não está padronizado como `pix_expires_at`; o backend usa `reservedUntil` e o frontend usa fallback.

### BAIXO

- Há agendamento duplicado de automação `abandoned_pix_recovery` no fluxo de rifa tradicional; a idempotência da automação tende a segurar duplicatas, mas é ruído operacional.

## Recomendações para produção

1. Criar worker dedicado de expiração de reservas:
   - rodar a cada 30s ou 60s;
   - chamar `expirePendingReservations` para runtime atual;
   - em Supabase/Postgres, chamar `public.expire_raffle_ticket_reservations()`.

2. Padronizar campos:
   - manter `reservedUntil` internamente se desejado;
   - expor também `pixExpiresAt`/`pix_expires_at` no payload público;
   - usar o mesmo campo em checkout, PIX e recibo.

3. Levar a reserva de rifa tradicional para camada transacional:
   - usar `raffle_ticket_reservations`;
   - usar `reserve_raffle_tickets`;
   - confirmar status `paid` no webhook;
   - expirar via função SQL/job.

4. Aplicar TTL em Fazendinha e modalidades:
   - adicionar `reservedUntil`/`expiresAt`;
   - liberar grupos/números quando expirar;
   - alinhar endpoint de status para retornar `expired`.

5. Garantir que confirmação PIX após expiração seja tratada:
   - hoje `confirmPurchase` expira antes de confirmar e pode falhar com `Purchase reservation expired`;
   - em produção, definir regra clara: reembolsar, reatribuir cotas disponíveis ou criar ordem de suporte.

6. Monitorar reservas vencidas:
   - métrica de `pending` com `reservedUntil < now`;
   - alerta se houver reservas vencidas acima de alguns minutos.

## Respostas diretas ao checklist

1. Quando uma compra gera PIX, as cotas são reservadas?
   - Sim, em rifa tradicional. Os números entram em `purchase.numeros` e `raffle.soldNumbers`.

2. Qual status recebem?
   - A compra fica `pending`; os números ficam implicitamente reservados por estarem em `soldNumbers`.

3. Existe `reserved_until`, `expires_at`, `pix_expires_at`?
   - Runtime: `reservedUntil`.
   - Banco/migration: `reserved_until`.
   - Não encontrei `pix_expires_at` no pedido.

4. Quanto tempo o PIX fica válido?
   - 15 minutos por padrão, configurável por `PURCHASE_RESERVATION_TTL_MS`.

5. O que acontece quando expira?
   - Ao rodar `expirePendingReservations`, a compra vira `cancelled`, recebe motivo de expiração e as cotas são removidas de `soldNumbers`.

6. As cotas voltam automaticamente?
   - Sim, quando a função de expiração roda. Não é um worker dedicado.

7. Existe worker/job de limpeza?
   - Existe worker de pagamento. Não encontrei worker dedicado de limpeza de reservas.

8. Existe risco de cotas presas indefinidamente?
   - Sim, principalmente Fazendinha/modalidades; em rifa tradicional o risco é médio por expiração oportunista.

9. Existe risco de duas pessoas comprarem a mesma cota?
   - Baixo em processo único; maior em produção horizontal se não usar reserva transacional no banco.

10. Existe idempotência para confirmação PIX?
   - Sim, via `paymentQueue` e `idempotencyKey`.

11. Existe processo automático de release?
   - Parcial: função automática por gatilho de fluxo, mas não job periódico dedicado.

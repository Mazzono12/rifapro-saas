# Auditoria de Producao PagBank Pix

Data: 2026-05-31

## Escopo

Auditoria final da integracao PagBank Pix antes de producao, cobrindo valores, URLs de ambiente, headers, chave Pix, `notification_urls`, isolamento multitenant, webhook, idempotencia e reconciliacao.

## Fontes PagBank Conferidas

- Documentacao oficial "Criar pedido com QR Code (PIX)": https://developer.pagbank.com.br/reference/criar-pedido-pedido-com-qr-code. Confirma que pedido com QR Code suporta PIX, usa `POST /orders`, nao precisa enviar `charges`, usa `qr_codes.amount.value` e `qr_codes.expiration_date`, aceita URL em `notification_urls` e retorna `qr_codes[].text` e links de imagem/base64.
- Objeto Order oficial: https://developer.pagbank.com.br/reference/objeto-order. Confirma que `items.unit_amount`, `qr_codes.amount.value` e `charges.amount.value` sao inteiros em centavos; confirma que `notification_urls` deve usar ambiente seguro com SSL/HTTPS; confirma status como `PAID`, `AUTHORIZED`, `CANCELED`, `DECLINED`, `WAITING`.
- Documentacao oficial tambem alerta que a conta PagBank precisa ter pelo menos uma chave Pix ativa para o QR Code aceitar pagamento Pix.

## 1. Valores

Status: OK

Achados:

- PagBank usa valores inteiros em centavos em `items.unit_amount` e `qr_codes.amount.value`.
- A integracao recebe `input.amount` em reais, como os demais gateways internos.
- A conversao acontece uma unica vez em `toCents(input.amount)`.
- O provider recebe `amountInCents` e apenas arredonda/garante inteiro positivo; nao multiplica por 100 novamente.
- Todos os checkouts usam `attachActiveGatewayPixToOrder`, portanto rifa tradicional, NumberMode e Fazendinha passam pelo mesmo caminho de conversao.

Evidencias:

- `server.ts`: `amountInCents: toCents(input.amount)`.
- `PagbankProvider.ts`: `unit_amount: amountInCents` e `amount: { value: amountInCents }`.

Risco residual:

- Se algum fluxo futuro passar valor ja em centavos para `attachActiveGatewayPixToOrder`, ocorrera cobranca 100x maior. Recomendacao: manter contrato interno de checkout sempre em reais e cobrir novos fluxos com teste.

## 2. Producao

Status: OK com requisito operacional

Achados:

- Sandbox configurado como `https://sandbox.api.pagseguro.com`.
- Producao configurada como `https://api.pagseguro.com`.
- Ambos ambientes usam os mesmos headers:
  - `Authorization: Bearer {token}`
  - `Content-Type: application/json`
  - `Accept: application/json`
- `notification_urls` agora e gerada com HTTPS forçado para PagBank.
- `PUBLIC_BASE_URL`/`APP_URL`, se configurados com `http://`, sao convertidos para `https://` no webhook PagBank.
- Sem env explicita, o dominio verificado/custom do tenant e usado com protocolo HTTPS.
- Conta PagBank precisa ter chave Pix ativa. Sem chave Pix ativa, o pedido pode falhar ou nao aceitar pagamento Pix.

Evidencias:

- `PagbankProvider.ts`: base URLs por ambiente e headers Bearer iguais.
- `server.ts`: `buildTenantPublicUrl(input.tenantId, "/api/webhooks/pagbank", true)`.

Recomendacao de producao:

- Configurar `PUBLIC_BASE_URL=https://SEU_DOMINIO.com` no Railway/producao.
- Validar no painel PagBank que a conta do tenant tem chave Pix ativa.
- Validar token de producao antes de ativar `environment=production`.

## 3. Seguranca Multitenant

Status: OK apos hardening

Achados:

- Configuracao PagBank e obtida por `getDefaultPaymentGatewayConfig(tenantId)`.
- Criacao de `payments` salva `tenant_id: input.tenantId`.
- Webhook resolve tenant pela requisicao/domino e usa `tenantId` em todas as buscas.
- Busca de `payments` no webhook exige `tenant_id`, `provider='pagbank'` e `provider_payment_id` ou referencia do payment interno.
- Baixa paga foi endurecida: webhook `paid` sem `payment` interno tenant-scoped nao libera pedido.
- A fila de pagamento recebe `purchaseId` a partir de `payment.order_id`, nao mais diretamente de `reference_id`.
- Reconciliacao admin exige `payment` PagBank existente no tenant antes de consultar/baixar.
- Liberacao de cotas/numeros passa por `processPaymentJob`, que busca `purchases`, `numberModePurchases` e `fazendinhaCompras` usando `job.tenant_id`.

Evidencias:

- `server.ts`: log "PagBank pago sem payment interno tenant-scoped; baixa bloqueada".
- `server.ts`: `enqueuePaymentJob({ tenant_id: tenantId, gateway, purchaseId: payment?.order_id ... })`.
- `server.ts`: reconciliacao retorna 404 quando o pagamento PagBank nao pertence ao tenant.

## 4. Idempotencia

Status: OK apos hardening

Achados:

- Idempotencia inclui `tenant_id`, `gateway`, `provider_payment_id/order.id`, `reference_id`, status e `end_to_end` quando existir.
- Migration cria indice unico em `webhook_events` com:
  `tenant_id, provider, provider_payment_id, reference_id, status, coalesce(end_to_end, 'no-e2e')`.
- Duplicatas processadas retornam 200 sem liberar cotas novamente.

## Ajustes Aplicados Nesta Auditoria

- `notification_urls` do PagBank passou a forcar HTTPS.
- Idempotencia PagBank passou a incluir `end_to_end`/referencia equivalente quando presente.
- Webhook pago sem `payment` interno do tenant agora e bloqueado.
- Webhook nao enfileira baixa usando apenas `reference_id`.
- Reconciliacao admin exige pagamento PagBank tenant-scoped antes de consultar/baixar.
- Testes PagBank foram atualizados para cobrir os hardenings.

## Conclusao

A integracao PagBank esta pronta para producao do ponto de vista de valores, ambientes, headers, webhook HTTPS, isolamento multitenant e idempotencia. A ativacao em producao depende de token valido e chave Pix ativa na conta PagBank do tenant.

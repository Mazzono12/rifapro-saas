# Auditoria de Producao Asaas Pix

Data: 2026-05-31

## Escopo

Auditoria completa da integracao Asaas Pix antes de producao, com foco em multitenant, webhook, idempotencia, URLs oficiais, autenticacao, timeout, retry controlado, Pix, reconciliacao e logs sem credenciais.

## Fontes Asaas Conferidas

- Autenticacao oficial: https://docs.asaas.com/docs/authentication-2. Confirma Sandbox em `https://api-sandbox.asaas.com/v3`, uso da API Key como `access_token` e recomendacao de validar em sandbox antes de producao.
- QR Code Pix oficial: https://docs.asaas.com/reference/get-qr-code-for-pix-payments. Confirma `GET /payments/{id}/pixQrCode`, retorno de `encodedImage`, `payload` e `expirationDate`, e que chamadas GET devem ir sem body.
- Guia Pix/dynamic QR Code: https://docs.asaas.com/docs/payments-via-pix-or-dynamic-qr-code. Confirma criacao de cobranca Pix via `POST /v3/payments` com `billingType: PIX`, consulta posterior do QR Code e recomendacao de chave Pix cadastrada para fluxo estavel.

## 1. Multitenant

Status: OK apos hardening

Achados:

- `payment_gateways` e lido via `getDefaultPaymentGatewayConfig(tenantId)`.
- Criacao de cliente Asaas usa chave local `tenantId:asaas:environment`, evitando reaproveitamento entre tenants.
- Criacao de pagamento grava `tenant_id`, `provider='asaas'`, `provider_payment_id` e `asaas_payment_id`.
- Webhook resolve tenant pela requisicao e usa `tenantId` em logs, eventos, payment lookup e fila.
- Liberacao de cotas passa por `processPaymentJob`, que busca compras, NumberMode e Fazendinha por `job.tenant_id`.
- Reconciliacao admin exige `payment` Asaas existente no tenant antes de consultar e reconciliar.

## 2. Webhook

Status: OK apos hardening

Achados:

- Webhook dedicado: `POST /api/webhooks/asaas`.
- Token do webhook e validado por `asaas-access-token` com `timingSafeEqual`.
- Em producao, webhook token e obrigatorio.
- Webhook pago sem `payment` interno tenant-scoped agora e bloqueado.
- O fluxo nao baixa pedido usando apenas `externalReference`; a baixa usa `payment.order_id` apos encontrar `provider_payment_id`/`asaas_payment_id` do tenant.
- Eventos terminais (`PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED`) atualizam o pagamento somente quando ele nao esta pago.

## 3. Idempotencia

Status: OK apos hardening

Achados:

- Chave de idempotencia Asaas inclui `tenant_id`, `provider`, `provider_payment_id` e status/evento.
- Duplicatas ja processadas retornam sucesso sem dupla baixa.
- Migration adiciona indice unico por `tenant_id, provider, provider_payment_id, status`.
- Fila de pagamento tambem deduplica por `tenant_id + idempotencyKey`.

## 4. Producao

Status: OK com requisitos operacionais

Achados:

- Sandbox: `https://api-sandbox.asaas.com/v3`.
- Producao: `https://api.asaas.com/v3`.
- Headers usados:
  - `access_token: {API_KEY}`
  - `user-agent: {Nome da aplicacao}`
  - `accept: application/json`
  - `content-type: application/json`
- Provider tem timeout configurado e retry controlado de uma tentativa para falhas 5xx/rede.
- Erros nao registram API Key.
- QR Code Pix deve ser recuperado sem body no GET, conforme documentacao.
- Para estabilidade de producao, a conta Asaas deve manter chave Pix cadastrada.

Recomendacoes operacionais:

- Configurar API Key real apenas no painel admin do tenant.
- Usar `environment=production` apenas apos teste de conexao.
- Configurar token forte no webhook Asaas.
- Conferir se o dominio publico do tenant aponta corretamente para `/api/webhooks/asaas`.

## 5. PIX

Status: OK

Achados:

- Criacao de cobranca usa `billingType: PIX`.
- Valor e enviado em reais decimal, como esperado pela API Asaas.
- `externalReference` recebe o id interno do pedido.
- QR Code e consultado via `/payments/{id}/pixQrCode`.
- Sao armazenados:
  - `qr_code_base64`
  - `pix_payload`
  - `pix_copy_paste`
  - `expiration_date`
  - `raw_response` sem imagem base64 completa nos logs internos.

## 6. Reconciliação

Status: OK apos hardening

Achados:

- Novo endpoint admin: `POST /api/admin/payments/asaas/reconcile`.
- Aceita `paymentId`, `payment_id`, `orderId` ou `order_id`.
- Primeiro localiza `payments` com `tenant_id + provider='asaas'`.
- Consulta Asaas por `provider_payment_id`/`asaas_payment_id`.
- Se pago, enfileira baixa com `tenant_id` e `payment.order_id`.
- Se terminal e nao pago, atualiza status sem liberar cotas.

## Ajustes Aplicados

- Webhook Asaas passou a validar `provider_payment_id` tenant-scoped antes de liberar.
- Baixa Asaas deixou de usar `externalReference` diretamente.
- Idempotencia Asaas passou a usar payment id + status.
- Evento webhook Asaas agora salva `provider_payment_id`, `status` e `external_reference`.
- Reconciliacao admin Asaas foi adicionada.
- Provider Asaas recebeu timeout e retry controlado.
- Migration adicionada para indices tenant-scoped de pagamentos/eventos Asaas.
- Testes especificos de isolamento e readiness foram adicionados.

## Conclusao

A integracao Asaas agora esta alinhada ao padrao de Pay2M e PagBank em seguranca, multitenancy, idempotencia e operacao em producao. A ativacao em producao depende de API Key valida, webhook token forte, dominio publico acessivel e chave Pix ativa na conta Asaas.

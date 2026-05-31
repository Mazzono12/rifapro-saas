# PagBank Pix

## Configuracao

Acesse `Admin > Configuracoes > Gateways de Pagamento` e selecione `PagBank Pix real`.

Campos:

- Ativar PagBank Pix.
- Ambiente: sandbox ou producao.
- Bearer token/API token.
- Webhook token opcional.
- Tempo de expiracao padrao em minutos.
- Liberar pedido quando o status indicar pagamento.

Credenciais sensiveis seguem a camada segura de gateways da plataforma e sao cifradas no backend com `GATEWAY_CREDENTIALS_ENCRYPTION_KEY`.

## URLs

- Sandbox: `https://sandbox.api.pagseguro.com/orders`.
- Producao: `https://api.pagseguro.com/orders`.

URL publica do webhook:

```text
https://SEU_DOMINIO.com/api/webhooks/pagbank
```

## Fluxo de checkout

1. O checkout cria pedido interno pendente/reservado.
2. O backend cria um pedido PagBank via `POST /orders`.
3. O payload usa `reference_id` com o ID interno do pedido.
4. O valor e convertido de reais para centavos em `items.unit_amount` e `qr_codes.amount.value`.
5. O vencimento e enviado em `qr_codes.expiration_date`.
6. A resposta salva `order.id` em `payments.provider_payment_id`.
7. O Pix copia e cola de `qr_codes[0].text` e salvo em `payments.pix_copy_paste`.
8. Cotas, numeros ou grupos so sao liberados por webhook/reconciliacao confirmada.

Observacao: a conta PagBank precisa ter pelo menos uma chave Pix ativa para gerar QR Code.

## Webhook

A rota `POST /api/webhooks/pagbank`:

- valida token opcional do tenant;
- registra payload bruto em `webhook_events`;
- usa idempotencia por `tenant_id + provider + order_id + reference_id + status + end_to_end`;
- localiza pagamentos por `tenant_id + provider='pagbank' + provider_payment_id` ou `provider_reference`;
- confirma pedido somente quando o status indicar pago;
- ignora duplicatas sem liberar cotas novamente;
- marca expirado/cancelado apenas se o pedido ainda nao estiver pago;
- responde HTTP 200 rapidamente.

## Reconciliacao manual

Endpoint admin:

```text
POST /api/admin/payments/pagbank/reconcile
{ "orderId": "ORDE_..." }
```

Tambem aceita `referenceId` quando houver payment interno correspondente.

## Troubleshooting

- `Token PagBank nao configurado`: configure o Bearer token no admin.
- HTTP 401: token invalido ou ambiente incorreto.
- QR Code sem `text`: confira chave Pix ativa na conta PagBank e permissao da API Orders.
- Webhook nao baixa pedido: valide dominio/tenant, token secreto e `reference_id`.
- Valor divergente: a integracao envia valores em centavos, conforme `qr_codes.amount.value` e `items.unit_amount`.

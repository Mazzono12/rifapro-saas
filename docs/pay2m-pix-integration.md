# Pay2M Pix

## Configuracao

Acesse `Admin > Configuracoes > Gateways de Pagamento` e selecione `Pay2M Pix real`.

Campos:

- Ativar Pay2M Pix.
- Ambiente: sandbox ou producao. A Pay2M usa a base oficial `https://portal.pay2m.com.br`; o campo fica disponivel para troca operacional sem deploy.
- `CLIENT_ID`.
- `CLIENT_SECRET`.
- Webhook token opcional.
- Expiration time em segundos, limitado a 3600.
- Split link opcional.
- Liberar pedido quando `status = paid`.

Credenciais sensiveis sao cifradas no backend pela camada de gateways existente (`GATEWAY_CREDENTIALS_ENCRYPTION_KEY`) e voltam mascaradas para o frontend.

## Webhook

URL publica:

```text
https://SEU_DOMINIO.com/api/webhooks/pay2m
```

Se configurar token secreto, envie o mesmo valor em um destes canais:

- Header `x-webhook-secret`.
- Header `pay2m-access-token`.
- Header `Authorization: Bearer <token>`.
- Query string `?secret=<token>`.

O payload aceito deve ter `notification_type = PIX:QRCODE`.

## Fluxo de pagamento

1. O checkout cria pedido interno pendente/reservado.
2. O backend gera token via `POST /api/auth/generate_token` com `Authorization: Basic base64(CLIENT_ID:CLIENT_SECRET)`.
3. O backend cria cobrança em `POST /api/v1/pix/qrcode`.
4. O `reference_code` volta em `payments.provider_payment_id` e `payments.provider_reference`.
5. O `content` volta em `payments.pix_payload` e `payments.pix_copy_paste`.
6. A tela exibe PIX copia e cola, valor, vencimento e status aguardando pagamento.
7. Cotas, numeros ou grupos so sao liberados quando webhook/reconciliacao confirmar `status = paid`.

## Webhook e idempotencia

A rota `POST /api/webhooks/pay2m`:

- valida o token opcional do tenant;
- registra o payload bruto em `webhook_events`;
- usa idempotencia por `tenant_id + reference_code + status + end_to_end`;
- localiza pagamento por `provider_payment_id`, `provider_reference` ou `external_reference`;
- confirma pedido apenas uma vez em `status = paid`;
- marca pagamento como `expired` ou `canceled` sem cancelar pedido ja pago;
- responde HTTP 200 rapidamente para evitar reenvios desnecessarios.

## Reconciliacao manual

Endpoint admin:

```text
POST /api/admin/payments/pay2m/reconcile
{ "referenceCode": "REFERENCE_CODE_PAY2M" }
```

Ele consulta `GET /api/v1/pix/qrcode/{reference_code}` e aplica a mesma regra de baixa idempotente.

## Troubleshooting

- `CLIENT_ID/CLIENT_SECRET Pay2M nao configurados`: confira os campos do gateway no admin.
- `Pay2M respondeu HTTP 401`: credenciais ou ambiente incorretos.
- Webhook recebido e pedido nao baixou: confirme `external_reference`, `reference_code`, tenant/domino usado na chamada e token secreto.
- Pedido pago duplicado: o sistema ignora duplicatas pela chave de idempotencia do webhook e pelo estado do pedido.
- PIX expira acima do permitido: o backend limita `expiration_time` a 3600 segundos antes de chamar a Pay2M.

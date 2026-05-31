# Integracao Mercado Pago Pix

## Visao Geral

A integracao Mercado Pago Pix e plug-and-play por tenant. Cada tenant configura suas proprias credenciais em **Admin > Gateways de Pagamento > Mercado Pago Pix real**.

## Ambiente

O Mercado Pago usa a API:

- `https://api.mercadopago.com/v1/payments`
- `https://api.mercadopago.com/v1/payments/{payment_id}`

Sandbox e producao dependem do `access_token` usado:

- token de teste para sandbox;
- token real para producao.

## Configuracao

Campos no admin:

- ativar/desativar Mercado Pago Pix;
- ambiente sandbox/producao;
- Access Token;
- Public Key, se usado por outros fluxos;
- webhook token opcional;
- expiracao Pix em minutos;
- liberar pedido quando status `approved`.

O Access Token e salvo pela camada segura de credenciais do gateway e nunca deve ir para o frontend.

## Criacao Pix

O checkout chama `POST /v1/payments` com:

- `transaction_amount` em reais decimal;
- `payment_method_id: pix`;
- `external_reference` com o ID interno do pedido;
- `notification_url` HTTPS por tenant;
- `payer.email`, `payer.first_name`, `payer.last_name`;
- CPF/CNPJ apenas com numeros;
- header obrigatorio `X-Idempotency-Key`.

Os dados Pix sao lidos de:

`point_of_interaction.transaction_data`

Campos usados:

- `qr_code`;
- `qr_code_base64`;
- `ticket_url`.

## Webhook

URL publica:

`https://SEU_DOMINIO.com/api/webhooks/mercadopago`

O webhook do Mercado Pago serve apenas como notificacao. A plataforma sempre consulta a API oficial por `payment_id` antes de alterar qualquer pedido.

Fluxo:

1. Recebe webhook.
2. Extrai `data.id` ou `id`.
3. Consulta `GET /v1/payments/{payment_id}`.
4. Localiza `payments` por `tenant_id + provider='mercadopago' + provider_payment_id`.
5. Se status for `approved`, enfileira baixa usando `payment.order_id`.
6. Se status for `rejected`, `cancelled`, `refunded` ou `charged_back`, atualiza somente se ainda nao estiver pago.
7. Eventos duplicados sao ignorados por idempotencia.

## Status

Mapeamento:

- `approved`: pagamento confirmado, libera cotas/numeros.
- `pending`, `authorized`, `in_process`: aguardando.
- `rejected`, `cancelled`, `refunded`, `charged_back`: terminal negativo, sem liberar se nao estava pago.

## Multitenant

Todas as operacoes usam `tenant_id`:

- configuracao em `payment_gateways`;
- criacao de `payments`;
- webhook_events;
- reconciliacao admin;
- liberacao de cotas tradicionais;
- liberacao de NumberMode;
- liberacao da Fazendinha.

Nunca ha baixa apenas por `external_reference`.

## Reconciliacao Manual

Endpoint admin:

`POST /api/admin/payments/mercadopago/reconcile`

Body:

```json
{
  "provider_payment_id": "123456789"
}
```

A reconciliacao primeiro valida o pagamento local no tenant atual e depois consulta Mercado Pago.

## Troubleshooting

- `Access Token Mercado Pago nao configurado`: configure o token no admin.
- `Mercado Pago nao retornou id/qr_code PIX`: a API nao retornou dados Pix; confira token, pais/conta e permissao Pix.
- Webhook nao baixa pedido: confirme que o webhook chegou no dominio correto e que existe `payment` local com o mesmo `provider_payment_id`.
- Status continua pendente: use a reconciliacao manual para consultar o pagamento remoto.

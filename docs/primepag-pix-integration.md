# PrimePag Pix Integration

Integração real do gateway PrimePag Pix para checkout interno da plataforma. O cliente permanece no checkout do RifaPro; não há redirecionamento externo.

## Ambientes

- Staging/Sandbox API: `https://api-stg.primepag.com.br`
- Produção API: `https://api.primepag.com.br`
- Portal de documentação staging: `https://developers-stg.primepag.com.br`

O endpoint informado no portal de documentação é diferente do host de API real. O código usa os hosts `api-stg` e `api` para chamadas HTTP.

## Configuração no Admin

Em `Admin > Configurações > Gateways de Pagamento > PrimePag Pix real`:

- Ativar PrimePag Pix
- Ambiente: staging, sandbox ou produção
- `client_id`
- `client_secret`
- Access token/API token, se fornecido diretamente
- Webhook authorization token
- `expiration_time` padrão em segundos
- Botão `Testar`

O token/segredo não é exposto ao frontend e deve ser salvo cifrado pelo backend.

## Fluxo de checkout

1. O checkout cria/reserva pedido interno com `tenant_id`.
2. O backend busca `payment_gateways` do tenant com `provider = primepag`.
3. O valor em reais é convertido para centavos uma única vez.
4. O backend chama:

```http
POST /v1/pix/qrcodes
```

Payload:

```json
{
  "value_cents": 10001,
  "generator_name": "Nome do comprador",
  "generator_document": "12345678900",
  "expiration_time": "1800",
  "external_reference": "ORDER_INTERNO"
}
```

5. A resposta `qrcode.reference_code` é salva em `payments.provider_payment_id`.
6. A resposta `qrcode.content` é salva em `payments.pix_copy_paste`.
7. `qrcode.image_base64` é salvo se existir. Quando vier `null`, o frontend continua exibindo Pix a partir do copia e cola.

## Webhook

Configure no painel PrimePag:

```text
https://SEU_DOMINIO.com/api/webhooks/primepag
```

A PrimePag envia o header `Authorization` com o código configurado. O backend valida esse valor contra o token salvo no admin quando ele estiver configurado.

O webhook:

- responde HTTP 200 rapidamente;
- salva payload bruto em `webhook_events`;
- localiza pagamento por `tenant_id + provider='primepag' + provider_payment_id/reference_code`;
- nunca baixa pedido somente por `external_reference`;
- aplica idempotência por `tenant_id + provider + reference_code + status + end_to_end`;
- libera cotas/números apenas uma vez quando o status indicar pago.

## Reconciliação manual

Endpoint admin:

```http
POST /api/admin/payments/primepag/reconcile
Content-Type: application/json

{
  "reference_code": "PRIMEPAGTESTPIXQRCODE6"
}
```

O backend consulta a cobrança na PrimePag e, se estiver paga, baixa `payment/order` e libera cotas/números de forma idempotente.

## Troubleshooting

- `PrimePag nao retornou reference_code/content`: a resposta não trouxe `qrcode.reference_code` ou `qrcode.content`.
- `Webhook PrimePag authorization invalid`: o header `Authorization` não bate com o token salvo.
- `PrimePag pago sem payment interno tenant-scoped`: webhook pago não encontrou `payment` do mesmo tenant e foi bloqueado.
- `image_base64` nulo: esperado em alguns casos; renderize QR Code a partir do `content`.

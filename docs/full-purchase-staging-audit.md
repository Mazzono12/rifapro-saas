# Auditoria full purchase staging hard

Gerado em: 2026-05-29T18:19:50.416Z

## Escopo

- Ambiente: servidor local em modo production com gateway PIX mock/sandbox.
- Host tenant: cliente-a.meudominio.com
- Dinheiro real: nao utilizado.
- Clientes fake: 5
- Campanhas testadas: 1
- Compras executadas: 5

## Validacoes

- Texto vertical no checkout: corrigido por assercao estatica
- Midia no checkout/recibo: presente
- Floating buttons durante checkout: ocultos
- PIX mock/sandbox: sim
- WhatsApp mock enfileirado uma vez por pedido: sim
- Sem cotas duplicadas por campanha: sim

## Clientes

- Cliente Teste 01 (cliente01+staging@teste.local) - Sao Paulo/SP
- Cliente Teste 02 (cliente02+staging@teste.local) - Rio de Janeiro/RJ
- Cliente Teste 03 (cliente03+staging@teste.local) - Belo Horizonte/MG
- Cliente Teste 04 (cliente04+staging@teste.local) - Curitiba/PR
- Cliente Teste 05 (cliente05+staging@teste.local) - Florianopolis/SC

## Campanhas

- Campanha Full Purchase Mock 1780078788800 (R_992B409A)

## Compras

- Cliente Teste 01 em Campanha Full Purchase Mock 1780078788800: 1 cota(s), pedido 075C1E5F, status paid, bilhete com 1 numero(s), WhatsApp mock ok.
- Cliente Teste 02 em Campanha Full Purchase Mock 1780078788800: 5 cota(s), pedido 21FFC398, status paid, bilhete com 5 numero(s), WhatsApp mock ok.
- Cliente Teste 03 em Campanha Full Purchase Mock 1780078788800: 100 cota(s), pedido 43B6745B, status paid, bilhete com 100 numero(s), WhatsApp mock ok.
- Cliente Teste 04 em Campanha Full Purchase Mock 1780078788800: 700 cota(s), pedido CA8EECFD, status paid, bilhete com 700 numero(s), WhatsApp mock ok.
- Cliente Teste 05 em Campanha Full Purchase Mock 1780078788800: 37 cota(s), pedido DBE427A7, status paid, bilhete com 37 numero(s), WhatsApp mock ok.

## Observacoes

O teste valida fluxo completo em mock: preview, compra, PIX, webhook aprovado, status seguro, bilhete/cotas e idempotencia do WhatsApp. Nao chama gateway real e nao usa dados reais.

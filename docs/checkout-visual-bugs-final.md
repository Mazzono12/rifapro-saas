# Auditoria visual final dos checkouts

Executado em build de producao local: `https://rifapro-saas-production.up.railway.app`.
Screenshots: `reports/screenshots/checkout-final/`.

## Causa real encontrada

- O header de checkout herdava regras de largura/padding do header publico por usar a classe `premium-site-header`.
- No mobile, regras antigas faziam `.checkout-modal-close` ocupar uma linha inteira, aumentando demais o topo do checkout.
- Havia mais de um shell real: recibo, rifa e Fazendinha Home montavam estruturas próprias em vez de um contrato unico.

## Resultado visual

### Rifa tradicional checkout - 360x640
- URL/rota: `/raffle/1`
- Screenshot: `raffle-360x640-checkout.png`
- Header: 87px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Rifa tradicional preenchido - 360x640
- URL/rota: `/raffle/1`
- Screenshot: `raffle-360x640-checkout.png`
- Header: 87px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Rifa tradicional recibo pre-PIX - 360x640
- URL/rota: `/raffle/1`
- Screenshot: `raffle-360x640-receipt.png`
- Header: 87px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### NumberMode Dezena checkout - 360x640
- URL/rota: `/dezena`
- Screenshot: `numbermode-360x640-checkout.png`
- Header: 86px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### NumberMode Dezena preenchido - 360x640
- URL/rota: `/dezena`
- Screenshot: `numbermode-360x640-checkout.png`
- Header: 86px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### NumberMode Dezena recibo pre-PIX - 360x640
- URL/rota: `/dezena`
- Screenshot: `numbermode-360x640-receipt.png`
- Header: 86px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Fazendinha checkout - 360x640
- URL/rota: `/fazendinha`
- Screenshot: `fazendinha-360x640-checkout.png`
- Header: 86px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Fazendinha preenchido - 360x640
- URL/rota: `/fazendinha`
- Screenshot: `fazendinha-360x640-checkout.png`
- Header: 86px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Fazendinha recibo pre-PIX - 360x640
- URL/rota: `/fazendinha`
- Screenshot: `fazendinha-360x640-receipt.png`
- Header: 86px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Rifa tradicional checkout - 390x844
- URL/rota: `/raffle/1`
- Screenshot: `raffle-390x844-checkout.png`
- Header: 88px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Rifa tradicional preenchido - 390x844
- URL/rota: `/raffle/1`
- Screenshot: `raffle-390x844-checkout.png`
- Header: 88px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Rifa tradicional recibo pre-PIX - 390x844
- URL/rota: `/raffle/1`
- Screenshot: `raffle-390x844-receipt.png`
- Header: 88px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### NumberMode Dezena checkout - 390x844
- URL/rota: `/dezena`
- Screenshot: `numbermode-390x844-checkout.png`
- Header: 87px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### NumberMode Dezena preenchido - 390x844
- URL/rota: `/dezena`
- Screenshot: `numbermode-390x844-checkout.png`
- Header: 87px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### NumberMode Dezena recibo pre-PIX - 390x844
- URL/rota: `/dezena`
- Screenshot: `numbermode-390x844-receipt.png`
- Header: 87px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Fazendinha checkout - 390x844
- URL/rota: `/fazendinha`
- Screenshot: `fazendinha-390x844-checkout.png`
- Header: 87px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Fazendinha preenchido - 390x844
- URL/rota: `/fazendinha`
- Screenshot: `fazendinha-390x844-checkout.png`
- Header: 87px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Fazendinha recibo pre-PIX - 390x844
- URL/rota: `/fazendinha`
- Screenshot: `fazendinha-390x844-receipt.png`
- Header: 87px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Rifa tradicional checkout - 414x896
- URL/rota: `/raffle/1`
- Screenshot: `raffle-414x896-checkout.png`
- Header: 89px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Rifa tradicional preenchido - 414x896
- URL/rota: `/raffle/1`
- Screenshot: `raffle-414x896-checkout.png`
- Header: 89px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Rifa tradicional recibo pre-PIX - 414x896
- URL/rota: `/raffle/1`
- Screenshot: `raffle-414x896-receipt.png`
- Header: 89px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### NumberMode Dezena checkout - 414x896
- URL/rota: `/dezena`
- Screenshot: `numbermode-414x896-checkout.png`
- Header: 88px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### NumberMode Dezena preenchido - 414x896
- URL/rota: `/dezena`
- Screenshot: `numbermode-414x896-checkout.png`
- Header: 88px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### NumberMode Dezena recibo pre-PIX - 414x896
- URL/rota: `/dezena`
- Screenshot: `numbermode-414x896-receipt.png`
- Header: 88px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Fazendinha checkout - 414x896
- URL/rota: `/fazendinha`
- Screenshot: `fazendinha-414x896-checkout.png`
- Header: 88px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Fazendinha preenchido - 414x896
- URL/rota: `/fazendinha`
- Screenshot: `fazendinha-414x896-checkout.png`
- Header: 88px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Fazendinha recibo pre-PIX - 414x896
- URL/rota: `/fazendinha`
- Screenshot: `fazendinha-414x896-receipt.png`
- Header: 88px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Rifa tradicional checkout - 1366x900
- URL/rota: `/raffle/1`
- Screenshot: `raffle-desktop-checkout.png`
- Header: 88px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Rifa tradicional preenchido - 1366x900
- URL/rota: `/raffle/1`
- Screenshot: `raffle-desktop-checkout.png`
- Header: 88px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Rifa tradicional recibo pre-PIX - 1366x900
- URL/rota: `/raffle/1`
- Screenshot: `raffle-desktop-receipt.png`
- Header: 88px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### NumberMode Dezena checkout - 1366x900
- URL/rota: `/dezena`
- Screenshot: `numbermode-desktop-checkout.png`
- Header: 75px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### NumberMode Dezena preenchido - 1366x900
- URL/rota: `/dezena`
- Screenshot: `numbermode-desktop-checkout.png`
- Header: 75px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### NumberMode Dezena recibo pre-PIX - 1366x900
- URL/rota: `/dezena`
- Screenshot: `numbermode-desktop-receipt.png`
- Header: 75px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Fazendinha checkout - 1366x900
- URL/rota: `/fazendinha`
- Screenshot: `fazendinha-desktop-checkout.png`
- Header: 75px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Fazendinha preenchido - 1366x900
- URL/rota: `/fazendinha`
- Screenshot: `fazendinha-desktop-checkout.png`
- Header: 75px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

### Fazendinha recibo pre-PIX - 1366x900
- URL/rota: `/fazendinha`
- Screenshot: `fazendinha-desktop-receipt.png`
- Header: 75px de altura
- Problema encontrado: nenhum problema visual residual detectado
- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell
- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.

## Status

PASSOU: todos os checkouts auditados ficaram dentro do padrao visual.

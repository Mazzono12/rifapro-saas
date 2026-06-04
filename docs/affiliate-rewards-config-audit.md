# Auditoria - Modulo de Afiliados e Configuracoes de Premiacao

Data: 2026-06-04

## Escopo auditado

- `src/pages/Affiliates.tsx`: painel do afiliado final, link de indicacao, QR Code, saldos, saque, ranking e materiais de marketing.
- `src/pages/admin/AdminConfig.tsx`: configuracao global do programa de afiliados, comissao, entrada, meta mensal, saque minimo, carteira e video de instrucao.
- `src/pages/admin/AdminSales.tsx`: operacao administrativa de afiliados, cadastro manual, busca, ajuste de carteira, premios, comissoes e saques.
- `server.ts`: APIs de afiliados, configuracoes, dashboard privado, busca administrativa, saque e ajuste de carteira.
- `src/types.ts`: estruturas `AffiliateStats` e `AffiliateWithdrawal`.
- `scripts/test-affiliate-access-control-hard.mjs`: validacao estatica de controle de acesso e privacidade do painel.

## APIs e estruturas retornadas

- `GET /api/settings`: retorna configuracoes publicas do tenant. O painel usa `affiliateProgram` e `affiliateInstructionVideo`.
- `PUT /api/admin/settings`: salva configuracoes administrativas, incluindo `affiliateProgram`.
- `GET /api/affiliates/:refCode`: retorna dados publicos quando nao e o dono; retorna dados completos somente para o afiliado dono.
- `GET /api/affiliates/:refCode/dashboard`: dashboard privado do afiliado, protegido por dono do afiliado e tenant.
- `PUT /api/affiliates/:refCode`: salva PIX e uso de saldo pelo afiliado dono.
- `POST /api/affiliates/:refCode/withdrawals`: cria solicitacao de saque.
- `GET /api/admin/affiliates/search`: busca administrativa por afiliado.
- `GET /api/admin/affiliates/withdrawals`: lista saques para administracao.
- `POST /api/admin/affiliates/withdrawals/:id/status`: aprova ou recusa saque.
- `POST /api/admin/affiliates/manual`: cadastra afiliado manualmente.
- `POST /api/admin/affiliates/:refCode/wallet`: ajusta comissoes e premios.
- `PUT /api/admin/affiliates/:refCode/full`: salva ficha administrativa do afiliado.

## Campos exibidos ao usuario

### Afiliado final

- Link principal, link curto, cupom personalizado e QR Code.
- Comissoes totais, pendentes, liberadas e pagas.
- Clientes indicados, conversao, receita por indicacao e ranking.
- Chave PIX, valor sacavel, uso de saldo para comprar cotas e solicitacao de saque.
- Materiais de marketing e video de treinamento.

### Administrador

- Comissao padrao, comissao vitalicia, comissao recorrente.
- Bonus por cadastro, bonus por venda, meta mensal e meta anual.
- Valor minimo de saque, aprovacao de saque e prazo para pagamento.
- Niveis Bronze, Prata, Ouro e Diamante.
- Codigo de indicacao, link de indicacao, cotas para entrar e validade da indicacao.
- Cadastro manual, busca de afiliados, saldos, premios, comissoes e saques.

## Problemas encontrados

1. Campos tecnicos vazando para a interface:
   - `field` era exibido diretamente na edicao administrativa de afiliado.
   - Status crus como `pending`, `paid`, `rejected`, `active` e `eligibilityStatus` apareciam na operacao.
   - `refCode` era tratado visualmente como codigo interno, sem linguagem comercial.

2. Configuracoes confusas:
   - `Afiliados & Social` misturava canais sociais com regras financeiras.
   - `Compra minima mensal para ativacao do afiliado` nao deixava claro o impacto em comissoes pendentes.
   - `Permitir usar saldo de afiliado para comprar cotas` parecia uma flag tecnica.

3. Campos sem explicacao:
   - Comissao, saque minimo, entrada no programa e meta mensal tinham pouco contexto.
   - Cadastro manual nao tinha placeholders que orientassem o preenchimento.

4. Campos sem ajuda visual:
   - Nao havia tooltip/ajuda contextual na area de configuracao comercial.
   - O resumo era operacional, mas nao explicava o resultado comercial para o administrador.

5. Campos que exigiam conhecimento tecnico:
   - Roteiros de carteira tinham botoes curtos como `+ comissao`, `pagar premio` e `zerar tudo`.
   - A interface exigia entender estados internos para interpretar saque e elegibilidade.

## Melhorias implementadas

- A configuracao global virou uma experiencia plug-and-play com secoes comerciais:
  - Comissao
  - Premiacao
  - Saques
  - Niveis
  - Programa de Indicacao
- Campos tecnicos continuam existindo apenas no estado/API, mas a UI mostra rotulos comerciais.
- Adicionados textos explicativos e tooltips em campos de configuracao.
- Adicionados placeholders amigaveis no cadastro manual de afiliados.
- Status administrativos foram traduzidos para linguagem final:
  - `pending` -> `Aguardando aprovacao`
  - `paid` -> `Pago`
  - `rejected` -> `Recusado`
  - `active` -> `Liberado neste mes`
- Botoes de carteira foram renomeados para acoes claras:
  - `Adicionar comissao`
  - `Adicionar premio`
  - `Registrar comissao paga`
  - `Registrar premio pago`
  - `Zerar saldo total`
- Incluido aviso visual de seguranca informando que somente Admin/Superadmin acessam configuracoes.
- Correcao P2 aplicada em `AdminSales.tsx`: o editor "Editar ficha do cliente" deixou de exibir labels crus como `name`, `phone`, `photoUrl`, `purchaseId`, `status` e a expressao "IDs dos grupos". A interface passou a mostrar "Nome do cliente", "WhatsApp / Telefone", "Foto do cliente", "Pedido / Compra", "Situacao" e "Grupos da compra", mantendo os mesmos payloads e endpoints.

## Seguranca

- Configuracoes permanecem dentro da rota `/admin`, protegida por `ProtectedRoute roles={["superadmin", "admin"]}`.
- O painel `/afiliados` continua sem acesso administrativo e sem configuracoes internas.
- O dashboard privado do afiliado segue protegido por `isAffiliateOwnerRequest`.
- Nenhuma alteracao foi feita no calculo de billing, compras, gateway, pagamentos ou conciliacao.
- Nenhuma alteracao de schema, tenant ou migracao foi realizada.
- Contratos de API foram preservados; as mudancas sao de apresentacao e experiencia.

## Arquivos alterados

- `src/pages/admin/AdminConfig.tsx`
- `src/pages/admin/AdminSales.tsx`
- `docs/affiliate-rewards-config-audit.md`

## Validacao recomendada

- `npm run lint`
- `npm run build`
- `npm run test:affiliate-access-control`

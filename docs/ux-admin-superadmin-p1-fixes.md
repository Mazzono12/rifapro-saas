# Correcoes P1 UX Admin/Superadmin

Data: 2026-06-05

Escopo executado:

- `src/pages/admin/AdminPaymentGateways.tsx`
- `src/pages/admin/AdminIntegrations.tsx`
- `src/pages/admin/AdminPromotions.tsx`
- `src/pages/admin/AdminGamification.tsx`
- `src/pages/admin/AdminLiveDraw.tsx`

## Resumo

As correcoes P1 foram concentradas na camada de apresentacao dos modulos administrativos, sem alterar banco, APIs, billing, tenants, permissoes, webhooks, integracoes ou regras financeiras.

A experiencia foi reescrita para linguagem comercial e plug-and-play:

- IDs internos, slugs, enums, provider codes, payloads tecnicos, JSON bruto, hashes, `order_id`, `purchaseId` e `raffleId` nao aparecem como conteudo principal da experiencia.
- Campos tecnicos necessarios ao contrato com backend permanecem apenas como estado interno ou payload de API.
- Labels, descricoes, mensagens de logs e status visiveis foram traduzidos para nomes amigaveis.
- Mensagens dinamicas vindas de logs/testes sao sanitizadas para evitar exibicao de JSON, hashes, nomes de campos internos ou detalhes de payload.

## Alteracoes por tela

### AdminPaymentGateways

- Labels tecnicos como token, bearer/API token, identificador tecnico, canal seguro e webhook foram substituidos por "Chave privada", "Conta do gateway", "Senha do gateway", "Chave de seguranca" e "Canal de notificacao".
- O teste "Teste do caminho PIX" passou para "Teste de pagamento PIX".
- Resultado de teste nao mostra URL tecnica; exibe apenas validacao operacional do canal.
- Monitoramento de filas mostra "Gateway" e "Situacao" com nomes legiveis, sem provider/status cru.
- Mensagens de saude do gateway passam por sanitizacao antes de renderizar.

### AdminIntegrations

- Removida edicao visual por "Credenciais JSON" e "Configuracoes JSON".
- Criados campos guiados por credencial exigida/opcional do provedor, com labels comerciais e ajuda contextual.
- Listagens usam nome amigavel, tipo comercial e situacao legivel.
- WhatsApp automatico trocou termos de API por "Numero conectado", "Conta comercial", "Chave privada", "Codigo de confirmacao" e "Modelo de mensagem".
- `order_id` nao e mostrado; a UI exibe apenas "Compra vinculada".
- Logs, erros e observacoes passam por sanitizacao para esconder payload tecnico, hashes e campos internos.

### AdminPromotions

- Condicoes, recompensas e limites deixam de aparecer como JSON bruto.
- Editor foi organizado em blocos comerciais: "Quando a promocao vale", "Beneficio entregue" e "Limites de uso".
- Tipos internos de promocao sao exibidos por nomes amigaveis, com fallback "Promocao comercial".
- "Prioridade" virou "Ordem de exibicao" com explicacao operacional.

### AdminGamification

- Secao "JSON avancado" foi substituida por planejadores visuais de premios, janelas e beneficios.
- Modulos, eventos e ganhadores exibem campanha/acao comercial, situacao legivel e vinculo comercial com compra, sem expor `purchaseId`.
- "Status" visivel foi padronizado como "Situacao".

### AdminLiveDraw

- Sorteio ao vivo permanece auditavel, mas a UI fala em participantes protegidos, comprovante liberado/protegido, resultado certificado e certificado publico.
- Mensagens cruas do resultado foram substituidas por mensagens comerciais controladas.
- Hashes, seeds e IDs continuam apenas no fluxo interno de auditoria/API, nao como texto principal para o operador.

## Evidencias de validacao

- `npm run lint`: aprovado (`tsc --noEmit` sem erros).
- `npm run build`: aprovado (`vite build` e bundle de `server.ts` concluidos).
- Busca estatica no escopo por termos P1 visiveis removidos:
  - `Credenciais JSON`
  - `Configuracoes JSON`
  - `JSON avancado`
  - `Token de acesso`
  - `Public Key`
  - `Bearer token`
  - `Identificador tecnico`
  - `Phone number ID`
  - `Business account ID`
  - `Token de verificacao`
  - `Teste do caminho PIX`
  - `Canal seguro`
  - `seed secreta`
  - `hash publico`
  - `provably fair`
- A busca ainda encontra `purchaseId`, `raffleId` e `order_id` como nomes de propriedades internas usadas para estado/payload. Nos pontos renderizados, esses valores foram substituidos por "Compra vinculada", "Compra nao vinculada", nomes de campanhas ou textos comerciais.

## Riscos residuais

- Alguns nomes tecnicos continuam existindo no codigo porque sao contratos internos de API, banco e integracoes.
- Mensagens retornadas pelo backend podem variar; as telas do escopo agora sanitizam os principais padroes de JSON, payload, hash e campos internos antes de exibir.
- O escopo nao incluiu validacao visual em navegador autenticado com perfis Admin/Superadmin reais.
- Existem alteracoes pre-existentes no worktree fora deste escopo; elas nao foram revertidas.

## Confirmacoes

- Nao foi realizado commit.
- Nao foram alterados banco, APIs, billing, tenants, regras financeiras, permissoes, webhooks ou integracoes.

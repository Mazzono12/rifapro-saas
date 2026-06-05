# Auditoria UX/Admin/Superadmin - Vazamento de termos tecnicos

Data da auditoria: 2026-06-04

Escopo auditado: Admin, Superadmin, Afiliados, Rifas, Fazendinha, Checkout, CRM, Integracoes, Gateway de pagamento, Configuracoes, Usuarios, Clientes, Financeiro e Dashboard.

Metodo: auditoria estatica de telas, componentes e textos renderizados no frontend. Nao foram alterados componentes, payloads, endpoints, banco, billing, tenants ou regras financeiras.

## Resumo executivo

Nao foi identificado P0 funcional durante a auditoria estatica.

Os maiores riscos de UX estao concentrados em:

- Integracoes e Gateway de pagamento, que ainda exibem JSON, provider, type, tokens, webhook, IDs de contas e nomenclaturas de API.
- Gamificacao, Promocoes e Compliance, que ainda usam estruturas tecnicas como JSON avancado, hash, resource_type, action, module e status bruto.
- Fluxos publicos de compra, dashboard do cliente e comprovantes, que ainda mostram purchaseId/pedido interno, status bruto e fallback para raffleId.
- Superadmin, que ainda exibe slugs, providers, status_code, event_type, order_id e logs em formato operacional tecnico.

## Legenda

| Severidade | Definicao |
| --- | --- |
| P0 | Quebra funcional ou exposicao critica que impede uso seguro |
| P1 | Confuso para operacao ou alto risco de erro administrativo |
| P2 | Termo tecnico, ID, enum, slug, propriedade ou JSON exposto |
| P3 | Melhoria visual, clareza ou acabamento |

## Achados

| Tela | Local | Severidade | Impacto | Correcao sugerida |
| --- | --- | --- | --- | --- |
| Admin - Integracoes | `src/pages/admin/AdminIntegrations.tsx` - campos "Credenciais JSON" e "Configuracoes JSON" | P1 | Obriga o administrador a conhecer JSON, chaves internas e formato esperado pela API. Alto risco de erro de configuracao. | Substituir por formularios guiados por provedor, com labels comerciais, validacao por campo e resumo visual. Manter JSON apenas em area tecnica colapsada para superadmin. |
| Admin - Integracoes | `src/pages/admin/AdminIntegrations.tsx` - listagens com `provider`, `type`, credenciais obrigatorias e ambiente tecnico | P2 | Exibe nomenclatura interna de integradores, tipos e propriedades de backend. | Mapear `provider` e `type` para nomes comerciais como "WhatsApp", "E-mail", "Pagamento" e "Ambiente de validacao/producao". |
| Admin - Integracoes | `src/pages/admin/AdminIntegrations.tsx` - campos "Phone number ID", "Business account ID" e "Token de verificacao" | P2 | Mostra nomes tecnicos de API diretamente para administrador nao tecnico. | Usar labels orientados ao negocio, como "Numero conectado", "Conta comercial" e "Codigo de confirmacao", com tooltip explicando onde encontrar cada dado. |
| Superadmin - Integracoes | `src/pages/superadmin/SuperAdminIntegrations.tsx` - logs com `provider`, `action`, `status_code`, `error_message`, `event_type`, `order_id` | P2 | Superadmin visualiza eventos em formato tecnico, dificultando diagnostico operacional. | Converter logs para frases operacionais, por exemplo "Mensagem enviada pelo WhatsApp", "Falha na entrega" e "Pedido associado". Manter detalhes tecnicos em painel colapsado. |
| Admin - Gateway de pagamento | `src/pages/admin/AdminPaymentGateways.tsx` - "Token de acesso", "Public Key", "Bearer token/API token", "Identificador tecnico" | P1 | Configuracao financeira parece painel de desenvolvedor e aumenta risco de preencher chave errada. | Reorganizar por provedor com assistente passo a passo, mascaramento de credenciais, textos de ajuda e labels comerciais. |
| Admin - Gateway de pagamento | `src/pages/admin/AdminPaymentGateways.tsx` - "Teste do caminho PIX", `provider` e "Canal seguro" com URL | P2 | Vazamento de termos de integracao e endpoints para usuario administrativo. | Trocar por "Teste de pagamento PIX", "Provedor" com nome amigavel e "Enderecos de notificacao" apenas em detalhes tecnicos para superadmin. |
| Admin - Gamificacao | `src/pages/admin/AdminGamification.tsx` - secao "JSON avancado" com textarea raw | P1 | Exige conhecimento tecnico para configurar regras promocionais/gamificacao. | Substituir por controles de regras, metas, multiplicadores e periodos. JSON bruto deve ficar oculto ou restrito a superadmin. |
| Admin - Gamificacao | `src/pages/admin/AdminGamification.tsx` - tabelas com `module`, `purchaseId` e `status` bruto | P2 | Exibe propriedades internas e IDs de compra. | Usar "Campanha", "Pedido/Compra" com codigo amigavel e "Situacao" mapeada para textos comerciais. |
| Admin - Promocoes | `src/pages/admin/AdminPromotions.tsx` - condicoes, recompensas e limites em JSON | P1 | Administrador precisa editar estrutura tecnica para criar promocao. | Criar construtor visual de promocoes com regras de elegibilidade, beneficios e limites. |
| Admin - Compliance | `src/pages/admin/AdminComplianceCenter.tsx` - auditoria com `action`, `resource_type`, `hash` e antifraude com `status` bruto | P2 | Logs tecnicos aparecem como conteudo principal, sem traducao operacional. | Exibir "Acao realizada", "Area afetada", "Comprovante de integridade" e status traduzido. Hash completo apenas em "Informacoes tecnicas". |
| Superadmin - Antifraude | `src/pages/superadmin/SuperAdminAntifraud.tsx` - `signal_type`, `severity`, `action`, `status` | P2 | Linguagem de motor antifraude vaza para painel executivo. | Traduzir para "Sinal detectado", "Gravidade", "Medida tomada" e "Situacao". |
| Admin - Sorteio ao vivo | `src/pages/admin/AdminLiveDraw.tsx` - "provably fair", "seed secreta", "hash publico", "Hash cotas elegiveis", "Seed revelada" | P1 | Recurso de sorteio fica tecnicamente correto, mas dificil para operador comum. | Apresentar como "Sorteio auditavel", "Codigo de seguranca", "Comprovante publico" e explicar em texto curto. Detalhes criptograficos em painel tecnico. |
| Auditoria publica do sorteio | `src/pages/DrawAudit.tsx` - `draw_method`, `status`, `hash`, `seed`, `created_at` | P2 | Pagina publica de transparencia ainda expõe campos tecnicos e enums. | Traduzir metodo, status e datas; mostrar hashes como "Comprovantes de integridade" com ajuda visual. |
| Transparencia publica | `src/pages/Transparency.tsx` - `raffle.status` e `prize.status` crus | P2 | Participante pode ver enums ou status internos sem contexto. | Mapear para "Ativa", "Encerrada", "Premio disponivel", "Premio entregue" etc. |
| Dashboard do cliente | `src/pages/Dashboard.tsx` - "Pedido #{purchaseId}", fallback `raffleId` e `status` em maiusculas | P2 | Cliente final visualiza ID interno e status tecnico. | Usar "Compra" com codigo amigavel, nunca fallback para ID interno, e status traduzido como "Aguardando pagamento", "Confirmado", "Cancelado". |
| Checkout / Detalhes da rifa | `src/pages/RaffleDetails.tsx` - "Pedido #{purchaseId}", QR/validacao com `purchaseId` | P2 | Recibo e validacao expõem identificador interno de compra. | Usar "Comprovante" ou "Codigo da compra" com codigo publico seguro. Evitar purchaseId direto no texto visivel. |
| Recibo premium | `src/components/premium/PremiumUI.tsx` - "Pedido #{purchaseId}" | P2 | Mesmo identificador interno aparece em componentes reutilizaveis de recibo. | Trocar label para "Compra" e consumir identificador publico quando disponivel. |
| Fazendinha | `src/pages/Fazendinha.tsx` - compartilhamento/recibo com `purchase.id` e `statusPagamento` | P2 | Fluxo ludico expõe ID de compra e status tecnico de pagamento. | Usar codigo amigavel de comprovante e status de pagamento traduzido. |
| Modo numeros | `src/pages/NumberModePage.tsx` - compartilhamento/recibo com `purchase.id` | P2 | Participante compartilha identificador interno em texto externo. | Substituir por codigo publico de compra ou remover ID da mensagem compartilhada. |
| Admin - Rifas | `src/pages/admin/AdminRaffles.tsx` - tabela de compras com `purchaseId` e `status` bruto | P2 | Operador ve ID tecnico e status cru na gestao de rifas. | Exibir "Compra" e "Situacao" com labels normalizados. Deixar ID tecnico apenas em detalhes colapsados para superadmin. |
| Admin - Rifas | `src/pages/admin/AdminRaffles.tsx` - campo "Data Sorteio (YYYY-MM-DD)" | P3 | Formato tecnico aparece no label e reduz polimento visual. | Usar placeholder "Ex.: 31/12/2026" ou seletor de data com ajuda discreta. |
| Admin - Premios instantaneos | `src/pages/admin/AdminInstantPrizes.tsx` - coluna "RIFA ID" e fallback `raffleId` | P2 | ID interno de campanha aparece no painel. | Mostrar nome da rifa/campanha; se indisponivel, exibir "Campanha nao encontrada" sem ID. |
| Admin - Dashboard | `src/pages/admin/AdminDashboard.tsx` - fallback para `raffleId` em ranking/listas | P2 | Quando nome nao existe, o painel mostra ID interno. | Criar fallback comercial como "Campanha sem nome" e registrar ID somente em detalhes tecnicos. |
| Admin - Exportacoes | `src/components/admin/AdminPremium.tsx`, `src/pages/admin/AdminModalidades.tsx`, `src/pages/admin/AdminReports.tsx` - botoes/arquivos JSON | P2 | "JSON" aparece como acao para administrador, reforcando formato tecnico. | Renomear para "Exportar dados" ou "Baixar relatorio"; escolher formato sem expor implementacao. |
| Admin - Automacoes | `src/pages/admin/AdminAutomations.tsx` - execucoes com `run.status` cru | P2 | Status tecnico de automacao aparece sem traducao. | Mapear para "Concluida", "Com falha", "Em andamento" e incluir mensagem humana de erro. |
| Admin - CRM | `src/pages/admin/AdminCRM.tsx` - historico WhatsApp com `status`, `template` e `order_id` | P2 | Atendimento visualiza nomes internos de modelo e pedido tecnico. | Mostrar "Mensagem entregue/falhou", "Modelo de mensagem" com nome amigavel e "Compra relacionada". |
| Admin - Configuracoes | `src/pages/admin/AdminConfig.tsx` - tokens CSS como `--theme-primary` | P2 | Painel de marca exibe variaveis de implementacao visual. | Trocar por nomes como "Cor principal", "Cor de destaque", "Fundo" e "Texto". |
| Editor de marca | `src/components/branding/ThemeBuilder.tsx` - fallback para `block.id` e placeholders `imageUrl`/`videoUrl` | P2 | Blocos sem label podem vazar IDs internos; placeholders usam propriedade tecnica. | Garantir label comercial para todos os blocos e placeholders "URL da imagem" / "URL do video". |
| Superadmin - Clientes/Tenants | `src/pages/superadmin/SuperAdminClients.tsx` - campo `slug` e status bruto | P2 | Superadmin precisa lidar com identificador tecnico do tenant. | Renomear para "Endereco publico" ou "Identificador da loja", com validacao e ajuda. Status sempre traduzido. |
| Superadmin - Dashboard | `src/pages/superadmin/SuperAdminDashboard.tsx` - status bruto de campanhas/rifas | P2 | Visao executiva pode mostrar enums de campanha. | Traduzir estados para linguagem operacional e padronizar cores/legendas. |
| Admin legado | `src/pages/Admin.tsx` - "Acesso de Nivel 5", "NODE", "MEMPOOL", "FALHA PROTOCOLO" e `row.id` | P2 | Tela parece painel tecnico/placeholder e foge do padrao SaaS comercial. | Remover ou reescrever como dashboard administrativo real, com indicadores de negocio. |
| Financeiro / relatorios | Relatorios administrativos com status generico e exportacao tecnica | P3 | Experiencia fica menos clara, especialmente em filtros e acoes de exportacao. | Padronizar "Situacao", "Periodo", "Baixar relatorio" e descricoes curtas de cada filtro. |
| Usuarios e clientes | Tabelas administrativas com coluna generica "Status" em varios modulos | P3 | "Status" sem contexto exige interpretacao do operador. | Usar "Situacao" e legendas por dominio: conta, pagamento, compra, campanha ou integracao. |

## Confirmacoes de nao impacto

- Nao foram encontrados indícios, nesta auditoria estatica, de alteracao em billing, tenants ou regras financeiras.
- Nao foram alterados endpoints, payloads, banco de dados ou permissoes.
- Nao foi realizado commit.
- Este relatorio nao substitui uma verificacao visual em navegador com perfis Admin, Superadmin e usuario comum; recomenda-se validar os principais fluxos apos as correcoes.

## Priorizacao recomendada

1. Corrigir P1 de Integracoes, Gateway de pagamento, Gamificacao, Promocoes e Sorteio ao vivo.
2. Remover purchaseId, raffleId, order_id e status cru dos fluxos publicos e do dashboard do cliente.
3. Padronizar labels "Situacao", "Compra", "Campanha", "Comprovante" e "Informacoes tecnicas".
4. Criar area colapsada "Informacoes tecnicas" visivel apenas para superadmin quando IDs, hashes ou detalhes de API forem realmente necessarios.

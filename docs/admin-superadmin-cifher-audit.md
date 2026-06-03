# Auditoria CIFHER Admin e Superadmin

Data: 2026-06-03

## Checklist aplicado

- [x] Estrutura operacional preservada, sem landing page nas áreas `/admin` e `/superadmin`.
- [x] Sidebar compartilhada com largura premium: aberta em 292px e recolhida em 88px.
- [x] Controle da sidebar mantido como chevron discreto, com `aria-label` e tooltip nos itens recolhidos.
- [x] Topbar sticky com busca, ações rápidas, seletor de tema e status operacional.
- [x] Tokens de tema alinhados ao padrão CIFHER: Escuro, Claro e Sistema.
- [x] Tema escuro com fundos `#06020d`, `#090514`, `#10091f`, sidebar `#07030f` e cards `#120a22`/`#170d2b`.
- [x] Tema claro com fundos `#f8f6ff`, `#ffffff`, `#f1edff` e textos `#211432`, `#625178`, `#8a7a9f`.
- [x] Botão primário em gradiente roxo-magenta `#8b2cff -> #d946ef`.
- [x] Botão secundário com superfície de card e borda roxa translúcida.
- [x] Botão de perigo com tratamento semântico vermelho suave.
- [x] Botões de ícone em 34px.
- [x] Cards e painéis com raio efetivo de 8px.
- [x] Botões, chips e campos com raio entre 10px e 14px.
- [x] Inputs/selects/textareas com altura mínima de 40px, foco roxo e placeholder discreto.
- [x] File inputs com borda dashed e botão interno customizado.
- [x] Tabelas compactas com cabeçalho sticky, padding de 8px a 10px e hover roxo suave.
- [x] Scrollbars invisíveis mantendo rolagem.
- [x] Tipografia Inter/system-ui nas áreas administrativas.
- [x] H1/H2/H3 operacionais com tamanhos fixos, sem escala por viewport.
- [x] Textos longos protegidos por truncamento ou quebra segura onde o layout exige.
- [x] Responsividade preservada: desktop denso e mobile com drawer lateral.

## Correções realizadas

- Centralização do seletor de tema em `src/context/admin/AdminThemeContext.tsx`, renomeando os modos para Escuro, Claro e Sistema e preservando compatibilidade com valores antigos.
- Ajuste do modo Sistema para acompanhar `prefers-color-scheme`.
- Ajuste das larguras reais da sidebar em `src/components/admin/CollapsibleSidebar.tsx`.
- Sincronia do padding lateral dos layouts admin/superadmin com a largura da sidebar.
- Inclusão de status operacional compacto nas topbars de admin e superadmin.
- Reforço final dos estilos CIFHER em `src/index.css`, garantindo que passagens antigas de estilo global não sobrescrevam a identidade roxo/magenta.

# Mapas mentais no Master

Área administrativa nativa em JavaScript, seguindo o frontend Vite existente. Menu: Mapas mentais.

Inclui tópicos e subtópicos, cores e notas, mover ramo pelo seletor de pai, recolher/expandir, zoom/enquadrar, desfazer/refazer, importar/exportar JSON e biblioteca com salvamento manual. Tab cria filho, Enter cria irmão e F2 edita quando o foco está no canvas. Limite de 300 tópicos por documento. O layout é automático, da esquerda para a direita.

Persistência: `mapas_mentais`, com documento JSONB e revisão para impedir sobrescrita de outra aba. Acesso restrito por `is_main_admin()`; sem acesso anônimo ou exclusão direta. Não há colaboração simultânea, anexos, IA ou exportação PDF nesta versão.

## Ativação

Aplicar `supabase/migrations/20261101170000_mapas_mentais.sql` no projeto correto do Master (`wkjnxohfggqwhemalelf`) após verificar as funções existentes `is_main_admin` e `set_updated_at`. Depois publicar o frontend no projeto Vercel `themidiamaster`, preservando o domínio oficial. Não foi aplicado remotamente: esse projeto não aparece na conexão Supabase atual. Nenhum deploy foi realizado.

Sem a tabela, o editor permite trabalhar e exportar JSON, mas informa que a persistência ainda precisa ser ativada.

## Validação

Build Vite e suíte Node. Testes específicos cobrem ciclos, mudança de pai preservando descendentes, recolhimento, RLS para administrador/equipe/anônimo e revisão obsoleta em Postgres isolado (PGlite). Navegador validou título, edição e criação de filho/irmão e enquadramento em uma página temporária usando o módulo real. Essa página foi removida após a verificação. Persistência real no Master e navegação autenticada do módulo ainda dependem da ativação do banco e homologação.

## Modelos, cards livres e conexões — 02/11/2026

Galeria com quatro modelos: planejamento estratégico, campanha de marketing, plano de conteúdo e organização de projeto. Cada uso cria um novo documento com identificadores próprios. Substituir um rascunho alterado pede confirmação.

Arraste um card com mouse ou toque para posicioná-lo. O zoom é considerado no deslocamento; as linhas acompanham o movimento. A posição é persistida em `document.nodes[].position`; Organizar automaticamente remove as posições manuais. Desfazer/refazer inclui a movimentação.

Interligar cards: selecione origem, ative o botão e clique no destino. As conexões extras são direcionadas, tracejadas e possuem seta. Podem ser removidas no painel do tópico, não modificam a hierarquia e são persistidas em `document.connections`. Não é necessária outra migration: o documento já é JSONB. Mapas antigos sem posições/conexões continuam válidos.

Validação adicional: modelos com IDs independentes, conexões inválidas e repetidas, posições inválidas e ida/volta JSON. Navegador validou usar modelo, interligar, arrastar com zoom 65% e desfazer restaurando a posição anterior.

### Navegação do canvas
Arrastar o fundo vazio move a área visível, sem alterar posições dos cards. Roda do mouse dá zoom (20% a 200%) ancorado no ponto sob o cursor, sem rolar a página externa. A área contém margem para navegar nos dois sentidos. Verificado no navegador: arraste alterou scroll de (600,600) para (400,500), sem marcar documento como alterado; roda mudou o zoom de 100% para 200%.

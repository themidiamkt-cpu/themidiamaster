# Mapas mentais no Master

Área administrativa nativa em JavaScript, seguindo o frontend Vite existente. Menu: Mapas mentais.

Inclui tópicos e subtópicos, cores e notas, mover ramo pelo seletor de pai, recolher/expandir, zoom/enquadrar, desfazer/refazer, importar/exportar JSON e biblioteca com salvamento manual. Tab cria filho, Enter cria irmão e F2 edita quando o foco está no canvas. Limite de 300 tópicos por documento. O layout é automático, da esquerda para a direita.

Persistência: `mapas_mentais`, com documento JSONB e revisão para impedir sobrescrita de outra aba. Acesso restrito por `is_main_admin()`; sem acesso anônimo ou exclusão direta. Não há colaboração simultânea, anexos, IA, drag-and-drop ou exportação PDF nesta versão.

## Ativação

Aplicar `supabase/migrations/20261101170000_mapas_mentais.sql` no projeto correto do Master (`wkjnxohfggqwhemalelf`) após verificar as funções existentes `is_main_admin` e `set_updated_at`. Depois publicar o frontend no projeto Vercel `themidiamaster`, preservando o domínio oficial. Não foi aplicado remotamente: esse projeto não aparece na conexão Supabase atual. Nenhum deploy foi realizado.

Sem a tabela, o editor permite trabalhar e exportar JSON, mas informa que a persistência ainda precisa ser ativada.

## Validação

Build Vite e suíte Node. Testes específicos cobrem ciclos, mudança de pai preservando descendentes, recolhimento, RLS para administrador/equipe/anônimo e revisão obsoleta em Postgres isolado (PGlite). Navegador validou título, edição e criação de filho/irmão e enquadramento em uma página temporária usando o módulo real. Essa página foi removida após a verificação. Persistência real no Master e navegação autenticada do módulo ainda dependem da ativação do banco e homologação.

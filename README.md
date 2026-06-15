# The Midia Master

Sistema interno para gerenciar clientes, campanhas, CRM comercial, relatorios, tarefas, onboarding, ativos e operacao da agencia The Midia Marketing.

## Supabase

Projeto configurado no frontend:

- URL: `https://wkjnxohfggqwhemalelf.supabase.co`
- Chave usada no frontend: `anon`

1. Execute o SQL em `supabase/migrations/20260605_the_midia_master.sql` no SQL Editor do Supabase.
2. Crie ao menos um usuario em Authentication para acessar o painel.
3. Rode localmente com `npm install` e `npm run dev`.

O MCP do Supabase nao estava disponivel nesta sessao, e a CLI local nao estava instalada. A migration ficou pronta para execucao no SQL Editor ou via MCP assim que o conector aparecer.

Nao coloque a `service_role` no frontend. Ela deve ficar apenas em ambiente seguro de backend/Edge Functions.

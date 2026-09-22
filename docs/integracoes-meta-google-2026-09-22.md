# Integrações de mídia: implantação e validação

## Meta Ads: fatos e execução

A migration `20260922012312_meta_ads_sync_observability.sql` cria fatos canônicos por cliente, conta, nível (conta, campanha ou anúncio), entidade, dia, moeda e atribuição. Objetivo do cliente é apenas um retrato informativo. O histórico legado permanece intacto; duplicatas legadas de objetivo são reduzidas a uma única linha canônica inicial, com moeda e atribuição desconhecidas.

Cada execução registra status completo, parcial ou falha, contagens e cursor. Cada cliente/conta registra dias esperados, consultados, sem veiculação e ausentes. Consulta bem-sucedida sem linha da API cria fato de zero confirmado; falha não cria zero. A carga faz upsert por grão e conserva a última carga válida quando falha. A janela móvel padrão é sete dias, configurável até 30 dias. Backfill pagina até 14 dias por chamada e retorna `next_cursor`. Fatos de campanha e anúncio da Graph API têm retenção de 180 dias; o nível da conta permanece.

Configurar `CRON_SECRET`, `META_ACCESS_TOKEN`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` somente no ambiente das Edge Functions. Aplicar a migration apenas após comparar o histórico remoto com o local em um projeto vinculado. Implantar `sync-meta-ads-daily` com verificação JWT desativada e segredo obrigatório no header `x-cron-secret`; implantar `request-meta-ads-reprocess` com JWT ativo. O botão de reprocessamento exige usuário administrador e permite até sete dias por chamada dentro dos últimos 180 dias.

Para cron, criar no Supabase Vault os segredos `meta_sync_project_url` e `meta_sync_cron_secret` e executar `supabase/scheduler/install_meta_ads_rolling.sql` no projeto verificado. Nenhum segredo literal deve entrar no repositório. O agendamento antigo deve ser inspecionado e removido antes de ativar o novo. O script versionado lê o Vault no momento da execução.

## Google Ads

O proxy usa Google Ads API v24. A página Google Ads tem navegação e seleção de cliente próprias, inclusive para clientes sem Meta. O servidor resolve `google_ads_id` a partir de `clienteId` autorizado por sessão e RLS; o navegador não escolhe um customer ID. O período é limitado a 93 dias. Configurar no servidor `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN` e, quando necessário, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`. O access token OAuth é reutilizado em memória até perto do vencimento.

Referências oficiais consultadas: [calendário de versões](https://developers.google.com/google-ads/api/docs/sunset-dates), [estrutura GAQL](https://developers.google.com/google-ads/api/docs/query/structure) e [campos de relatório v24](https://developers.google.com/google-ads/api/fields/v24/overview).

Gasto, conversões e valor vêm da consulta não segmentada de customer, paginada pela API. Conversões fracionárias são mantidas. Ações de conversão são detalhamento separado e não são somadas novamente. A tela mostra as 50 campanhas de maior gasto, com contagem de todas as campanhas. Palavras-chave, termos, ações e histórico diário podem falhar parcialmente sem transformar a falha em zero. Termos são apresentados para análise manual. Indicador de atualização é a hora da consulta ao provedor. A migration `20260922020000_google_ads_daily_facts.sql` cria fatos diários com RLS; após aplicá-la, configurar `SUPABASE_SERVICE_ROLE_KEY` no servidor do proxy para persistir o histórico. O retorno explicita `persisted`, `write_failed`, `not_configured` ou `unavailable`. Dias sem linha numa consulta diária bem-sucedida são marcados como sem veiculação.

## Verificações e pendências

`npm test` cobre autorização do proxy, paginação de 61 campanhas, OAuth em cache, conversões fracionárias, falha parcial, sincronização Meta e migrations/RLS em PostgreSQL isolado via PGlite. `npm run build` valida o bundle. Ainda é necessário reconciliar gasto, conversões e valor com uma conta Google autorizada. O conector Supabase confirmou o projeto ativo `themidia` e mostrou que o histórico remoto termina em `20260701191930`; as migrations desta entrega não constam nele. A CLI local continua sem project ref vinculado. Nenhuma migration, função ou cron foi aplicada remotamente.

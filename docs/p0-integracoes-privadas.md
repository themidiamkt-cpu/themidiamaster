# P0 — Integrações privadas (ambiente de desenvolvimento)

## Inventário confirmado no código

| Local | Tipo |
|---|---|
| `frontend/js/app.js` | Token Meta literal e consultas Graph no navegador; removidos nesta entrega |
| `frontend/js/app.js`, `server/gbpAnalyze.js`, `supabase/functions/gbp-analyze/index.ts` | Chave Google Maps fixa e fallback no navegador; removidos |
| `server/googleAds.js`, `api/google-ads.js` | OAuth Google Ads no servidor; handler agora exige sessão e cliente autorizado |
| `api/gbp-analyze.js`, `supabase/functions/gbp-analyze/index.ts` | Places no servidor; handlers agora exigem sessão e cliente autorizado |
| `supabase/functions/receber-lead-crm/index.ts` | Segredo de webhook; agora obrigatório antes de encaminhar ou gravar |
| `supabase/functions/send-qualified-lead-event/index.ts` | Token Meta e service role; agora exige sessão de administrador principal antes de consultar lead |
| `supabase/functions/sync-meta-ads-daily/index.ts` | Token Meta e service role; agora exige `x-cron-secret` para toda chamada |
| `supabase/migrations/20260617215806_meta_ads_daily_cron.sql` | Chave anon embutida no cron legado; não é identidade de serviço |

Nenhum valor de credencial foi reproduzido aqui. A chave anon/publicável Supabase permanece pública, protegida por RLS.

## Configuração e rotação

1. Revogar o token Meta anteriormente presente no bundle e emitir outro com os acessos mínimos às contas cadastradas. Configurar `META_ACCESS_TOKEN` somente nos secrets das Edge Functions `meta-ads-read`, `sync-meta-ads-daily` e `send-qualified-lead-event`. Não reutilizar o valor exposto.
2. Configurar `SUPABASE_URL` e `SUPABASE_ANON_KEY` no servidor Node (ou `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` apenas se já usados no desenvolvimento). O backend consulta o usuário e as políticas RLS com o JWT da sessão. A service role permanece apenas nas Edge Functions que escrevem dados internos.
3. Criar `GOOGLE_MAPS_API_KEY` de servidor para Places, com restrição de API e, se houver IP fixo de saída, restrição por IP. Para ambiente sem IP fixo, manter a chave só no servidor e impor controles de acesso e cota no proxy. A implementação atual não carrega Maps JavaScript no navegador, portanto não requer chave de navegador. Rotacionar a chave fixa anteriormente publicada.
4. Manter `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN` e opcional `GOOGLE_ADS_LOGIN_CUSTOMER_ID` no servidor. A conta Google Ads é resolvida de `clientes.google_ads_id`, nunca do payload.
5. Para `receber-lead-crm` e `sync-meta-ads-daily`, configurar a invocação de webhook/cron sem verificação JWT do gateway (`verify_jwt = false` ou opção equivalente no deploy), pois a autenticação dessas funções é feita pelo segredo obrigatório no handler. Manter verificação JWT em `meta-ads-read`, `gbp-analyze` e `send-qualified-lead-event`. Configurar `LEAD_WEBHOOK_SECRET` na Edge Function e no emissor do webhook. Enviar somente em `x-webhook-secret`. Configurar `CRON_SECRET` para `sync-meta-ads-daily` e para a automação externa, também somente em `x-cron-secret`.
6. A migration incremental remove as quatro políticas anon legadas e desativa o cron antigo, que autenticava com a chave pública. Antes de aplicá-la remotamente, conferir projeto, schema, políticas, histórico real de migrations e o agendamento externo. Configurar o novo agendamento para POST no mesmo endpoint e corpo `{ "mode": "yesterday" }`, com `x-cron-secret`. Não aplicar a migration antes de a automação substituta estar pronta; sem isso a sincronização diária para.
7. Migrar o workflow de alertas externo para uma identidade de serviço privada e limitada a `clientes`/`metas_cliente` de leitura e `alertas_anomalia` de escrita. Preservar os campos e formato atuais. Validar o contrato com payload fictício antes da troca. Não usar a chave anon como identidade de serviço.

## Dados e validação

Meta retornado por `meta-ads-read` é medido pela Graph API, com cliente e período identificados; ausência de linhas representa ausência de dados, não zero confirmado. Erros de sessão, acesso, configuração e Meta aparecem ao usuário. O cache dura cinco minutos e é separado por usuário, cliente, período, objetivo e modo. GMN continua uma estimativa baseada em Places, não métricas do Business Profile. O build local não valida as contas reais, secrets remotos, webhook externo nem o cron em produção.

Referências oficiais: [autorização em Edge Functions](https://supabase.com/docs/guides/functions/auth), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [segurança de chaves Maps](https://developers.google.com/maps/api-security-best-practices).

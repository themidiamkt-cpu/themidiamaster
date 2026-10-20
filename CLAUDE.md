# CLAUDE.md

Este repositório é o **The Midia Master** e abriga duas coisas que não se misturam:

1. **O app web da agência** (`frontend/`, `api/`, `server/`, `supabase/`): JavaScript + Vite + Supabase, deploy na Vercel. Continua funcionando como sempre.
2. **A camada operacional do Creative Intelligence** (`.claude/skills/ci-*`, `.claude/agents/ci-coletor.md`, `ops/creative-intelligence/`): o **COMO FAZER** pesquisa de mercado, referências, inteligência de nicho, conceitos e roteiros. Operada só pelo Claude Code.

## App web

```bash
npm run dev    # vite --host 0.0.0.0 (root: frontend/)
npm run build  # saída em frontend/dist (Vercel)
npm test       # node --test tests/*.test.js
```

- Contexto técnico em `docs/` e na nota `04 Projetos/The Midia Master` do cofre.
- O usuário removeu CRM Comercial, follow-ups, GMN Análises, Diário de Bordo e Alertas da navegação e do carregamento do Master. O foco financeiro agora inclui Gastos e Assinaturas.
- Nunca versionar `.env`, chaves, tokens ou credenciais. O frontend nunca recebe `service_role`.
- Tarefa de código **não** carrega nada do Creative Intelligence.

## Creative Intelligence

Divisão oficial (aprovada em 05/10/2026):

| Papel | Quem | Faz |
|---|---|---|
| Lógica operacional, skills, instruções, resolução de intenção, workflows | **Master** (este repo) | o COMO FAZER |
| Pesquisa e navegação | **Jev** (via agente `ci-coletor`) | coleta o que é observável |
| Análise, inteligência, conceitos, roteiros, compliance | **Claude** | interpreta e cria |
| Memória: clientes, nichos, referências, conceitos, roteiros | **Obsidian** | o QUE SABEMOS |

Fluxo oficial: PESQUISA → REFERÊNCIAS → INTELIGÊNCIA DO NICHO → CONCEITOS → ROTEIROS.

### Roteamento por intenção (sem comando `/`)

| O usuário pede… | Skill |
|---|---|
| "Pesquise anúncios para o Zin", "Pesquise o mercado de restaurantes", "Busque referências para a NV Store", "o que os concorrentes estão anunciando" | `ci-pesquisar` (termina sempre com roteiros do cliente) |
| "Consolide / atualize a inteligência do nicho", "que padrões aparecem", "onde estão as lacunas" | `ci-inteligencia` |
| "Crie 10 conceitos para a The Midia", "ideias de anúncio para X" | `ci-conceitos` |
| "Crie roteiros para esses conceitos", "Crie 10 roteiros para a The Midia" | `ci-roteiros` |

Todas começam por `ops/creative-intelligence/resolver.md` (qual cliente, qual nicho, o que já existe). Visão geral e índice em `ops/creative-intelligence/README.md`.

### Regras que valem para todas

- **Obsidian é a memória e a identidade criativa do cliente** (`cliente`, `aliases`, `nicho`). Cofre: `~/Documents/Segundo Cerebro/Segundo Cerebro/`. **Supabase** guarda a vista estruturada para o Master online. Nada de referência, nicho, cliente, conceito ou roteiro é versionado neste repo.
- **Dois destinos, por contrato:** toda pesquisa, inteligência, conceito e roteiro é salvo no **Supabase** (tabelas `ci_*`, que o Master online lê) **e** no **Obsidian** (memória), sem o usuário pedir. Procedimento, esquema e idempotência em `ops/creative-intelligence/supabase-bridge.md`. O Master web só **lê**; quem escreve é o Claude.
- **Limite no banco:** só as tabelas `ci_*` e **leitura** de `clientes` (`id`, `nome_empresa`) para achar o `cliente_id`. Não alterar `clientes`, `segmento`, `meta_ads_act`, plano, mensalidade, verba, funções, políticas ou integrações do app. O nicho nunca é deduzido de `segmento`. Nunca `service_role` no frontend.
- **Sem performance**: sem Meta Ads API, CPA, ROAS, CTR, resultado de campanha, status de teste ou numeração de anúncios. Anúncio ativo não prova que funciona.
- **Nada sensível versionado**: chaves, tokens, credenciais, briefings completos, referências coletadas, dados de clientes. Esses dados ficam no cofre ou em `~/.config`.
- **Compliance e revisão** ficam com o Claude principal (`ops/creative-intelligence/compliance.md`). Não existe agente revisor nesta versão.
- **Dry-run:** quando o usuário pedir simulação (ou for a primeira rodada de um fluxo novo), mostrar a resolução e o plano e **não gravar nada**.
- Jev: configuração global e limites em `~/CLAUDE.md` (seção Jev). Pesquisa é só leitura; sem login, formulário ou CAPTCHA.
- O Codex não opera este fluxo.

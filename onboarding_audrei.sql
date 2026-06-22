-- Migration: adicionar campo categoria
-- Execute primeiro (apenas uma vez):
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'Geral';

-- Tarefas de onboarding para Audrei (com categoria)
WITH audrei AS (
  SELECT id FROM clientes WHERE nome_empresa ILIKE '%audrei%' LIMIT 1
)
INSERT INTO tarefas (titulo, cliente_id, categoria, prioridade, status, descricao, checklists, recorrencia, recorrencia_ativa, recorrencia_dia_semana)
VALUES
  (
    'Audrei - Etapa 1 - Oficializacao',
    (SELECT id FROM audrei),
    'Onboarding',
    'urgente',
    'pendente',
    'Link do formulario: https://forms.gle/tHBRT1j441LTsAVdA',
    '[{"title": "Onboarding", "items": [{"text": "Enviar formulario de coleta de dados para contrato", "done": false}, {"text": "Avisar o time Juridico sobre novo contrato", "done": false}, {"text": "Garantir assinatura e primeiro recebimento do cliente", "done": false}]}]'::jsonb,
    'nenhuma',
    false,
    NULL
  ),
  (
    'Audrei - Etapa 2 - Call Inicial e Acessos',
    (SELECT id FROM audrei),
    'Onboarding',
    'urgente',
    'pendente',
    'Objetivo: 1. Fazer a Call de Onboarding 2. Conseguir todos os acessos as contas.',
    '[{"title": "Onboarding", "items": [{"text": "Criar grupo no WhatsApp e Adicionar capa", "done": false}, {"text": "Adicionar colaboradores e cliente no grupo", "done": false}, {"text": "Enviar mensagem 2", "done": false}, {"text": "Agendar Call Inicial e Acessos", "done": false}, {"text": "Enviar form de Briefing OU Coletar na reuniao", "done": false}]}, {"title": "META ADS", "items": [{"text": "Business Manager", "done": false}, {"text": "Pagina do Facebook", "done": false}, {"text": "Perfil do Instagram", "done": false}, {"text": "Check se todos estao usuais.", "done": false}]}, {"title": "GOOGLE ADS", "items": [{"text": "Google Ads", "done": false}, {"text": "Perfil de Pagamentos do Google Ads", "done": false}, {"text": "Google Analytics", "done": false}, {"text": "Google Tag Manager", "done": false}, {"text": "Google Merchant Center", "done": false}, {"text": "Google Meu Negocio", "done": false}, {"text": "Check se todos estao usuais.", "done": false}]}, {"title": "PLATAFORMA DE ECOMMERCE OU SITE", "items": [{"text": "Acesso da Plataforma de E-commerce ou Site", "done": false}, {"text": "Hospedagem / Dns [Validacao do Dominio do Face]", "done": false}]}, {"title": "CONCLUSAO", "items": [{"text": "Enviar Mensagem 3", "done": false}, {"text": "Ajustar Prazo do Onboarding [7 dias a partir do envio dos acessos]", "done": false}, {"text": "Criar pasta do Drive do cliente com todas as Subpastas do modelo", "done": false}, {"text": "Anexar Briefing a Pasta do Cliente", "done": false}]}]'::jsonb,
    'nenhuma',
    false,
    NULL
  ),
  (
    'Audrei - Etapa 3 - Setup de Contas',
    (SELECT id FROM audrei),
    'Onboarding',
    'urgente',
    'pendente',
    'Objetivo: Configuracao completa do Google Ads, Meta Ads e Analytics. ID da BM - 129047579214857',
    '[{"title": "SETUP GOOGLE ADS", "items": [{"text": "Instalar Google Tag manager", "done": false}, {"text": "Tag de Remarketing", "done": false}, {"text": "Tag de Compra ou Eventos de Conversao (no caso de leads)", "done": false}, {"text": "Tag do Google Analytics", "done": false}, {"text": "Eventos de Transacao do Google Analytics", "done": false}, {"text": "Metas de Add to Cart, Checkout e Compra", "done": false}]}, {"title": "SETUP FACEBOOK", "items": [{"text": "Configurar Pagina e Instagram", "done": false}, {"text": "Configurar Contas de Anuncios", "done": false}, {"text": "Cadastrar Forma de Pagamento", "done": false}, {"text": "Cadastrar Dados de Faturamento", "done": false}, {"text": "Criar e Configurar Pixel", "done": false}, {"text": "Adicionar Eventos", "done": false}, {"text": "Validar dominio", "done": false}, {"text": "Configurar Mensuracao de Eventos Agregados", "done": false}, {"text": "Criar Catalogo", "done": false}, {"text": "Configurar numero do WhatsApp", "done": false}, {"text": "Enviar Parceria", "done": false}, {"text": "Configurar Permissoes", "done": false}, {"text": "Remover Acessos de todos os usuarios do BM do cliente", "done": false}, {"text": "Solicitar lista de leads e compradores", "done": false}]}, {"title": "METAS ANALYTICS", "items": [{"text": "Ativar Funcao de Ecommerce", "done": false}, {"text": "Criar funil de ecommerce", "done": false}, {"text": "Meta de Compra", "done": false}]}, {"title": "CONFIGURACAO DO XML DE PRODUTOS", "items": [{"text": "Configurar XML ou API no Merchants e acompanhar aprovacao dos produtos", "done": false}, {"text": "Configurar XML ou API no catalogo do Meta Ads e acompanhar aprovacao dos produtos", "done": false}]}, {"title": "Publicos Facebook", "items": [{"text": "Envolvimento Instagram: 3/7/15/30/60/180/365", "done": false}, {"text": "Envolvimento Facebook: 3/7/15/30/60/180/365", "done": false}, {"text": "Video View: 30/60/365", "done": false}, {"text": "Page View: 3/7/15/30/60/90/180", "done": false}, {"text": "Add to Cart: 3/7/15/30/60/90/180", "done": false}, {"text": "Initiate Checkout: 3/7/15/30/60/90/180", "done": false}, {"text": "Compras: 3/7/15/30/60/90/180", "done": false}, {"text": "Lista", "done": false}]}, {"title": "Publicos Google", "items": [{"text": "Visitou o site: 3/7/15/30/60/180/540", "done": false}, {"text": "Viu Video: 3/7/15/30/60/180/540", "done": false}, {"text": "Visitou Canal: 3/7/15/30/60/180/540", "done": false}, {"text": "Curtiu Videos: 3/7/15/30/60/180/540", "done": false}, {"text": "Add a Playlist: 3/7/15/30/60/180/540", "done": false}, {"text": "Compartilhou um Video: 3/7/15/30/60/180/540", "done": false}, {"text": "Envolvimento: 3/7/15/30/60/180/540", "done": false}, {"text": "Intencao de Compra", "done": false}, {"text": "Lista", "done": false}]}]'::jsonb,
    'nenhuma',
    false,
    NULL
  ),
  (
    'Audrei - Etapa 4 - Planejamento Estrategico',
    (SELECT id FROM audrei),
    'Onboarding',
    'urgente',
    'pendente',
    'Objetivo: Definir estrategia de campanhas, analise de campanhas anteriores, posicionamento, ofertas de valor, plano de campanhas, kick off.',
    '[{"title": "ENVIAR MENSAGEM DE FASE DE PLANEJAMENTO", "items": [{"text": "Enviar MENSAGEM 04", "done": false}]}, {"title": "ANALISE DE CAMPANHAS ANTERIORES", "items": [{"text": "Relatorio de melhores criativos", "done": false}, {"text": "Relatorio melhores publicos / palavras chave", "done": false}, {"text": "Relatorio de melhores objetivos de campanhas", "done": false}, {"text": "Relatorio do que nunca foi feito pelo cliente", "done": false}]}, {"title": "POSICIONAMENTO RELEVANTE", "items": [{"text": "Auditoria de ICP", "done": false}, {"text": "Auditoria de Redes Sociais", "done": false}, {"text": "Auditoria de E-commerce (Planilha)", "done": false}]}, {"title": "OFERTAS DE VALOR", "items": [{"text": "Consultoria de precificacao (se necessario)", "done": false}, {"text": "Setup Cupons de desconto", "done": false}, {"text": "Opcoes de pagamento", "done": false}, {"text": "Setup Frete gratis", "done": false}]}, {"title": "CRIAR PLANO DE CAMPANHAS", "items": [{"text": "Divisao de orcamento por plataforma", "done": false}, {"text": "Definicao de Campanhas por etapa do funil", "done": false}, {"text": "Criar mapa mental com toda a estrategia inicial", "done": false}]}, {"title": "KICK OFF", "items": [{"text": "Marcar reuniao de planejamento estrategico inicial", "done": false}, {"text": "Realizar reuniao de planejamento estrategico inicial", "done": false}]}]'::jsonb,
    'nenhuma',
    false,
    NULL
  ),
  (
    'Audrei - Etapa 5 - Campanhas e Go Live',
    (SELECT id FROM audrei),
    'Onboarding',
    'urgente',
    'pendente',
    'Objetivo: Subir campanhas de acordo com a estrategia criada.',
    '[{"title": "SUBIR CAMPANHAS", "items": [{"text": "Subir Campanhas Facebook Ads", "done": false}, {"text": "Subir Campanhas Google Ads", "done": false}, {"text": "Enviar [Mensagem 5]", "done": false}]}]'::jsonb,
    'nenhuma',
    false,
    NULL
  ),
  (
    'Audrei - Etapa 6 - Controles Internos',
    (SELECT id FROM audrei),
    'Onboarding',
    'urgente',
    'pendente',
    'Objetivo: Concluir o Onboarding internamente e cadastrar cliente nos controles necessarios.',
    '[{"title": "CONTROLES INTERNOS", "items": [{"text": "Configurar Tarefas (responsavel e datas)", "done": false}]}]'::jsonb,
    'nenhuma',
    false,
    NULL
  ),
  (
    'Audrei - Etapa 7 - Setup da Base The Midia',
    (SELECT id FROM audrei),
    'Onboarding',
    'urgente',
    'pendente',
    'Objetivo: Finalizar configuracoes da base interna, criar dashboards e relatorios.',
    '[{"title": "DASHBOARD", "items": [{"text": "Criar o Dashboard do cliente", "done": false}, {"text": "Criar o Relatorio do cliente", "done": false}, {"text": "Adicionar o link do dashboard na Base The midia", "done": false}]}]'::jsonb,
    'nenhuma',
    false,
    NULL
  ),
  (
    'Audrei - Revisao diaria de Verba e Performance',
    (SELECT id FROM audrei),
    'Trafego Pago',
    'alta',
    'pendente',
    'Garantir que as campanhas estejam rodando e que o orcamento esteja dentro do planejado.',
    '[{"title": "META ADS - BUDGET E PERFORMANCE", "items": [{"text": "Verificar se a campanhas teve veiculacao ontem e hoje", "done": false}, {"text": "Verificar se ha criativos ou publicos com CPA muito acima da media e pausar", "done": false}, {"text": "Verificar se as campanhas com mais performance estao recebendo o maior investimento [AJUSTAR de 20% em 20%]", "done": false}, {"text": "Caso as campanhas estejam com poucos criativos, testar alguma postagem ou solicitar novos criativos.", "done": false}, {"text": "Olhar notificacoes da conta.", "done": false}]}, {"title": "GOOGLE ADS - BUDGET E PERFORMANCE", "items": [{"text": "Verificar se a campanhas teve veiculacao ontem e hoje", "done": false}, {"text": "NEGATIVAR TERMOS DE PESQUISA SEM CONTEXTO", "done": false}, {"text": "Verificar se existem palavras chaves, criativos ou publicos com CPA muito acima da media e pausar ou negativar", "done": false}, {"text": "Verificar se as campanhas com mais performance estao recebendo o maior investimento [AJUSTAR de 20% em 20%]", "done": false}, {"text": "Ajustar ROAS, CPC ou CPA Desejado caso alguma campanha nao esteja gastando o orcamento", "done": false}, {"text": "Olhar notificacoes da conta.", "done": false}]}]'::jsonb,
    'semanal',
    true,
    1
  ),
  (
    'Audrei - Otimizacao Semanal',
    (SELECT id FROM audrei),
    'Trafego Pago',
    'alta',
    'pendente',
    'Pausar os piores criativos. Adicionar novos criativos. Pausar os piores publicos. Adicionar pelo menos um novo publico para teste.',
    '[{"title": "META ADS - OTIMIZACAO SEMANAL", "items": [{"text": "Otimizar orcamento (20% em 20%) (se necessario)", "done": false}, {"text": "Otimizar criativos, garantindo que os conjuntos de anuncios tenham de 2 a 6 criativos ativos.", "done": false}, {"text": "Otimizar publicos nos conjuntos de anuncios (Pausar com CPA alto, Testar novos e etc..)", "done": false}, {"text": "Otimizar estrutura de campanhas (Se o resultado estiver ruim, trocar campanhas ou objetivos de campanhas).", "done": false}, {"text": "Otimizar Catalogo de Produtos.", "done": false}, {"text": "Revisar destino se esta tudo certo (Otimizar ou Direcionar o cliente sobre possiveis melhorias).", "done": false}]}, {"title": "GOOGLE ADS - OTIMIZACAO SEMANAL", "items": [{"text": "Checar Recomendacoes do Google Ads a procura de pendencias na conta.", "done": false}, {"text": "Negativar palavras Chave usando filtro de 7 e 15 dias.", "done": false}, {"text": "Otimizar Grupos de Anuncios, isolando as melhores palavras chaves e criando anuncios especificos para elas.", "done": false}, {"text": "Otimizar ''onde os anuncios estao sendo exibidos'' nas campanhas de Display e Youtube.", "done": false}, {"text": "Otimizar Lances por publico alvo.", "done": false}]}, {"title": "MERCHANT CENTER - OTIMIZAR FEED DE PRODUTOS", "items": [{"text": "Otimizar Feed de Produtos", "done": false}]}, {"title": "CRIATIVOS", "items": [{"text": "Solicitar de 2-3 novos criativos", "done": false}]}]'::jsonb,
    'semanal',
    true,
    5
  ),
  (
    'Audrei - Otimizacao Mensal',
    (SELECT id FROM audrei),
    'Trafego Pago',
    'media',
    'pendente',
    'Auditar as campanhas. Revisar ativos desatualizados.',
    '[{"title": "META ADS", "items": [{"text": "Auditar campanhas ativas", "done": false}, {"text": "Revisar ativos desatualizados", "done": false}, {"text": "Verificar publicos com baixa performance", "done": false}, {"text": "Analisar criativos com baixo CTR", "done": false}, {"text": "Revisar orcamentos e distribuicao", "done": false}, {"text": "Atualizar horarios de veiculacao", "done": false}, {"text": "Verificar configuracoes de pixel", "done": false}]}, {"title": "GOOGLE ADS", "items": [{"text": "Auditar campanhas ativas", "done": false}, {"text": "Revisar palavras-chave negativas", "done": false}, {"text": "Verificar termos de pesquisa", "done": false}, {"text": "Analisar grupos de anuncios com baixa performance", "done": false}, {"text": "Revisar lances e orcamentos", "done": false}, {"text": "Atualizar extensoes de anuncios", "done": false}, {"text": "Verificar configuracoes de conversao", "done": false}, {"text": "Revisar configuracoes de publico-alvo", "done": false}]}]'::jsonb,
    'nenhuma',
    false,
    NULL
  ),
  (
    'Audrei - Analise de Funil',
    (SELECT id FROM audrei),
    'Trafego Pago',
    'media',
    'pendente',
    'Analise completa do funil de vendas e performance das campanhas.',
    '[{"title": "ANALISE DE E-COMMERCE", "items": [{"text": "Analisar taxa de conversao do site", "done": false}, {"text": "Verificar abandono de carrinho", "done": false}, {"text": "Analisar funil de checkout", "done": false}, {"text": "Revisar paginas de produto", "done": false}, {"text": "Verificar velocidade do site", "done": false}, {"text": "Analisar heatmaps e comportamento", "done": false}]}, {"title": "ANALISE DE INSTAGRAM", "items": [{"text": "Postagens com frequencia?", "done": false}, {"text": "Stories ativos?", "done": false}, {"text": "Bio que mostra diferenciacao + CTA para link do site?", "done": false}, {"text": "Destaques padronizados com capas e atualizados?", "done": false}, {"text": "Sacolinha do Instagram ativada?", "done": false}, {"text": "Fixados bem aproveitados?", "done": false}]}]'::jsonb,
    'nenhuma',
    false,
    NULL
  ),
  (
    'Audrei - Solicitar/Sugerir Novos Criativos',
    (SELECT id FROM audrei),
    'Trafego Pago',
    'media',
    'pendente',
    'Solicitacao e sugestao de novos criativos para as campanhas.',
    '[{"title": "CRIATIVOS", "items": [{"text": "Solicitar novos criativos para o time de design", "done": false}, {"text": "Sugerir formatos e abordagens criativas", "done": false}]}]'::jsonb,
    'nenhuma',
    false,
    NULL
  ),
  (
    'Audrei - Enviar formulario de satisfacao',
    (SELECT id FROM audrei),
    'Sucesso do Cliente',
    'media',
    'pendente',
    'Coletar feedback mensal. Entender sobre os dois R''s (Resultado e Relacionamento). Quando: Ultimo dia do mes.',
    '[{"title": "Enviar formulario de satisfacao", "items": [{"text": "Gerar link do formulario de satisfacao", "done": false}, {"text": "Enviar formulario para o cliente (WhatsApp ou e-mail)", "done": false}, {"text": "Acompanhar respostas recebidas", "done": false}, {"text": "Analisar feedback recebido e planejar acoes de melhoria", "done": false}]}]'::jsonb,
    'nenhuma',
    false,
    NULL
  ),
  (
    'Audrei - Relatorio e Feedback Semanal',
    (SELECT id FROM audrei),
    'Sucesso do Cliente',
    'media',
    'pendente',
    'Transparencia com o cliente sobre resultados e progresso. Exercitar o relacionamento.',
    '[{"title": "Relatorio semanal", "items": [{"text": "Abrir o Dashboard do cliente no Looker Studio", "done": false}, {"text": "Selecionar o periodo do relatorio", "done": false}, {"text": "Gerar relatorio com ChatGPT e revisar", "done": false}, {"text": "Gerar link do relatorio no Looker Studio", "done": false}, {"text": "Enviar para o Grupo do WhatsApp com mensagem padrao", "done": false}, {"text": "Salvar relatorio em PDF na pasta do cliente no Google Drive", "done": false}]}]'::jsonb,
    'semanal',
    true,
    5
  );

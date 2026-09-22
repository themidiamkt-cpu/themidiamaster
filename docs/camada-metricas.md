# Camada de métricas — desenvolvimento

`frontend/js/metrics.js` é o contrato comum para dashboard de clientes, relatório Meta salvo e texto semanal. Cada métrica identifica fonte, canal, período, fuso (`America/Sao_Paulo`), moeda (`BRL`), janela de atribuição, atualização, cobertura e estado (`measured`, `estimated`, `partial`, `missing`). A janela Meta é marcada como não registrada: a API usa a configuração da conta, mas este projeto ainda não persiste qual janela foi aplicada.

- **Receita atribuída Meta:** soma de `action_values` do período. Não representa vendas operacionais conciliadas.
- **Vendas operacionais:** lançamentos de `vendas_cliente`, com sua própria origem. A ausência de lançamento não vira zero confirmado.
- **Receita conciliada:** indisponível até existir identificador e processo de conciliação entre venda e conversão Meta.
- **Estimativa de relatório:** um relatório salvo é distribuído proporcionalmente pelos seus dias apenas nos dias sem fato diário. Quando há relatórios sobrepostos, o mais recente fornece aquele dia. Estimativas são rotuladas e não produzem ROAS de período completo.
- **Alcance único:** somente a consulta Meta no nível da conta e período pode preenchê-lo. Linhas por anúncio ou semana não são somadas para alcance único.
- **Comparação:** usa a mesma métrica Meta nos períodos atual e anterior. Vendas operacionais aparecem separadas. Nenhum ROAS operacional é calculado sem conciliação. Filtro de origem não transforma gasto Meta em custo daquela origem.

O relatório salvo novo grava proveniência e limitações em `analise_estrategica` e permite `NULL` quando alcance/ROAS não estão disponíveis; dados legados permanecem com seus valores originais e podem não ter proveniência suficiente para reinterpretação. Não há migration neste escopo. Validação local: fixtures em `tests/metrics.test.js`, build Vite. Contas e relatórios reais não foram auditados.

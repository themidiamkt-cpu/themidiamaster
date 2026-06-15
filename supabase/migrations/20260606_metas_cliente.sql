-- Função para auto-atualizar updated_at (cria se ainda não existir)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Metas por cliente: custo por resultado, ROAS mínimo, CTR mínimo, verba máxima
CREATE TABLE IF NOT EXISTS metas_cliente (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  objetivo text NOT NULL CHECK (objetivo IN ('mensagens', 'leads', 'vendas', 'seguidores')),
  meta_custo_resultado numeric,        -- R$ alvo de custo por resultado
  meta_roas_minimo numeric,            -- ROAS mínimo aceitável
  meta_ctr_minimo numeric,             -- CTR mínimo em % (ex: 1.5)
  verba_diaria_maxima numeric,         -- Limite máximo de gasto diário em R$
  threshold_variacao_pct numeric DEFAULT 30, -- % de variação vs 7d para disparar alerta
  ativo boolean DEFAULT true,
  observacoes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_metas_cliente ON metas_cliente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_metas_ativo ON metas_cliente(ativo);

DROP TRIGGER IF EXISTS set_updated_at_metas ON metas_cliente;
CREATE TRIGGER set_updated_at_metas
  BEFORE UPDATE ON metas_cliente
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE metas_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated manage metas"
  ON metas_cliente FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Anon can read metas"
  ON metas_cliente FOR SELECT TO anon
  USING (true);

-- Adicionar FK de alertas para metas (se a tabela alertas já existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alertas_anomalia') THEN
    -- Colunas novas caso a tabela já exista de uma execução anterior
    ALTER TABLE alertas_anomalia
      ADD COLUMN IF NOT EXISTS tipo_alerta text DEFAULT 'variacao'
        CHECK (tipo_alerta IN ('meta', 'variacao')),
      ADD COLUMN IF NOT EXISTS objetivo text,
      ADD COLUMN IF NOT EXISTS meta_id uuid REFERENCES metas_cliente(id) ON DELETE SET NULL;
  END IF;
END$$;

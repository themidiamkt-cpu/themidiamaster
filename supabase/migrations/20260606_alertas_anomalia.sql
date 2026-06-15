-- Função para auto-atualizar updated_at (cria se ainda não existir)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tabela de alertas de anomalias detectadas automaticamente via n8n
CREATE TABLE IF NOT EXISTS alertas_anomalia (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
  nome_cliente text NOT NULL,
  meta_ads_act text NOT NULL,
  metrica text NOT NULL CHECK (metrica IN ('cpl', 'ctr', 'roas', 'spend')),
  tipo_alerta text DEFAULT 'variacao' CHECK (tipo_alerta IN ('meta', 'variacao')),
  objetivo text,
  meta_id uuid,
  valor_atual numeric,
  valor_referencia numeric,
  variacao_pct numeric,
  severidade text NOT NULL DEFAULT 'alta' CHECK (severidade IN ('critica', 'alta', 'media')),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'resolvido', 'ignorado')),
  periodo_referencia text,
  resolvido_em timestamptz,
  resolvido_por text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alertas_status ON alertas_anomalia(status);
CREATE INDEX IF NOT EXISTS idx_alertas_cliente ON alertas_anomalia(cliente_id);
CREATE INDEX IF NOT EXISTS idx_alertas_created ON alertas_anomalia(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_metrica ON alertas_anomalia(metrica);

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_updated_at_alertas ON alertas_anomalia;
CREATE TRIGGER set_updated_at_alertas
  BEFORE UPDATE ON alertas_anomalia
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE alertas_anomalia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated manage alertas"
  ON alertas_anomalia FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Anon can insert alertas"
  ON alertas_anomalia FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can read alertas"
  ON alertas_anomalia FOR SELECT TO anon
  USING (true);

-- Permite anon ler clientes (necessário para n8n)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'clientes' AND policyname = 'Anon can read clientes'
  ) THEN
    CREATE POLICY "Anon can read clientes" ON clientes FOR SELECT TO anon USING (true);
  END IF;
END$$;

-- Adiciona colunas de valor por período nos alertas
ALTER TABLE alertas_anomalia
  ADD COLUMN IF NOT EXISTS valor_1d numeric,
  ADD COLUMN IF NOT EXISTS valor_3d numeric;

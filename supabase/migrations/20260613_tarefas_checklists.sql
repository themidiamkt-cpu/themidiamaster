-- ============================================================
-- Tarefas: adiciona data_inicio e checklists (JSONB)
-- ============================================================
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS data_inicio date;
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS checklists jsonb DEFAULT '[]'::jsonb;

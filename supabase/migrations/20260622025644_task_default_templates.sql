alter table public.tarefas
  drop constraint if exists tarefas_recorrencia_check;

alter table public.tarefas
  add constraint tarefas_recorrencia_check
  check (recorrencia in ('nenhuma', 'diaria', 'semanal', 'mensal_primeiro_dia_util'));

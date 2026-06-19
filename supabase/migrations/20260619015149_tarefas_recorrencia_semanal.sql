alter table public.tarefas
  add column if not exists recorrencia text not null default 'nenhuma'
    check (recorrencia in ('nenhuma', 'semanal')),
  add column if not exists recorrencia_dia_semana integer
    check (recorrencia_dia_semana is null or recorrencia_dia_semana between 0 and 6),
  add column if not exists recorrencia_ativa boolean not null default false;

create index if not exists idx_tarefas_recorrencia
on public.tarefas(recorrencia, recorrencia_ativa, recorrencia_dia_semana);

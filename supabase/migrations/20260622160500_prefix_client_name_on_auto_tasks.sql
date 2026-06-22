update public.tarefas t
set titulo = trim(c.nome_empresa) || ' - Etapa ' || substring(t.titulo from 'Onboarding - Etapa ([1-7])'),
    updated_at = now()
from public.clientes c
where c.id = t.cliente_id
  and t.titulo ~* '^Onboarding - Etapa [1-7]$';

update public.tarefas t
set titulo = trim(c.nome_empresa) || ' - ' || t.titulo,
    updated_at = now()
from public.clientes c
where c.id = t.cliente_id
  and t.titulo ~* '^Trafego pago - '
  and t.titulo not ilike trim(c.nome_empresa) || ' - %';

notify pgrst, 'reload schema';

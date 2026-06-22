update public.tarefas as t
set
  responsavel = 'Roberto',
  updated_at = now()
from public.clientes as c
where c.id = t.cliente_id
  and not exists (
    select 1
    from public.equipe_clientes as ec
    join public.equipe as e on e.id = ec.equipe_id
    where ec.cliente_id = c.id
      and lower(trim(e.nome)) = 'nicolas'
  )
  and coalesce(t.responsavel, '') <> 'Roberto';

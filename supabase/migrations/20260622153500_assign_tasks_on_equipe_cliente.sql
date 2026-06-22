create or replace function public.apply_equipe_cliente_assignment()
returns trigger
language plpgsql
as $$
declare
  member_name text;
begin
  select nullif(trim(e.nome), '')
    into member_name
  from public.equipe e
  where e.id = new.equipe_id;

  if member_name is null then
    return new;
  end if;

  update public.clientes
  set responsavel_interno = member_name,
      updated_at = now()
  where id = new.cliente_id;

  update public.tarefas
  set responsavel = member_name,
      updated_at = now()
  where cliente_id = new.cliente_id;

  return new;
end;
$$;

drop trigger if exists trigger_apply_equipe_cliente_assignment on public.equipe_clientes;

create trigger trigger_apply_equipe_cliente_assignment
after insert on public.equipe_clientes
for each row
execute function public.apply_equipe_cliente_assignment();

with latest_assignment as (
  select distinct on (ec.cliente_id)
    ec.cliente_id,
    nullif(trim(e.nome), '') as member_name
  from public.equipe_clientes ec
  join public.equipe e on e.id = ec.equipe_id
  where e.status = 'ativo'
  order by ec.cliente_id, ec.created_at desc
)
update public.clientes c
set responsavel_interno = la.member_name,
    updated_at = now()
from latest_assignment la
where c.id = la.cliente_id
  and la.member_name is not null;

with latest_assignment as (
  select distinct on (ec.cliente_id)
    ec.cliente_id,
    nullif(trim(e.nome), '') as member_name
  from public.equipe_clientes ec
  join public.equipe e on e.id = ec.equipe_id
  where e.status = 'ativo'
  order by ec.cliente_id, ec.created_at desc
)
update public.tarefas t
set responsavel = la.member_name,
    updated_at = now()
from latest_assignment la
where t.cliente_id = la.cliente_id
  and la.member_name is not null;

notify pgrst, 'reload schema';

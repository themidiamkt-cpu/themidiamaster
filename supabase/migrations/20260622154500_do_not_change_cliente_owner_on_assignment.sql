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

  update public.tarefas
  set responsavel = member_name,
      updated_at = now()
  where cliente_id = new.cliente_id;

  return new;
end;
$$;

notify pgrst, 'reload schema';

create or replace function public.next_weekday_date(target_dow int, from_date date default current_date)
returns date
language sql
immutable
as $$
  select (from_date + (((target_dow - extract(dow from from_date)::int + 7) % 7 + case when ((target_dow - extract(dow from from_date)::int + 7) % 7) = 0 then 7 else 0 end) * interval '1 day'))::date;
$$;

create or replace function public.first_business_day(year_value int, month_value int)
returns date
language plpgsql
immutable
as $$
declare
  candidate date := make_date(year_value, month_value, 1);
begin
  while extract(dow from candidate)::int in (0, 6) loop
    candidate := candidate + 1;
  end loop;
  return candidate;
end;
$$;

create or replace function public.next_first_business_day(from_date date default current_date)
returns date
language plpgsql
immutable
as $$
declare
  candidate date;
  next_month date;
begin
  candidate := public.first_business_day(extract(year from from_date)::int, extract(month from from_date)::int);
  if candidate < from_date then
    next_month := (date_trunc('month', from_date)::date + interval '1 month')::date;
    candidate := public.first_business_day(extract(year from next_month)::int, extract(month from next_month)::int);
  end if;
  return candidate;
end;
$$;

update public.tarefas
set categoria = 'Onboarding',
    data_inicio = coalesce(data_inicio, current_date),
    data_vencimento = coalesce(
      data_vencimento,
      case
        when titulo ~* 'etapa 1' then current_date + 1
        when titulo ~* 'etapa 2' then current_date + 1
        when titulo ~* 'etapa 3' then current_date + 2
        when titulo ~* 'etapa 4' then current_date + 3
        when titulo ~* 'etapa 5' then current_date + 4
        when titulo ~* 'etapa 6' then current_date + 5
        when titulo ~* 'etapa 7' then current_date + 6
        else current_date + 1
      end
    ),
    recorrencia = 'nenhuma',
    recorrencia_ativa = false,
    recorrencia_dia_semana = null,
    updated_at = now()
where status <> 'cancelada'
  and (
    categoria = 'Onboarding'
    or titulo ~* 'etapa [1-7]'
  );

update public.tarefas
set categoria = 'Trafego Pago',
    data_inicio = coalesce(data_inicio, current_date),
    data_vencimento = public.next_first_business_day(current_date),
    recorrencia = 'mensal_primeiro_dia_util',
    recorrencia_ativa = true,
    recorrencia_dia_semana = null,
    updated_at = now()
where status <> 'cancelada'
  and titulo ilike '%otimizacao mensal%';

update public.tarefas
set categoria = 'Trafego Pago',
    data_inicio = coalesce(data_inicio, current_date),
    data_vencimento = public.next_weekday_date(2, current_date),
    recorrencia = 'semanal',
    recorrencia_ativa = true,
    recorrencia_dia_semana = 2,
    updated_at = now()
where status <> 'cancelada'
  and (
    titulo ilike '%otimizacao semanal%'
    or titulo ilike '%criativo%'
    or titulo ilike '%solicitar/sugerir novos criativos%'
  );

update public.tarefas
set categoria = 'Trafego Pago',
    data_inicio = coalesce(data_inicio, current_date),
    data_vencimento = public.next_weekday_date(3, current_date),
    recorrencia = 'semanal',
    recorrencia_ativa = true,
    recorrencia_dia_semana = 3,
    updated_at = now()
where status <> 'cancelada'
  and (
    titulo ilike '%analise de funil%'
    or titulo ilike '%funil%'
  );

update public.tarefas
set categoria = 'Trafego Pago',
    data_inicio = coalesce(data_inicio, current_date),
    data_vencimento = current_date + 1,
    recorrencia = 'diaria',
    recorrencia_ativa = true,
    recorrencia_dia_semana = null,
    updated_at = now()
where status <> 'cancelada'
  and titulo ilike '%revisao diaria%';

update public.tarefas
set categoria = 'Trafego Pago',
    data_inicio = coalesce(data_inicio, current_date),
    data_vencimento = public.next_weekday_date(1, current_date),
    recorrencia = 'semanal',
    recorrencia_ativa = true,
    recorrencia_dia_semana = 1,
    updated_at = now()
where status <> 'cancelada'
  and titulo ilike '%relatorio%';

update public.tarefas
set data_inicio = coalesce(data_inicio, current_date),
    data_vencimento = public.next_first_business_day(current_date),
    recorrencia = 'mensal_primeiro_dia_util',
    recorrencia_ativa = true,
    recorrencia_dia_semana = null,
    updated_at = now()
where status <> 'cancelada'
  and (
    titulo ilike '%avaliar cliente%'
    or titulo ilike '%formulario de satisfacao%'
  );

update public.tarefas
set data_inicio = coalesce(data_inicio, current_date),
    data_vencimento = current_date + 1,
    updated_at = now()
where status <> 'cancelada'
  and data_vencimento is null;

notify pgrst, 'reload schema';

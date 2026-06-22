alter table public.alertas_anomalia
  drop constraint if exists alertas_anomalia_metrica_check;

alter table public.alertas_anomalia
  add constraint alertas_anomalia_metrica_check
  check (metrica in ('cpl', 'ctr', 'roas', 'spend', 'diario'));

alter table public.alertas_anomalia
  drop constraint if exists alertas_anomalia_tipo_alerta_check;

alter table public.alertas_anomalia
  add constraint alertas_anomalia_tipo_alerta_check
  check (tipo_alerta in ('meta', 'variacao', 'anotacao_diario'));

create or replace function public.criar_alerta_anotacao_diario_gestor()
returns trigger
language plpgsql
as $$
declare
  claims jsonb;
  user_email text;
  user_role text;
  cliente_nome text;
  cliente_act text;
begin
  if coalesce(trim(new.anotacoes), '') = '' then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.anotacoes is not distinct from old.anotacoes then
    return new;
  end if;

  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  user_email := lower(coalesce(claims ->> 'email', new.autor, ''));
  user_role := coalesce(
    claims -> 'app_metadata' ->> 'funcao',
    claims -> 'user_metadata' ->> 'funcao',
    ''
  );

  if user_email = 'themidiamkt@gmail.com' or user_role <> 'gestor_trafego' then
    return new;
  end if;

  select c.nome_empresa, coalesce(c.meta_ads_act, 'diario')
    into cliente_nome, cliente_act
  from public.clientes c
  where c.id = new.cliente_id;

  if exists (
    select 1
    from public.alertas_anomalia a
    where a.periodo_referencia = 'diario:' || new.id::text
      and a.status = 'ativo'
  ) then
    return new;
  end if;

  insert into public.alertas_anomalia (
    cliente_id,
    nome_cliente,
    meta_ads_act,
    metrica,
    tipo_alerta,
    objetivo,
    severidade,
    status,
    periodo_referencia,
    valor_atual,
    valor_referencia,
    variacao_pct
  ) values (
    new.cliente_id,
    coalesce(cliente_nome, 'Sem cliente'),
    coalesce(cliente_act, 'diario'),
    'diario',
    'anotacao_diario',
    left(coalesce(new.anotacoes, ''), 240),
    'alta',
    'ativo',
    'diario:' || new.id::text,
    null,
    null,
    null
  );

  return new;
end;
$$;

drop trigger if exists trigger_alerta_anotacao_diario_gestor on public.diario_bordo;

create trigger trigger_alerta_anotacao_diario_gestor
after insert or update of anotacoes on public.diario_bordo
for each row
execute function public.criar_alerta_anotacao_diario_gestor();

notify pgrst, 'reload schema';

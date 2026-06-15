-- The Midia Master | RLS fix para ambiente interno autenticado
-- Execute no SQL Editor caso inserts/updates retornem:
-- "new row violates row-level security policy"

do $$
declare
  t text;
begin
  foreach t in array array[
    'clientes',
    'leads_crm',
    'campanhas',
    'relatorios',
    'tarefas',
    'onboarding_checklists',
    'ativos_cliente',
    'observacoes_cliente',
    'equipe'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "internal_authenticated_all_%s" on public.%I', t, t);
    execute format(
      'create policy "internal_authenticated_all_%s" on public.%I for all to authenticated using (true) with check (true)',
      t,
      t
    );
  end loop;
end $$;

notify pgrst, 'reload schema';

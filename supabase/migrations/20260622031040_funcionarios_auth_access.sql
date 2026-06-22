alter table public.equipe
  add column if not exists auth_user_id uuid unique,
  add column if not exists funcao text not null default 'gestor_trafego';

alter table public.equipe
  drop constraint if exists equipe_funcao_check;

alter table public.equipe
  add constraint equipe_funcao_check
  check (funcao in ('gestor_trafego', 'admin', 'operacao'));

create index if not exists idx_equipe_auth_user_id on public.equipe(auth_user_id);
create index if not exists idx_equipe_email on public.equipe(lower(email));

notify pgrst, 'reload schema';

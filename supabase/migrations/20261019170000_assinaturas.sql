create table if not exists public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  fornecedor text,
  categoria text not null default 'software',
  valor numeric(12,2) not null check (valor >= 0),
  recorrencia text not null default 'mensal' check (recorrencia in ('mensal', 'trimestral', 'semestral', 'anual', 'unica')),
  proximo_vencimento date not null,
  forma_pagamento text,
  status text not null default 'ativa' check (status in ('ativa', 'pausada', 'cancelada')),
  ultimo_pagamento_em timestamptz,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assinaturas enable row level security;

drop policy if exists "assinaturas_admin_all" on public.assinaturas;
create policy "assinaturas_admin_all"
on public.assinaturas
for all
to authenticated
using (public.is_main_admin())
with check (public.is_main_admin());

revoke all on table public.assinaturas from anon;
grant select, insert, update, delete on table public.assinaturas to authenticated;

drop trigger if exists set_assinaturas_updated_at on public.assinaturas;
create trigger set_assinaturas_updated_at
before update on public.assinaturas
for each row execute function public.set_updated_at();

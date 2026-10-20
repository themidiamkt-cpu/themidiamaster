-- Creative Intelligence: dados estruturados que o Master online le.
-- O Obsidian continua sendo a memoria consolidada; aqui ficam so os dados de consulta.
-- Aditiva: nao altera nenhuma tabela existente. Reaproveita public.clientes, set_updated_at(),
-- is_main_admin() e can_access_cliente() (mesmo padrao de diario_bordo e metas_cliente).

-- 1) Nichos: inteligencia consolidada de um mercado ---------------------------------------
create table if not exists public.ci_nichos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nome text not null,
  publico text,
  status text not null default 'ativo' check (status in ('ativo', 'aguardando-cliente')),
  resumo text,
  padroes jsonb not null default '[]'::jsonb check (jsonb_typeof(padroes) = 'array'),
  recorrencias jsonb not null default '[]'::jsonb check (jsonb_typeof(recorrencias) = 'array'),
  pouco_explorado jsonb not null default '[]'::jsonb check (jsonb_typeof(pouco_explorado) = 'array'),
  ideias_explorar jsonb not null default '[]'::jsonb check (jsonb_typeof(ideias_explorar) = 'array'),
  restricoes jsonb not null default '[]'::jsonb check (jsonb_typeof(restricoes) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Pesquisas: cada rodada executada pelo Claude/Jev ------------------------------------
create table if not exists public.ci_pesquisas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete set null,
  nicho_id uuid not null references public.ci_nichos(id) on delete restrict,
  chave text,
  titulo text not null,
  objetivo text,
  dor_tema text,
  fonte text not null default 'meta-ads-library',
  consultas jsonb not null default '[]'::jsonb check (jsonb_typeof(consultas) = 'array'),
  territorios jsonb not null default '[]'::jsonb check (jsonb_typeof(territorios) = 'array'),
  cartoes_observados integer check (cartoes_observados is null or cartoes_observados >= 0),
  anunciantes_observados integer check (anunciantes_observados is null or anunciantes_observados >= 0),
  candidatos integer check (candidatos is null or candidatos >= 0),
  referencias_salvas integer check (referencias_salvas is null or referencias_salvas >= 0),
  resumo text,
  status text not null default 'em_andamento' check (status in ('em_andamento', 'concluida', 'erro')),
  executado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Referencias: swipe file estruturado ---------------------------------------------------
create table if not exists public.ci_referencias (
  id uuid primary key default gen_random_uuid(),
  pesquisa_id uuid references public.ci_pesquisas(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  nicho_id uuid not null references public.ci_nichos(id) on delete restrict,
  fonte text not null default 'meta-ads-library',
  id_externo text,
  url text,
  destino_url text,
  anunciante text not null,
  formato text,
  hook text,
  angulo text,
  oferta text,
  cta text,
  ativo_desde date,
  consultado_em date,
  motivo_salvo text[] not null default '{}',
  fatos jsonb not null default '[]'::jsonb check (jsonb_typeof(fatos) = 'array'),
  observacoes jsonb not null default '[]'::jsonb check (jsonb_typeof(observacoes) = 'array'),
  sinais jsonb not null default '[]'::jsonb check (jsonb_typeof(sinais) = 'array'),
  hipoteses jsonb not null default '[]'::jsonb check (jsonb_typeof(hipoteses) = 'array'),
  transcricao text,
  plataformas text,
  variacoes_observadas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Deduplicacao (idempotencia). Escopo = nicho: o mesmo anuncio pode servir a dois nichos.
--  a) com id_externo (ex.: ID da Meta Ads Library): um registro por nicho + fonte + id.
create unique index if not exists ux_ci_referencias_nicho_fonte_id_externo
  on public.ci_referencias (nicho_id, fonte, id_externo)
  where id_externo is not null;
--  b) sem id_externo mas com url: um registro por nicho + fonte + url.
create unique index if not exists ux_ci_referencias_nicho_fonte_url
  on public.ci_referencias (nicho_id, fonte, url)
  where id_externo is null and url is not null;
--  c) sem id nem url: sem UNIQUE (seria fragil). Indice de apoio para a checagem feita pela skill.
create index if not exists idx_ci_referencias_lookup
  on public.ci_referencias (nicho_id, fonte, lower(anunciante));

-- 4) Conceitos -------------------------------------------------------------------------------
create table if not exists public.ci_conceitos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  nicho_id uuid not null references public.ci_nichos(id) on delete restrict,
  nome text not null,
  status text not null default 'ideia' check (status in ('ideia', 'selecionado', 'roteirizado', 'descartado')),
  posicionamento text check (posicionamento is null or posicionamento in ('paridade', 'diferenciacao', 'mecanismo-proprio')),
  angulo text,
  hook text,
  dor_desejo text,
  ideia_central text,
  formato text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id, nome)
);

-- Referencias usadas por cada conceito (N:N)
create table if not exists public.ci_conceito_referencias (
  conceito_id uuid not null references public.ci_conceitos(id) on delete cascade,
  referencia_id uuid not null references public.ci_referencias(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conceito_id, referencia_id)
);

-- 5) Roteiros: separados no banco (no Obsidian ficam dentro do conceito) --------------------
create table if not exists public.ci_roteiros (
  id uuid primary key default gen_random_uuid(),
  conceito_id uuid not null references public.ci_conceitos(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  nicho_id uuid not null references public.ci_nichos(id) on delete restrict,
  versao integer not null default 1 check (versao >= 1),
  titulo text,
  hook text,
  roteiro text,
  cenas text,
  texto_tela text,
  cta text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conceito_id, versao)
);

-- cliente e nicho do roteiro sempre vem do conceito (evita inconsistencia)
create or replace function public.ci_roteiros_sync_scope()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select c.cliente_id, c.nicho_id into new.cliente_id, new.nicho_id
  from public.ci_conceitos c where c.id = new.conceito_id;
  return new;
end;
$$;

drop trigger if exists ci_roteiros_sync_scope on public.ci_roteiros;
create trigger ci_roteiros_sync_scope before insert or update of conceito_id on public.ci_roteiros
for each row execute function public.ci_roteiros_sync_scope();

-- indices de apoio ---------------------------------------------------------------------------
create index if not exists idx_ci_pesquisas_nicho_id on public.ci_pesquisas(nicho_id);
create index if not exists idx_ci_pesquisas_cliente_id on public.ci_pesquisas(cliente_id);
create index if not exists idx_ci_pesquisas_executado_em on public.ci_pesquisas(executado_em desc);
create unique index if not exists ux_ci_pesquisas_chave on public.ci_pesquisas(chave) where chave is not null;
create index if not exists idx_ci_referencias_pesquisa_id on public.ci_referencias(pesquisa_id);
create index if not exists idx_ci_referencias_cliente_id on public.ci_referencias(cliente_id);
create index if not exists idx_ci_conceitos_nicho_id on public.ci_conceitos(nicho_id);
create index if not exists idx_ci_conceito_referencias_referencia_id on public.ci_conceito_referencias(referencia_id);
create index if not exists idx_ci_roteiros_cliente_id on public.ci_roteiros(cliente_id);
create index if not exists idx_ci_roteiros_nicho_id on public.ci_roteiros(nicho_id);

-- updated_at (mesmo trigger das demais tabelas) ---------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['ci_nichos', 'ci_pesquisas', 'ci_referencias', 'ci_conceitos', 'ci_roteiros'] loop
    execute format('drop trigger if exists set_%1$s_updated_at on public.%1$s', t);
    execute format('create trigger set_%1$s_updated_at before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- RLS: mesmo modelo do Master (administrador principal + equipe por cliente atribuido) ------
alter table public.ci_nichos enable row level security;
alter table public.ci_pesquisas enable row level security;
alter table public.ci_referencias enable row level security;
alter table public.ci_conceitos enable row level security;
alter table public.ci_conceito_referencias enable row level security;
alter table public.ci_roteiros enable row level security;

-- anon nunca enxerga nada daqui (alem de nao haver policy para anon)
revoke all on public.ci_nichos, public.ci_pesquisas, public.ci_referencias, public.ci_conceitos,
  public.ci_conceito_referencias, public.ci_roteiros from anon;

drop policy if exists "admin_all_ci_nichos" on public.ci_nichos;
create policy "admin_all_ci_nichos" on public.ci_nichos for all to authenticated
  using (public.is_main_admin()) with check (public.is_main_admin());

drop policy if exists "admin_all_ci_pesquisas" on public.ci_pesquisas;
create policy "admin_all_ci_pesquisas" on public.ci_pesquisas for all to authenticated
  using (public.is_main_admin()) with check (public.is_main_admin());
drop policy if exists "team_select_ci_pesquisas_assigned" on public.ci_pesquisas;
create policy "team_select_ci_pesquisas_assigned" on public.ci_pesquisas for select to authenticated
  using (cliente_id is not null and public.can_access_cliente(cliente_id));

drop policy if exists "admin_all_ci_referencias" on public.ci_referencias;
create policy "admin_all_ci_referencias" on public.ci_referencias for all to authenticated
  using (public.is_main_admin()) with check (public.is_main_admin());
drop policy if exists "team_select_ci_referencias_assigned" on public.ci_referencias;
create policy "team_select_ci_referencias_assigned" on public.ci_referencias for select to authenticated
  using (cliente_id is not null and public.can_access_cliente(cliente_id));

drop policy if exists "admin_all_ci_conceitos" on public.ci_conceitos;
create policy "admin_all_ci_conceitos" on public.ci_conceitos for all to authenticated
  using (public.is_main_admin()) with check (public.is_main_admin());
drop policy if exists "team_select_ci_conceitos_assigned" on public.ci_conceitos;
create policy "team_select_ci_conceitos_assigned" on public.ci_conceitos for select to authenticated
  using (public.can_access_cliente(cliente_id));

drop policy if exists "admin_all_ci_conceito_referencias" on public.ci_conceito_referencias;
create policy "admin_all_ci_conceito_referencias" on public.ci_conceito_referencias for all to authenticated
  using (public.is_main_admin()) with check (public.is_main_admin());
drop policy if exists "team_select_ci_conceito_referencias_assigned" on public.ci_conceito_referencias;
create policy "team_select_ci_conceito_referencias_assigned" on public.ci_conceito_referencias for select to authenticated
  using (exists (select 1 from public.ci_conceitos c where c.id = conceito_id and public.can_access_cliente(c.cliente_id)));

drop policy if exists "admin_all_ci_roteiros" on public.ci_roteiros;
create policy "admin_all_ci_roteiros" on public.ci_roteiros for all to authenticated
  using (public.is_main_admin()) with check (public.is_main_admin());
drop policy if exists "team_select_ci_roteiros_assigned" on public.ci_roteiros;
create policy "team_select_ci_roteiros_assigned" on public.ci_roteiros for select to authenticated
  using (public.can_access_cliente(cliente_id));

comment on table public.ci_nichos is 'Creative Intelligence: inteligencia consolidada por nicho (espelho estruturado da nota do Obsidian).';
comment on table public.ci_pesquisas is 'Creative Intelligence: rodadas de pesquisa executadas pelo Claude/Jev. O Master nao dispara pesquisas.';
comment on table public.ci_referencias is 'Creative Intelligence: swipe file. Dedup por (nicho, fonte, id_externo) ou (nicho, fonte, url).';
comment on table public.ci_roteiros is 'Creative Intelligence: roteiros por conceito; versao permite varias versoes por conceito.';

-- MPH Sistema — fase 1: perfis de usuário e cadastros gerais.
-- Rode no Supabase em: SQL Editor → New query → cole tudo → Run.

-- ============================================================
-- Perfis de usuário
-- ============================================================
create type public.papel as enum ('admin', 'financeiro', 'engenharia', 'suprimentos', 'usuario');

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  email text not null default '',
  celular text,
  papel public.papel not null default 'usuario',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Cria o perfil automaticamente quando um usuário é criado no Auth.
-- O primeiro usuário do sistema vira admin.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id, nome, email, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email,
    case when exists (select 1 from public.perfis) then 'usuario'::public.papel else 'admin'::public.papel end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Papel do usuário logado (usado nas políticas de RLS).
create function public.meu_papel() returns public.papel
language sql stable security definer set search_path = '' as $$
  select papel from public.perfis where id = auth.uid() and ativo
$$;

create function public.pode_editar_cadastros() returns boolean
language sql stable as $$
  select coalesce(public.meu_papel() in ('admin', 'financeiro', 'suprimentos'), false)
$$;

-- ============================================================
-- Utilidades
-- ============================================================
create function public.set_atualizado_em() returns trigger
language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

-- ============================================================
-- Clientes (contratantes)
-- ============================================================
create table public.clientes (
  id bigint generated always as identity primary key,
  nome text not null,
  razao_social text,
  cnpj text unique,
  telefone text,
  celular text,
  responsavel text,
  endereco text,
  bairro text,
  cep text,
  gerenciadora text,
  arquitetura text,
  tipo text,
  valida_engenharia_nota boolean not null default false,
  obriga_anexo_oc_nf boolean not null default false,
  inicio date,
  fim date,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ============================================================
-- Obras
-- ============================================================
create type public.regime_obra as enum ('administracao', 'empreitada');
create type public.status_obra as enum ('orcamento', 'em_andamento', 'paralisada', 'concluida');

create table public.obras (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  nome text not null,
  cliente_id bigint references public.clientes (id) on delete restrict,
  ano int,
  regime public.regime_obra not null default 'administracao',
  status public.status_obra not null default 'em_andamento',
  status_complementar text,
  tipo_obra text,
  metragem numeric(12, 2),
  inicio date,
  termino date,
  entrega_prevista date,
  as_built boolean not null default false,
  possui_seguro boolean not null default false,
  engenheiro text,
  arquitetura text,
  gerenciadora text,
  orcamentista text,
  suprimento text,
  taxa_adm_analise_financeira numeric(6, 2),
  taxa_adm_analise_orcamento numeric(6, 2),
  valor_total numeric(14, 2),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ============================================================
-- Fornecedores
-- ============================================================
create table public.fornecedores (
  id bigint generated always as identity primary key,
  cpf_cnpj text not null unique,
  nome text not null,
  nome_fantasia text,
  nome_fantasia_mapa text,
  classificacao text,
  avaliacao smallint check (avaliacao between 0 and 5),
  inscricao_estadual text,
  inscricao_municipal text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf char(2),
  cep text,
  contato1_nome text,
  contato1_fone text,
  contato1_email text,
  contato2_nome text,
  contato2_fone text,
  contato2_email text,
  observacao text,
  banco_cnpj_favorecido text,
  banco_favorecido text,
  banco text,
  agencia text,
  conta text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Histórico de bloqueios. O bloqueio ativo é o que não tem data de desbloqueio.
create table public.fornecedor_bloqueios (
  id bigint generated always as identity primary key,
  fornecedor_id bigint not null references public.fornecedores (id) on delete cascade,
  justificativa text not null check (length(trim(justificativa)) > 0),
  bloqueado_por uuid references public.perfis (id) default auth.uid(),
  bloqueado_em timestamptz not null default now(),
  desbloqueado_por uuid references public.perfis (id),
  desbloqueado_em timestamptz
);

create unique index fornecedor_bloqueio_ativo
  on public.fornecedor_bloqueios (fornecedor_id) where desbloqueado_em is null;

-- ============================================================
-- Catálogo de itens/materiais (usado por Solicitações e Mapas)
-- ============================================================
create table public.itens (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  descricao text not null,
  unidade text not null default 'UN',
  valor_medio numeric(14, 2),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger t_clientes_upd before update on public.clientes for each row execute function public.set_atualizado_em();
create trigger t_obras_upd before update on public.obras for each row execute function public.set_atualizado_em();
create trigger t_fornecedores_upd before update on public.fornecedores for each row execute function public.set_atualizado_em();
create trigger t_itens_upd before update on public.itens for each row execute function public.set_atualizado_em();

-- Visão de fornecedores com o bloqueio ativo (se houver).
create view public.fornecedores_status with (security_invoker = true) as
  select f.*, b.id as bloqueio_id, b.justificativa as bloqueio_justificativa, b.bloqueado_em,
         p.nome as bloqueado_por_nome
  from public.fornecedores f
  left join public.fornecedor_bloqueios b on b.fornecedor_id = f.id and b.desbloqueado_em is null
  left join public.perfis p on p.id = b.bloqueado_por;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.perfis enable row level security;
alter table public.clientes enable row level security;
alter table public.obras enable row level security;
alter table public.fornecedores enable row level security;
alter table public.fornecedor_bloqueios enable row level security;
alter table public.itens enable row level security;

-- Perfis: todos os logados veem; cada um edita o próprio nome/celular; o admin edita todos.
create policy perfis_select on public.perfis for select to authenticated using (true);
create policy perfis_update_proprio on public.perfis for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and papel = public.meu_papel());
create policy perfis_update_admin on public.perfis for update to authenticated
  using (public.meu_papel() = 'admin');

-- Cadastros: leitura para qualquer usuário ativo; escrita para admin/financeiro/suprimentos;
-- exclusão só para admin.
do $$
declare t text;
begin
  foreach t in array array['clientes', 'obras', 'fornecedores', 'itens', 'fornecedor_bloqueios'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.meu_papel() is not null)', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.pode_editar_cadastros())', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.pode_editar_cadastros())', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.meu_papel() = ''admin'')', t);
  end loop;
end $$;

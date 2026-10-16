-- MPH Sistema — R1: a obra como controle financeiro por Centro de Custo.
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run.
--
-- Obra → Planilhas (modo verba = Fechado | guia = Administrado) → Centros de Custo.
-- Colunas do CC: An. Financeira | Orçamento | Fechamento | Alocado | Val Pago | Pago Guia | A Pagar | Meta
--   Fechamento = Σ apropriações de OCs/reembolsos   (alimentado na R2)
--   Val Pago   = Σ pagamentos rateados no CC        (alimentado na R3)
--   Pago Guia  = Σ pagamentos via guia de envio     (alimentado na R3)
--   A Pagar    = Fechamento − Val Pago
--   Meta       = Orçamento − Fechamento

-- ============================================================
-- Regime da obra: Administrado | Fechado | Completo
-- ============================================================
alter type public.regime_obra rename value 'empreitada' to 'fechado';
alter type public.regime_obra add value if not exists 'completo';

alter table public.obras
  add column if not exists diretor text,
  add column if not exists coordenador text,
  add column if not exists validade_seguro date,
  add column if not exists ultimo_envio_relatorio date;

-- ============================================================
-- Planilhas de orçamento da obra
-- ============================================================
create type public.modo_planilha as enum ('verba', 'guia');

create table public.planilhas (
  id bigint generated always as identity primary key,
  obra_id bigint not null references public.obras (id) on delete cascade,
  seq int not null,
  nome text not null,
  modo public.modo_planilha not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (obra_id, seq)
);

-- Níveis: T0 item principal (com imposto), T0-I item principal (sem imposto), T1 sub-item,
-- CC centro de custo, ADM0/ADM administração, I0/I impostos.
create table public.centros_custo (
  id bigint generated always as identity primary key,
  planilha_id bigint not null references public.planilhas (id) on delete cascade,
  obra_id bigint not null references public.obras (id) on delete cascade,
  codigo text not null,
  descricao text not null default '',
  nivel text not null check (nivel in ('T0', 'T0-I', 'T1', 'CC', 'ADM0', 'ADM', 'I0', 'I')),
  ordem int not null default 0,
  an_financeira numeric(14, 2) not null default 0,
  orcamento numeric(14, 2) not null default 0,
  verba_alocada numeric(14, 2) not null default 0,
  criado_em timestamptz not null default now(),
  unique (planilha_id, codigo)
);
create index on public.centros_custo (obra_id);

create table public.planilha_percentuais (
  id bigint generated always as identity primary key,
  planilha_id bigint not null references public.planilhas (id) on delete cascade,
  tipo text not null check (tipo in ('adm', 'imp')),
  descricao text not null,
  valor numeric(6, 2) not null check (valor >= 0)
);

-- Pagamentos do cliente à MPH, por planilha. Na planilha "verba" formam a verba alocada.
create table public.pagamentos_cliente (
  id bigint generated always as identity primary key,
  obra_id bigint not null references public.obras (id) on delete cascade,
  planilha_id bigint not null references public.planilhas (id) on delete cascade,
  data date not null,
  valor numeric(14, 2) not null,
  data_previsao date,
  data_efetivacao date,
  realizado boolean,
  descricao text not null,
  lancado_por uuid references public.perfis (id) default auth.uid(),
  criado_em timestamptz not null default now()
);
create index on public.pagamentos_cliente (planilha_id);

-- Responsáveis da obra (o engenheiro tem limite de aprovação de OC).
create table public.obra_responsaveis (
  id bigint generated always as identity primary key,
  obra_id bigint not null references public.obras (id) on delete cascade,
  perfil_id uuid not null references public.perfis (id) on delete cascade,
  tipo text not null check (tipo in ('engenheiro', 'coordenador', 'suprimentos')),
  limite_aprovacao_oc numeric(14, 2),
  qtd_aprovacao_oc int,
  unique (obra_id, perfil_id, tipo)
);

-- Outros clientes ligados à obra.
create table public.obra_filiais (
  obra_id bigint not null references public.obras (id) on delete cascade,
  cliente_id bigint not null references public.clientes (id) on delete cascade,
  primary key (obra_id, cliente_id)
);

-- Apropriações (valor de cada documento em cada CC). Preenchidas a partir da R2.
create table public.apropriacoes (
  id bigint generated always as identity primary key,
  cc_id bigint not null references public.centros_custo (id) on delete restrict,
  origem text not null check (origem in ('solicitacao_item', 'mapa_item', 'oc', 'reembolso')),
  origem_id bigint not null,
  valor numeric(14, 2) not null default 0,
  criado_por uuid references public.perfis (id) default auth.uid(),
  criado_em timestamptz not null default now()
);
create index on public.apropriacoes (cc_id);
create index on public.apropriacoes (origem, origem_id);

-- Pagamentos rateados por CC (nota paga pela MPH ou lançamento pago via guia). Preenchidos a partir da R3.
create table public.pagamentos_cc (
  id bigint generated always as identity primary key,
  cc_id bigint not null references public.centros_custo (id) on delete restrict,
  modo text not null check (modo in ('pago', 'guia')),
  origem text not null,
  origem_id bigint not null,
  valor numeric(14, 2) not null,
  data date,
  criado_em timestamptz not null default now()
);
create index on public.pagamentos_cc (cc_id);

-- ============================================================
-- Visões calculadas
-- ============================================================
create view public.centros_custo_saldos with (security_invoker = true) as
  select cc.*,
         p.nome as planilha_nome, p.modo as planilha_modo, p.seq as planilha_seq,
         coalesce(a.fechamento, 0) as fechamento,
         coalesce(pg.val_pago, 0) as val_pago,
         coalesce(pg.pago_guia, 0) as pago_guia,
         coalesce(a.fechamento, 0) - coalesce(pg.val_pago, 0) as a_pagar,
         cc.orcamento - coalesce(a.fechamento, 0) as meta
  from public.centros_custo cc
  join public.planilhas p on p.id = cc.planilha_id
  left join (select cc_id, sum(valor) as fechamento from public.apropriacoes
             where origem in ('oc', 'reembolso') group by cc_id) a on a.cc_id = cc.id
  left join (select cc_id,
                    sum(valor) filter (where modo = 'pago') as val_pago,
                    sum(valor) filter (where modo = 'guia') as pago_guia
             from public.pagamentos_cc group by cc_id) pg on pg.cc_id = cc.id;

create view public.planilhas_resumo with (security_invoker = true) as
  select p.*,
         coalesce((select sum(valor) from public.pagamentos_cliente pc where pc.planilha_id = p.id), 0) as verba_alocada,
         coalesce((select sum(verba_alocada) from public.centros_custo c where c.planilha_id = p.id and c.nivel not in ('T0', 'T0-I', 'T1', 'ADM0', 'I0')), 0) as alocado_ccs,
         coalesce((select sum(valor) from public.planilha_percentuais x where x.planilha_id = p.id and x.tipo = 'adm'), 0) as taxa_adm,
         coalesce((select sum(valor) from public.planilha_percentuais x where x.planilha_id = p.id and x.tipo = 'imp'), 0) as taxa_imp
  from public.planilhas p;

-- ============================================================
-- Funções
-- ============================================================

-- Importa uma planilha de orçamento. p_linhas: [{codigo, descricao, an_financeira, orcamento, nivel?}]
-- O nível é deduzido do código quando não informado: "00" → T0, "00.01" → T1, "00.01.01" → CC.
create function public.importar_planilha(p_obra_id bigint, p_nome text, p_modo public.modo_planilha, p_linhas jsonb) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare v_id bigint; v_seq int;
begin
  if not public.pode_editar_cadastros() then raise exception 'Seu perfil não pode montar planilhas de obra.' using errcode = '42501'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o nome da planilha.'; end if;
  if jsonb_array_length(coalesce(p_linhas, '[]')) = 0 then raise exception 'A planilha não tem linhas.'; end if;

  select coalesce(max(seq), 0) + 1 into v_seq from public.planilhas where obra_id = p_obra_id;
  insert into public.planilhas (obra_id, seq, nome, modo) values (p_obra_id, v_seq, trim(p_nome), p_modo) returning id into v_id;

  insert into public.centros_custo (planilha_id, obra_id, codigo, descricao, nivel, ordem, an_financeira, orcamento)
  select v_id, p_obra_id, trim(l ->> 'codigo'), coalesce(trim(l ->> 'descricao'), ''),
         coalesce(nullif(l ->> 'nivel', ''),
                  case array_length(string_to_array(trim(l ->> 'codigo'), '.'), 1) when 1 then 'T0' when 2 then 'T1' else 'CC' end),
         ord, coalesce((l ->> 'an_financeira')::numeric, 0), coalesce((l ->> 'orcamento')::numeric, 0)
  from jsonb_array_elements(p_linhas) with ordinality as t(l, ord)
  where coalesce(trim(l ->> 'codigo'), '') <> '';
  return v_id;
end $$;

-- Grava a verba alocada por CC de uma planilha "verba", validando que não passa da verba da planilha.
create function public.salvar_alocacao(p_planilha_id bigint, p_alocacoes jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_modo public.modo_planilha; v_verba numeric; v_total numeric;
begin
  if not public.pode_pagar() then raise exception 'Só o financeiro aloca verba.' using errcode = '42501'; end if;
  select modo into v_modo from public.planilhas where id = p_planilha_id;
  if v_modo is distinct from 'verba' then raise exception 'Só planilhas de obra fechada têm verba alocada.'; end if;

  update public.centros_custo c set verba_alocada = coalesce((a ->> 'valor')::numeric, 0)
  from jsonb_array_elements(p_alocacoes) a
  where c.planilha_id = p_planilha_id and c.id = (a ->> 'cc_id')::bigint;

  select verba_alocada, alocado_ccs into v_verba, v_total from public.planilhas_resumo where id = p_planilha_id;
  if v_total > v_verba + 0.005 then
    raise exception 'A soma alocada nos CCs (R$ %) passa da verba da planilha (R$ %).',
      to_char(v_total, 'FM999G999G990D00'), to_char(v_verba, 'FM999G999G990D00');
  end if;
end $$;

-- ============================================================
-- Row Level Security
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['planilhas', 'centros_custo', 'planilha_percentuais', 'pagamentos_cliente',
                           'obra_responsaveis', 'obra_filiais', 'apropriacoes', 'pagamentos_cc'] loop
    execute format('alter table public.%1$s enable row level security', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.usuario_ativo())', t);
  end loop;
end $$;

-- Estrutura (planilhas, CCs, percentuais, filiais): quem edita cadastros.
do $$
declare t text;
begin
  foreach t in array array['planilhas', 'centros_custo', 'planilha_percentuais', 'obra_filiais'] loop
    execute format('create policy %1$s_write on public.%1$s for all to authenticated using (public.pode_editar_cadastros()) with check (public.pode_editar_cadastros())', t);
  end loop;
end $$;

-- Dinheiro do cliente e alocação: financeiro (a alocação passa pela função salvar_alocacao).
create policy pagamentos_cliente_write on public.pagamentos_cliente for all to authenticated
  using (public.pode_pagar()) with check (public.pode_pagar());
create policy centros_custo_alocacao on public.centros_custo for update to authenticated
  using (public.pode_pagar()) with check (public.pode_pagar());

-- Responsáveis: só admin.
create policy obra_responsaveis_write on public.obra_responsaveis for all to authenticated
  using (public.meu_papel() = 'admin') with check (public.meu_papel() = 'admin');

-- Apropriações e pagamentos por CC: gravados pelas funções de compras/notas (R2/R3).
create policy apropriacoes_write on public.apropriacoes for all to authenticated
  using (public.usuario_ativo()) with check (public.usuario_ativo());
create policy pagamentos_cc_write on public.pagamentos_cc for all to authenticated
  using (public.pode_pagar()) with check (public.pode_pagar());

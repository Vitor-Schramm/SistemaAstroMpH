-- MPH Sistema — fase 2: Solicitações, Mapas de cotação, Ordens de Compra e Aprovação de OC.
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run.

-- ============================================================
-- Permissões
-- ============================================================
create function public.usuario_ativo() returns boolean
language sql stable as $$ select public.meu_papel() is not null $$;

-- Quem conduz cotações e ordens de compra.
create function public.pode_comprar() returns boolean
language sql stable as $$ select coalesce(public.meu_papel() in ('admin', 'suprimentos'), false) $$;

-- ============================================================
-- Solicitações de compra
-- ============================================================
create type public.status_solicitacao as enum ('pendente', 'em_cotacao', 'atendida', 'cancelada');

create table public.solicitacoes (
  id bigint generated always as identity primary key,
  obra_id bigint not null references public.obras (id),
  servico text not null,
  observacao text,
  status public.status_solicitacao not null default 'pendente',
  solicitante_id uuid references public.perfis (id) default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.solicitacao_itens (
  id bigint generated always as identity primary key,
  solicitacao_id bigint not null references public.solicitacoes (id) on delete cascade,
  ordem int not null default 0,
  titulo text,
  item_id bigint references public.itens (id),
  codigo text,
  descricao text not null,
  quantidade numeric(14, 3) not null check (quantidade > 0),
  unidade text not null default 'UN',
  valor_medio numeric(14, 2)
);
create index on public.solicitacao_itens (solicitacao_id);

-- ============================================================
-- Mapas de cotação
-- ============================================================
create type public.status_mapa as enum ('aberto', 'finalizado', 'cancelado');
create type public.tipo_servico_mapa as enum ('compra', 'locacao', 'servico');

create table public.mapas (
  id bigint generated always as identity primary key,
  obra_id bigint not null references public.obras (id),
  solicitacao_id bigint references public.solicitacoes (id),
  servico text not null,
  apropriacao text,
  tipo public.tipo_servico_mapa not null default 'compra',
  data_entrega date,
  prazo_locacao text,
  data_devolucao date,
  observacao text,
  status public.status_mapa not null default 'aberto',
  criado_por uuid references public.perfis (id) default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.mapa_itens (
  id bigint generated always as identity primary key,
  mapa_id bigint not null references public.mapas (id) on delete cascade,
  ordem int not null default 0,
  titulo text,
  item_id bigint references public.itens (id),
  codigo text,
  descricao text not null,
  quantidade numeric(14, 3) not null check (quantidade > 0),
  unidade text not null default 'UN',
  valor_medio numeric(14, 2),
  fornecedor_vencedor_id bigint references public.fornecedores (id)
);
create index on public.mapa_itens (mapa_id);

-- Fornecedores participantes da cotação, com as condições comerciais.
create table public.mapa_fornecedores (
  id bigint generated always as identity primary key,
  mapa_id bigint not null references public.mapas (id) on delete cascade,
  fornecedor_id bigint not null references public.fornecedores (id),
  condicao_pagamento text,
  prazo_entrega text,
  frete numeric(14, 2) not null default 0,
  observacao text,
  unique (mapa_id, fornecedor_id)
);

-- Preço unitário de cada fornecedor para cada item do mapa.
create table public.mapa_precos (
  mapa_item_id bigint not null references public.mapa_itens (id) on delete cascade,
  fornecedor_id bigint not null references public.fornecedores (id),
  valor_unitario numeric(14, 2) not null check (valor_unitario >= 0),
  primary key (mapa_item_id, fornecedor_id)
);

-- ============================================================
-- Ordens de compra
-- ============================================================
create type public.status_oc as enum ('rascunho', 'aguardando_aprovacao', 'aprovada', 'reprovada', 'cancelada');

create table public.ordens_compra (
  id bigint generated always as identity primary key,
  obra_id bigint not null references public.obras (id),
  fornecedor_id bigint not null references public.fornecedores (id),
  mapa_id bigint references public.mapas (id),
  engenheiro_responsavel text,
  data_emissao date not null default current_date,
  data_entrega date,
  condicao_pagamento text,
  prazo_entrega text,
  frete numeric(14, 2) not null default 0,
  observacao text,
  status public.status_oc not null default 'rascunho',
  criado_por uuid references public.perfis (id) default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on public.ordens_compra (status);

create table public.oc_itens (
  id bigint generated always as identity primary key,
  ordem_compra_id bigint not null references public.ordens_compra (id) on delete cascade,
  ordem int not null default 0,
  item_id bigint references public.itens (id),
  codigo text,
  descricao text not null,
  quantidade numeric(14, 3) not null check (quantidade > 0),
  unidade text not null default 'UN',
  valor_unitario numeric(14, 2) not null default 0 check (valor_unitario >= 0)
);
create index on public.oc_itens (ordem_compra_id);

-- Uma decisão por OC e por papel aprovador (engenharia e financeiro).
create table public.oc_aprovacoes (
  id bigint generated always as identity primary key,
  ordem_compra_id bigint not null references public.ordens_compra (id) on delete cascade,
  papel public.papel not null check (papel in ('engenharia', 'financeiro')),
  aprovado boolean not null,
  justificativa text,
  usuario_id uuid references public.perfis (id) default auth.uid(),
  decidido_em timestamptz not null default now(),
  unique (ordem_compra_id, papel)
);

create trigger t_solicitacoes_upd before update on public.solicitacoes for each row execute function public.set_atualizado_em();
create trigger t_mapas_upd before update on public.mapas for each row execute function public.set_atualizado_em();
create trigger t_ordens_compra_upd before update on public.ordens_compra for each row execute function public.set_atualizado_em();

-- Totais e situação de bloqueio do fornecedor, para listagens.
create view public.ordens_compra_resumo with (security_invoker = true) as
  select oc.*,
         o.codigo as obra_codigo, o.nome as obra_nome, c.nome as cliente_nome,
         f.nome as fornecedor_nome, f.cpf_cnpj as fornecedor_cnpj,
         coalesce((select sum(i.quantidade * i.valor_unitario) from public.oc_itens i where i.ordem_compra_id = oc.id), 0) + oc.frete as valor_total,
         exists (select 1 from public.fornecedor_bloqueios b where b.fornecedor_id = oc.fornecedor_id and b.desbloqueado_em is null) as fornecedor_bloqueado,
         (select a.aprovado from public.oc_aprovacoes a where a.ordem_compra_id = oc.id and a.papel = 'engenharia') as aprovado_engenharia,
         (select a.aprovado from public.oc_aprovacoes a where a.ordem_compra_id = oc.id and a.papel = 'financeiro') as aprovado_financeiro
  from public.ordens_compra oc
  join public.obras o on o.id = oc.obra_id
  left join public.clientes c on c.id = o.cliente_id
  join public.fornecedores f on f.id = oc.fornecedor_id;

-- ============================================================
-- Funções de negócio (gravação atômica de cabeçalho + itens)
-- ============================================================

-- Salva uma solicitação com seus itens. p_id nulo cria uma nova. Retorna o id.
create function public.salvar_solicitacao(p_id bigint, p_dados jsonb, p_itens jsonb) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare v_id bigint;
begin
  if not public.usuario_ativo() then raise exception 'Usuário sem acesso.' using errcode = '42501'; end if;
  if jsonb_array_length(coalesce(p_itens, '[]')) = 0 then raise exception 'Inclua ao menos um item.'; end if;

  if p_id is null then
    insert into public.solicitacoes (obra_id, servico, observacao)
    values ((p_dados ->> 'obra_id')::bigint, p_dados ->> 'servico', nullif(p_dados ->> 'observacao', ''))
    returning id into v_id;
  else
    update public.solicitacoes
       set obra_id = (p_dados ->> 'obra_id')::bigint, servico = p_dados ->> 'servico',
           observacao = nullif(p_dados ->> 'observacao', '')
     where id = p_id and status = 'pendente'
    returning id into v_id;
    if v_id is null then raise exception 'Só solicitações pendentes podem ser editadas.'; end if;
    delete from public.solicitacao_itens where solicitacao_id = v_id;
  end if;

  insert into public.solicitacao_itens (solicitacao_id, ordem, titulo, item_id, codigo, descricao, quantidade, unidade, valor_medio)
  select v_id, ord, nullif(i ->> 'titulo', ''), (i ->> 'item_id')::bigint, nullif(i ->> 'codigo', ''), i ->> 'descricao',
         (i ->> 'quantidade')::numeric, coalesce(nullif(i ->> 'unidade', ''), 'UN'), (i ->> 'valor_medio')::numeric
  from jsonb_array_elements(p_itens) with ordinality as t(i, ord);

  return v_id;
end $$;

-- Salva o cabeçalho e os itens de um mapa. Itens com "id" são preservados (e seus preços);
-- os que sumiram da lista são removidos.
create function public.salvar_mapa(p_id bigint, p_dados jsonb, p_itens jsonb) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare v_id bigint; v_sol bigint := (p_dados ->> 'solicitacao_id')::bigint;
begin
  if not public.pode_comprar() then raise exception 'Seu perfil não pode montar mapas de cotação.' using errcode = '42501'; end if;
  if jsonb_array_length(coalesce(p_itens, '[]')) = 0 then raise exception 'Inclua ao menos um item.'; end if;

  if p_id is null then
    insert into public.mapas (obra_id, solicitacao_id, servico, apropriacao, tipo, data_entrega, prazo_locacao, data_devolucao, observacao)
    values ((p_dados ->> 'obra_id')::bigint, v_sol, p_dados ->> 'servico', nullif(p_dados ->> 'apropriacao', ''),
            coalesce(nullif(p_dados ->> 'tipo', ''), 'compra')::public.tipo_servico_mapa,
            nullif(p_dados ->> 'data_entrega', '')::date, nullif(p_dados ->> 'prazo_locacao', ''),
            nullif(p_dados ->> 'data_devolucao', '')::date, nullif(p_dados ->> 'observacao', ''))
    returning id into v_id;
    if v_sol is not null then
      update public.solicitacoes set status = 'em_cotacao' where id = v_sol and status = 'pendente';
    end if;
  else
    update public.mapas
       set obra_id = (p_dados ->> 'obra_id')::bigint, servico = p_dados ->> 'servico',
           apropriacao = nullif(p_dados ->> 'apropriacao', ''),
           tipo = coalesce(nullif(p_dados ->> 'tipo', ''), 'compra')::public.tipo_servico_mapa,
           data_entrega = nullif(p_dados ->> 'data_entrega', '')::date, prazo_locacao = nullif(p_dados ->> 'prazo_locacao', ''),
           data_devolucao = nullif(p_dados ->> 'data_devolucao', '')::date, observacao = nullif(p_dados ->> 'observacao', '')
     where id = p_id and status = 'aberto'
    returning id into v_id;
    if v_id is null then raise exception 'Só mapas abertos podem ser editados.'; end if;

    delete from public.mapa_itens
     where mapa_id = v_id
       and id not in (select (i ->> 'id')::bigint from jsonb_array_elements(p_itens) i where i ? 'id' and i ->> 'id' <> '');

    update public.mapa_itens mi
       set ordem = t.ord, titulo = nullif(t.i ->> 'titulo', ''), item_id = (t.i ->> 'item_id')::bigint,
           codigo = nullif(t.i ->> 'codigo', ''), descricao = t.i ->> 'descricao', quantidade = (t.i ->> 'quantidade')::numeric,
           unidade = coalesce(nullif(t.i ->> 'unidade', ''), 'UN'), valor_medio = (t.i ->> 'valor_medio')::numeric
      from jsonb_array_elements(p_itens) with ordinality as t(i, ord)
     where mi.mapa_id = v_id and t.i ->> 'id' <> '' and mi.id = (t.i ->> 'id')::bigint;
  end if;

  insert into public.mapa_itens (mapa_id, ordem, titulo, item_id, codigo, descricao, quantidade, unidade, valor_medio)
  select v_id, ord, nullif(i ->> 'titulo', ''), (i ->> 'item_id')::bigint, nullif(i ->> 'codigo', ''), i ->> 'descricao',
         (i ->> 'quantidade')::numeric, coalesce(nullif(i ->> 'unidade', ''), 'UN'), (i ->> 'valor_medio')::numeric
  from jsonb_array_elements(p_itens) with ordinality as t(i, ord)
  where coalesce(i ->> 'id', '') = '';

  return v_id;
end $$;

-- Grava a cotação: fornecedores participantes, preços e vencedores por item.
-- p_fornecedores: [{fornecedor_id, condicao_pagamento, prazo_entrega, frete, observacao}]
-- p_precos: [{mapa_item_id, fornecedor_id, valor_unitario}]
-- p_vencedores: [{mapa_item_id, fornecedor_id}]
create function public.salvar_cotacao(p_mapa_id bigint, p_fornecedores jsonb, p_precos jsonb, p_vencedores jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.pode_comprar() then raise exception 'Seu perfil não pode cotar.' using errcode = '42501'; end if;
  if not exists (select 1 from public.mapas where id = p_mapa_id and status = 'aberto') then
    raise exception 'Só mapas abertos podem ser cotados.';
  end if;

  delete from public.mapa_precos p using public.mapa_itens mi where mi.id = p.mapa_item_id and mi.mapa_id = p_mapa_id;
  delete from public.mapa_fornecedores where mapa_id = p_mapa_id;
  update public.mapa_itens set fornecedor_vencedor_id = null where mapa_id = p_mapa_id;

  insert into public.mapa_fornecedores (mapa_id, fornecedor_id, condicao_pagamento, prazo_entrega, frete, observacao)
  select p_mapa_id, (f ->> 'fornecedor_id')::bigint, nullif(f ->> 'condicao_pagamento', ''), nullif(f ->> 'prazo_entrega', ''),
         coalesce((f ->> 'frete')::numeric, 0), nullif(f ->> 'observacao', '')
  from jsonb_array_elements(coalesce(p_fornecedores, '[]')) f;

  insert into public.mapa_precos (mapa_item_id, fornecedor_id, valor_unitario)
  select (p ->> 'mapa_item_id')::bigint, (p ->> 'fornecedor_id')::bigint, (p ->> 'valor_unitario')::numeric
  from jsonb_array_elements(coalesce(p_precos, '[]')) p
  join public.mapa_itens mi on mi.id = (p ->> 'mapa_item_id')::bigint and mi.mapa_id = p_mapa_id
  where p ->> 'valor_unitario' is not null and p ->> 'valor_unitario' <> '';

  update public.mapa_itens mi set fornecedor_vencedor_id = (v ->> 'fornecedor_id')::bigint
  from jsonb_array_elements(coalesce(p_vencedores, '[]')) v
  where mi.mapa_id = p_mapa_id and mi.id = (v ->> 'mapa_item_id')::bigint
    and exists (select 1 from public.mapa_precos p where p.mapa_item_id = mi.id and p.fornecedor_id = (v ->> 'fornecedor_id')::bigint);
end $$;

-- Gera uma OC (em rascunho) por fornecedor vencedor e finaliza o mapa. Retorna os ids das OCs.
create function public.gerar_ocs_do_mapa(p_mapa_id bigint) returns bigint[]
language plpgsql security invoker set search_path = '' as $$
declare
  v_mapa public.mapas;
  v_forn record;
  v_oc bigint;
  v_ids bigint[] := '{}';
begin
  if not public.pode_comprar() then raise exception 'Seu perfil não pode gerar ordens de compra.' using errcode = '42501'; end if;
  select * into v_mapa from public.mapas where id = p_mapa_id for update;
  if v_mapa.id is null or v_mapa.status <> 'aberto' then raise exception 'Mapa não está aberto.'; end if;
  if exists (select 1 from public.mapa_itens where mapa_id = p_mapa_id and fornecedor_vencedor_id is null) then
    raise exception 'Defina o fornecedor vencedor de todos os itens antes de gerar as OCs.';
  end if;
  if exists (select 1 from public.mapa_itens mi join public.fornecedor_bloqueios b
               on b.fornecedor_id = mi.fornecedor_vencedor_id and b.desbloqueado_em is null
             where mi.mapa_id = p_mapa_id) then
    raise exception 'Há fornecedor vencedor bloqueado. Troque o vencedor ou desbloqueie o fornecedor.';
  end if;

  for v_forn in
    select distinct mi.fornecedor_vencedor_id as fornecedor_id, mf.condicao_pagamento, mf.prazo_entrega, coalesce(mf.frete, 0) as frete
    from public.mapa_itens mi
    left join public.mapa_fornecedores mf on mf.mapa_id = mi.mapa_id and mf.fornecedor_id = mi.fornecedor_vencedor_id
    where mi.mapa_id = p_mapa_id
  loop
    insert into public.ordens_compra (obra_id, fornecedor_id, mapa_id, data_entrega, condicao_pagamento, prazo_entrega, frete, observacao)
    values (v_mapa.obra_id, v_forn.fornecedor_id, p_mapa_id, v_mapa.data_entrega, v_forn.condicao_pagamento, v_forn.prazo_entrega,
            v_forn.frete, v_mapa.servico)
    returning id into v_oc;

    insert into public.oc_itens (ordem_compra_id, ordem, item_id, codigo, descricao, quantidade, unidade, valor_unitario)
    select v_oc, mi.ordem, mi.item_id, mi.codigo, mi.descricao, mi.quantidade, mi.unidade, p.valor_unitario
    from public.mapa_itens mi
    join public.mapa_precos p on p.mapa_item_id = mi.id and p.fornecedor_id = mi.fornecedor_vencedor_id
    where mi.mapa_id = p_mapa_id and mi.fornecedor_vencedor_id = v_forn.fornecedor_id;

    v_ids := v_ids || v_oc;
  end loop;

  update public.mapas set status = 'finalizado' where id = p_mapa_id;
  if v_mapa.solicitacao_id is not null then
    update public.solicitacoes set status = 'atendida' where id = v_mapa.solicitacao_id;
  end if;
  return v_ids;
end $$;

-- Salva uma OC manual (ou edita um rascunho/reprovada). Volta para rascunho e limpa aprovações.
create function public.salvar_oc(p_id bigint, p_dados jsonb, p_itens jsonb) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare v_id bigint;
begin
  if not public.pode_comprar() then raise exception 'Seu perfil não pode editar ordens de compra.' using errcode = '42501'; end if;
  if jsonb_array_length(coalesce(p_itens, '[]')) = 0 then raise exception 'Inclua ao menos um item.'; end if;

  if p_id is null then
    insert into public.ordens_compra (obra_id, fornecedor_id, engenheiro_responsavel, data_emissao, data_entrega,
                                      condicao_pagamento, prazo_entrega, frete, observacao)
    values ((p_dados ->> 'obra_id')::bigint, (p_dados ->> 'fornecedor_id')::bigint, nullif(p_dados ->> 'engenheiro_responsavel', ''),
            coalesce(nullif(p_dados ->> 'data_emissao', '')::date, current_date), nullif(p_dados ->> 'data_entrega', '')::date,
            nullif(p_dados ->> 'condicao_pagamento', ''), nullif(p_dados ->> 'prazo_entrega', ''),
            coalesce(nullif(p_dados ->> 'frete', '')::numeric, 0), nullif(p_dados ->> 'observacao', ''))
    returning id into v_id;
  else
    update public.ordens_compra
       set obra_id = (p_dados ->> 'obra_id')::bigint, fornecedor_id = (p_dados ->> 'fornecedor_id')::bigint,
           engenheiro_responsavel = nullif(p_dados ->> 'engenheiro_responsavel', ''),
           data_emissao = coalesce(nullif(p_dados ->> 'data_emissao', '')::date, data_emissao),
           data_entrega = nullif(p_dados ->> 'data_entrega', '')::date,
           condicao_pagamento = nullif(p_dados ->> 'condicao_pagamento', ''), prazo_entrega = nullif(p_dados ->> 'prazo_entrega', ''),
           frete = coalesce(nullif(p_dados ->> 'frete', '')::numeric, 0), observacao = nullif(p_dados ->> 'observacao', ''),
           status = 'rascunho'
     where id = p_id and status in ('rascunho', 'reprovada')
    returning id into v_id;
    if v_id is null then raise exception 'Só OCs em rascunho ou reprovadas podem ser editadas.'; end if;
    delete from public.oc_itens where ordem_compra_id = v_id;
    delete from public.oc_aprovacoes where ordem_compra_id = v_id;
  end if;

  insert into public.oc_itens (ordem_compra_id, ordem, item_id, codigo, descricao, quantidade, unidade, valor_unitario)
  select v_id, ord, (i ->> 'item_id')::bigint, nullif(i ->> 'codigo', ''), i ->> 'descricao', (i ->> 'quantidade')::numeric,
         coalesce(nullif(i ->> 'unidade', ''), 'UN'), coalesce((i ->> 'valor_unitario')::numeric, 0)
  from jsonb_array_elements(p_itens) with ordinality as t(i, ord);

  return v_id;
end $$;

-- Envia a OC para aprovação (bloqueia se o fornecedor estiver bloqueado).
create function public.enviar_oc_aprovacao(p_id bigint) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.pode_comprar() then raise exception 'Seu perfil não pode enviar OCs.' using errcode = '42501'; end if;
  if exists (select 1 from public.ordens_compra oc join public.fornecedor_bloqueios b
               on b.fornecedor_id = oc.fornecedor_id and b.desbloqueado_em is null where oc.id = p_id) then
    raise exception 'O fornecedor desta OC está bloqueado.';
  end if;
  update public.ordens_compra set status = 'aguardando_aprovacao' where id = p_id and status in ('rascunho', 'reprovada');
  if not found then raise exception 'A OC precisa estar em rascunho ou reprovada.'; end if;
  delete from public.oc_aprovacoes where ordem_compra_id = p_id;
end $$;

create function public.cancelar_oc(p_id bigint) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.pode_comprar() then raise exception 'Seu perfil não pode cancelar OCs.' using errcode = '42501'; end if;
  update public.ordens_compra set status = 'cancelada' where id = p_id and status <> 'cancelada';
end $$;

-- Registra a decisão de um aprovador. Admin escolhe o papel; os demais decidem pelo próprio papel.
-- A OC fica aprovada quando engenharia E financeiro aprovam; reprovada se qualquer um reprovar.
create function public.decidir_oc(p_id bigint, p_aprovado boolean, p_justificativa text, p_papel public.papel default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_meu public.papel := public.meu_papel();
  v_papel public.papel;
begin
  if v_meu is null then raise exception 'Usuário sem acesso.' using errcode = '42501'; end if;
  v_papel := case when v_meu = 'admin' then coalesce(p_papel, 'engenharia') else v_meu end;
  if v_papel not in ('engenharia', 'financeiro') then
    raise exception 'Seu perfil não aprova ordens de compra.' using errcode = '42501';
  end if;
  if not p_aprovado and coalesce(trim(p_justificativa), '') = '' then
    raise exception 'Informe a justificativa da reprovação.';
  end if;
  if not exists (select 1 from public.ordens_compra where id = p_id and status = 'aguardando_aprovacao') then
    raise exception 'Esta OC não está aguardando aprovação.';
  end if;

  insert into public.oc_aprovacoes (ordem_compra_id, papel, aprovado, justificativa, usuario_id)
  values (p_id, v_papel, p_aprovado, nullif(trim(p_justificativa), ''), auth.uid())
  on conflict (ordem_compra_id, papel) do update
    set aprovado = excluded.aprovado, justificativa = excluded.justificativa,
        usuario_id = excluded.usuario_id, decidido_em = now();

  if not p_aprovado then
    update public.ordens_compra set status = 'reprovada' where id = p_id;
  elsif (select count(*) from public.oc_aprovacoes where ordem_compra_id = p_id and aprovado) = 2 then
    update public.ordens_compra set status = 'aprovada' where id = p_id;
  end if;
end $$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.solicitacoes enable row level security;
alter table public.solicitacao_itens enable row level security;
alter table public.mapas enable row level security;
alter table public.mapa_itens enable row level security;
alter table public.mapa_fornecedores enable row level security;
alter table public.mapa_precos enable row level security;
alter table public.ordens_compra enable row level security;
alter table public.oc_itens enable row level security;
alter table public.oc_aprovacoes enable row level security;

-- Leitura: qualquer usuário ativo.
do $$
declare t text;
begin
  foreach t in array array['solicitacoes', 'solicitacao_itens', 'mapas', 'mapa_itens', 'mapa_fornecedores',
                           'mapa_precos', 'ordens_compra', 'oc_itens', 'oc_aprovacoes'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.usuario_ativo())', t);
  end loop;
end $$;

-- Solicitações: qualquer usuário ativo cria; edita/cancela o autor (enquanto pendente) ou compras.
create policy solicitacoes_insert on public.solicitacoes for insert to authenticated with check (public.usuario_ativo());
create policy solicitacoes_update on public.solicitacoes for update to authenticated
  using (public.pode_comprar() or (solicitante_id = auth.uid() and status = 'pendente'));
create policy solicitacao_itens_write on public.solicitacao_itens for all to authenticated
  using (exists (select 1 from public.solicitacoes s where s.id = solicitacao_id
                 and (public.pode_comprar() or (s.solicitante_id = auth.uid() and s.status = 'pendente'))))
  with check (exists (select 1 from public.solicitacoes s where s.id = solicitacao_id
                 and (public.pode_comprar() or (s.solicitante_id = auth.uid() and s.status = 'pendente'))));

-- Mapas e OCs: só compras (admin/suprimentos) escreve.
do $$
declare t text;
begin
  foreach t in array array['mapas', 'mapa_itens', 'mapa_fornecedores', 'mapa_precos', 'ordens_compra', 'oc_itens'] loop
    execute format('create policy %1$s_write on public.%1$s for all to authenticated using (public.pode_comprar()) with check (public.pode_comprar())', t);
  end loop;
end $$;

-- Aprovações: gravadas só pela função decidir_oc (security definer); limpeza pelas funções de compras.
create policy oc_aprovacoes_delete on public.oc_aprovacoes for delete to authenticated using (public.pode_comprar());

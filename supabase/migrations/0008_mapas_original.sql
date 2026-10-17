-- MPH Sistema — Mapas de cotação como no AstroTools.
-- Digitação → (Efetivar Mapa) → Cotação → (Finalizar Cotação Suprimentos) → Finalizado.
-- Fornecedores do mapa, grade de cotação (preço unitário, frete, impostos, desconto, condição de
-- pagamento, prazo, observações), Gerar Pedido / Pedido Parcial por fornecedor, apropriação dos itens,
-- Regularização Engenharia, arquivos e importação de itens.
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run (depois da 0007).

alter table public.mapas add column if not exists regularizacao_engenharia boolean not null default false;
alter table public.mapa_fornecedores add column if not exists impostos numeric(14, 2) not null default 0;
alter table public.mapa_fornecedores add column if not exists desconto numeric(14, 2) not null default 0;

alter table public.ordens_compra add column if not exists impostos numeric(14, 2) not null default 0;
alter table public.ordens_compra add column if not exists desconto numeric(14, 2) not null default 0;
alter table public.oc_itens add column if not exists mapa_item_id bigint references public.mapa_itens (id) on delete set null;
create index if not exists oc_itens_mapa_item on public.oc_itens (mapa_item_id);

create table if not exists public.mapa_arquivos (
  id bigint generated always as identity primary key,
  mapa_id bigint not null references public.mapas (id) on delete cascade,
  caminho text not null,
  nome text not null,
  tamanho bigint,
  enviado_por uuid references public.perfis (id) default auth.uid(),
  enviado_em timestamptz not null default now()
);
alter table public.mapa_arquivos enable row level security;
create policy mapa_arquivos_select on public.mapa_arquivos for select to authenticated using (public.usuario_ativo());
create policy mapa_arquivos_write on public.mapa_arquivos for all to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());

insert into storage.buckets (id, name, public, file_size_limit)
values ('mapa-arquivos', 'mapa-arquivos', false, 20971520)
on conflict (id) do nothing;
create policy mapa_arquivos_ler on storage.objects for select to authenticated using (bucket_id = 'mapa-arquivos' and public.usuario_ativo());
create policy mapa_arquivos_enviar on storage.objects for insert to authenticated with check (bucket_id = 'mapa-arquivos' and public.usuario_ativo());
create policy mapa_arquivos_apagar on storage.objects for delete to authenticated using (bucket_id = 'mapa-arquivos' and public.usuario_ativo());

-- Quem monta o mapa (itens, apropriações): engenharia, suprimentos e admin. Cotação e pedido: compras.
create or replace function public.pode_montar_mapa() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.meu_papel() in ('admin', 'engenharia', 'suprimentos'), false)
$$;

-- Saldo atual de um CC (Orçamento − Fechamento): é o "Orçamento" que aparece no mapa.
create or replace function public.saldo_cc(p_cc bigint) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(orcamento - fechamento, 0) from public.centros_custo_saldos where id = p_cc
$$;

-- Listagem.
create or replace view public.mapas_resumo with (security_invoker = true) as
  select m.*, o.codigo as obra_codigo, o.nome as obra_nome, o.regime as obra_regime, o.cliente_id,
         c.nome as cliente_nome, p.nome as solicitante_nome,
         s.criado_em as solicitacao_em
  from public.mapas m
  join public.obras o on o.id = m.obra_id
  left join public.clientes c on c.id = o.cliente_id
  left join public.solicitacoes s on s.id = m.solicitacao_id
  left join public.perfis p on p.id = coalesce(s.solicitante_id, m.criado_por);

-- ------------------------------------------------------------------
-- Efetivar solicitação (redefinida): a apropriação do mapa guarda o saldo do CC naquele momento.
-- ------------------------------------------------------------------
create or replace function public.efetivar_solicitacao(p_id bigint, p_itens bigint[] default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_sol public.solicitacoes; v_mapa bigint; v_num int; v_cliente bigint;
begin
  if not public.pode_editar_solicitacao(p_id) then raise exception 'Você não pode efetivar esta solicitação.' using errcode = '42501'; end if;
  select * into v_sol from public.solicitacoes where id = p_id for update;
  if v_sol.status <> 'pendente' then raise exception 'Solicitação já concluída.'; end if;

  create temp table _itens on commit drop as
    select si.* from public.solicitacao_itens si
     where si.solicitacao_id = p_id and si.mapa_item_id is null and (p_itens is null or si.id = any (p_itens));
  if not exists (select 1 from _itens where not e_titulo) then raise exception 'Nenhum item disponível para o mapa.'; end if;
  if exists (select 1 from _itens i where not i.e_titulo
               and not exists (select 1 from public.apropriacoes a where a.origem = 'solicitacao_item' and a.origem_id = i.id)) then
    raise exception 'Todos os itens precisam estar apropriados antes de efetivar.';
  end if;
  if exists (select 1 from _itens where not e_titulo and quantidade <= 0) then
    raise exception 'Informe a quantidade de todos os itens.';
  end if;

  select cliente_id into v_cliente from public.obras where id = v_sol.obra_id;
  select coalesce(max(m.numero_cliente), 0) + 1 into v_num
    from public.mapas m join public.obras o on o.id = m.obra_id
   where o.cliente_id is not distinct from v_cliente;

  insert into public.mapas (obra_id, solicitacao_id, servico, observacao, status, numero_cliente, criado_por)
  values (v_sol.obra_id, p_id, v_sol.servico, v_sol.observacao, 'cotacao', v_num, auth.uid())
  returning id into v_mapa;

  with novos as (
    insert into public.mapa_itens (mapa_id, ordem, e_titulo, item_id, codigo, descricao, quantidade, unidade, valor_medio, solicitacao_item_id)
    select v_mapa, ordem, e_titulo, item_id, codigo, descricao, quantidade, unidade, valor_medio, id from _itens order by ordem
    returning id, solicitacao_item_id
  ), vinc as (
    update public.solicitacao_itens si set mapa_item_id = n.id from novos n where si.id = n.solicitacao_item_id returning si.id, n.id as mapa_item
  )
  insert into public.apropriacoes (cc_id, origem, origem_id, valor)
  select a.cc_id, 'mapa_item', v.mapa_item, public.saldo_cc(a.cc_id)
    from vinc v join public.apropriacoes a on a.origem = 'solicitacao_item' and a.origem_id = v.id;

  if not exists (select 1 from public.solicitacao_itens where solicitacao_id = p_id and not e_titulo and mapa_item_id is null) then
    update public.solicitacoes set status = 'atendida' where id = p_id;
  end if;
  return v_mapa;
end $$;

-- ------------------------------------------------------------------
-- Novo Mapa / edição em Digitação (preserva ids e apropriações dos itens).
-- p_itens: [{id?, e_titulo, item_id, codigo, descricao, quantidade, unidade, valor_medio, excluir?}]
-- ------------------------------------------------------------------
create or replace function public.salvar_mapa_itens(p_id bigint, p_dados jsonb, p_itens jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint := p_id; v_num int; v_cliente bigint; v_status public.status_mapa;
begin
  if not public.pode_montar_mapa() then raise exception 'Seu perfil não pode montar mapas.' using errcode = '42501'; end if;
  if v_id is null then
    if coalesce(p_dados ->> 'obra_id', '') = '' then raise exception 'Selecione uma Obra.'; end if;
    if coalesce(trim(p_dados ->> 'servico'), '') = '' then raise exception 'Informe o Serviço.'; end if;
    select cliente_id into v_cliente from public.obras where id = (p_dados ->> 'obra_id')::bigint;
    select coalesce(max(m.numero_cliente), 0) + 1 into v_num
      from public.mapas m join public.obras o on o.id = m.obra_id where o.cliente_id is not distinct from v_cliente;
    insert into public.mapas (obra_id, servico, apropriacao, observacao, tipo, data_entrega, prazo_locacao, data_devolucao, status, numero_cliente, criado_por)
    values ((p_dados ->> 'obra_id')::bigint, trim(p_dados ->> 'servico'), nullif(p_dados ->> 'apropriacao', ''), nullif(p_dados ->> 'observacao', ''),
            coalesce(nullif(p_dados ->> 'tipo', ''), 'compra')::public.tipo_servico_mapa, nullif(p_dados ->> 'data_entrega', '')::date,
            nullif(p_dados ->> 'prazo_locacao', ''), nullif(p_dados ->> 'data_devolucao', '')::date, 'digitacao', v_num, auth.uid())
    returning id into v_id;
  else
    select status into v_status from public.mapas where id = v_id for update;
    if v_status is distinct from 'digitacao' then raise exception 'Só mapas em Digitação podem ser alterados.'; end if;
    update public.mapas
       set servico = coalesce(nullif(trim(p_dados ->> 'servico'), ''), servico), apropriacao = nullif(p_dados ->> 'apropriacao', ''),
           observacao = nullif(p_dados ->> 'observacao', ''), tipo = coalesce(nullif(p_dados ->> 'tipo', ''), 'compra')::public.tipo_servico_mapa,
           data_entrega = nullif(p_dados ->> 'data_entrega', '')::date, prazo_locacao = nullif(p_dados ->> 'prazo_locacao', ''),
           data_devolucao = nullif(p_dados ->> 'data_devolucao', '')::date
     where id = v_id;

    delete from public.apropriacoes
     where origem = 'mapa_item'
       and origem_id in (select (i ->> 'id')::bigint from jsonb_array_elements(p_itens) i
                          where coalesce(i ->> 'id', '') <> '' and coalesce((i ->> 'excluir')::boolean, false));
    delete from public.mapa_itens mi
     where mi.mapa_id = v_id
       and mi.id in (select (i ->> 'id')::bigint from jsonb_array_elements(p_itens) i
                      where coalesce(i ->> 'id', '') <> '' and coalesce((i ->> 'excluir')::boolean, false));
    update public.mapa_itens mi
       set ordem = t.ord, e_titulo = coalesce((t.i ->> 'e_titulo')::boolean, false), descricao = t.i ->> 'descricao',
           quantidade = coalesce(nullif(t.i ->> 'quantidade', '')::numeric, 0), unidade = coalesce(nullif(t.i ->> 'unidade', ''), mi.unidade)
      from jsonb_array_elements(p_itens) with ordinality as t(i, ord)
     where mi.mapa_id = v_id and coalesce(t.i ->> 'id', '') <> '' and mi.id = (t.i ->> 'id')::bigint
       and not coalesce((t.i ->> 'excluir')::boolean, false);
  end if;

  insert into public.mapa_itens (mapa_id, ordem, e_titulo, item_id, codigo, descricao, quantidade, unidade, valor_medio)
  select v_id, ord, coalesce((i ->> 'e_titulo')::boolean, false), nullif(i ->> 'item_id', '')::bigint,
         coalesce(nullif(i ->> 'codigo', ''), '0'), i ->> 'descricao', coalesce(nullif(i ->> 'quantidade', '')::numeric, 0),
         coalesce(nullif(i ->> 'unidade', ''), 'UN'), nullif(i ->> 'valor_medio', '')::numeric
  from jsonb_array_elements(p_itens) with ordinality as t(i, ord)
  where coalesce(i ->> 'id', '') = '' and coalesce(trim(i ->> 'descricao'), '') <> '';
  return v_id;
end $$;

create or replace function public.efetivar_mapa(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_montar_mapa() then raise exception 'Seu perfil não pode efetivar mapas.' using errcode = '42501'; end if;
  if exists (select 1 from public.mapa_itens mi where mi.mapa_id = p_id and not mi.e_titulo
               and not exists (select 1 from public.apropriacoes a where a.origem = 'mapa_item' and a.origem_id = mi.id)) then
    raise exception 'Todos os itens precisam estar apropriados antes de enviar o mapa para cotação.';
  end if;
  update public.mapas set status = 'cotacao' where id = p_id and status = 'digitacao';
  if not found then raise exception 'Só mapas em Digitação podem ser enviados para cotação.'; end if;
end $$;

create or replace function public.apropriar_item_mapa(p_item_id bigint, p_cc_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_obra bigint; v_status public.status_mapa;
begin
  if not public.pode_montar_mapa() then raise exception 'Seu perfil não pode alterar mapas.' using errcode = '42501'; end if;
  select m.obra_id, m.status into v_obra, v_status from public.mapa_itens mi join public.mapas m on m.id = mi.mapa_id where mi.id = p_item_id;
  if v_obra is null then raise exception 'Item não encontrado.'; end if;
  if v_status is distinct from 'digitacao' then raise exception 'Só mapas em Digitação podem ser alterados.'; end if;
  if not exists (select 1 from public.centros_custo where id = p_cc_id and obra_id = v_obra) then raise exception 'Centro de custo não pertence à obra.'; end if;
  if exists (select 1 from public.apropriacoes where origem = 'mapa_item' and origem_id = p_item_id and cc_id = p_cc_id) then
    raise exception 'Item já apropriado neste centro de custo.';
  end if;
  insert into public.apropriacoes (cc_id, origem, origem_id, valor) values (p_cc_id, 'mapa_item', p_item_id, public.saldo_cc(p_cc_id));
end $$;

create or replace function public.excluir_apropriacao_mapa(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_montar_mapa() then raise exception 'Seu perfil não pode alterar mapas.' using errcode = '42501'; end if;
  delete from public.apropriacoes a using public.mapa_itens mi, public.mapas m
   where a.id = p_id and a.origem = 'mapa_item' and mi.id = a.origem_id and m.id = mi.mapa_id and m.status = 'digitacao';
  if not found then raise exception 'Só mapas em Digitação podem ser alterados.'; end if;
end $$;

create or replace function public.importar_itens_mapa(p_mapa bigint, p_solicitacao bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_max int;
begin
  if not public.pode_montar_mapa() then raise exception 'Seu perfil não pode alterar mapas.' using errcode = '42501'; end if;
  if not exists (select 1 from public.mapas where id = p_mapa and status = 'digitacao') then raise exception 'Só mapas em Digitação podem ser alterados.'; end if;
  select coalesce(max(ordem), 0) into v_max from public.mapa_itens where mapa_id = p_mapa;
  insert into public.mapa_itens (mapa_id, ordem, e_titulo, item_id, codigo, descricao, quantidade, unidade, valor_medio)
  select p_mapa, v_max + ordem, e_titulo, item_id, codigo, descricao, quantidade, unidade, valor_medio
    from public.solicitacao_itens where solicitacao_id = p_solicitacao order by ordem;
end $$;

-- Fornecedores do mapa.
create or replace function public.adicionar_fornecedor_mapa(p_mapa bigint, p_fornecedor bigint) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.pode_comprar() then raise exception 'Só Suprimentos inclui fornecedores na cotação.' using errcode = '42501'; end if;
  if exists (select 1 from public.mapa_fornecedores where mapa_id = p_mapa and fornecedor_id = p_fornecedor) then
    raise exception 'Fornecedor já está no mapa.';
  end if;
  insert into public.mapa_fornecedores (mapa_id, fornecedor_id) values (p_mapa, p_fornecedor);
end $$;

create or replace function public.excluir_fornecedor_mapa(p_mapa bigint, p_fornecedor bigint) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.pode_comprar() then raise exception 'Só Suprimentos altera a cotação.' using errcode = '42501'; end if;
  if exists (select 1 from public.ordens_compra where mapa_id = p_mapa and fornecedor_id = p_fornecedor and status <> 'cancelada') then
    raise exception 'Fornecedor já tem pedido gerado neste mapa.';
  end if;
  delete from public.mapa_precos p using public.mapa_itens mi where mi.id = p.mapa_item_id and mi.mapa_id = p_mapa and p.fornecedor_id = p_fornecedor;
  delete from public.mapa_fornecedores where mapa_id = p_mapa and fornecedor_id = p_fornecedor;
end $$;

-- Grava a grade de cotação.
-- p_fornecedores: [{fornecedor_id, frete, impostos, desconto, condicao_pagamento, prazo_entrega, observacao}]
-- p_precos: [{mapa_item_id, fornecedor_id, valor_unitario}]
create or replace function public.salvar_cotacao_mapa(p_mapa bigint, p_fornecedores jsonb, p_precos jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.pode_comprar() then raise exception 'Só Suprimentos atualiza a cotação.' using errcode = '42501'; end if;
  if not exists (select 1 from public.mapas where id = p_mapa and status in ('cotacao', 'aberto')) then
    raise exception 'Só mapas em Cotação podem ter a cotação alterada.';
  end if;

  update public.mapa_fornecedores mf
     set frete = coalesce((f ->> 'frete')::numeric, 0), impostos = coalesce((f ->> 'impostos')::numeric, 0),
         desconto = coalesce((f ->> 'desconto')::numeric, 0), condicao_pagamento = nullif(f ->> 'condicao_pagamento', ''),
         prazo_entrega = nullif(f ->> 'prazo_entrega', ''), observacao = nullif(f ->> 'observacao', '')
    from jsonb_array_elements(p_fornecedores) f
   where mf.mapa_id = p_mapa and mf.fornecedor_id = (f ->> 'fornecedor_id')::bigint;

  delete from public.mapa_precos p using public.mapa_itens mi where mi.id = p.mapa_item_id and mi.mapa_id = p_mapa;
  insert into public.mapa_precos (mapa_item_id, fornecedor_id, valor_unitario)
  select (x ->> 'mapa_item_id')::bigint, (x ->> 'fornecedor_id')::bigint, (x ->> 'valor_unitario')::numeric
    from jsonb_array_elements(p_precos) x
   where coalesce((x ->> 'valor_unitario')::numeric, 0) > 0
     and exists (select 1 from public.mapa_itens mi where mi.id = (x ->> 'mapa_item_id')::bigint and mi.mapa_id = p_mapa);
end $$;

-- Gera o pedido (OC) de um fornecedor: mapa inteiro (p_itens nulo) ou "Pedido Parcial" (itens marcados).
-- A OC apropria o valor de cada item nos CCs do item: isso forma o Fechamento do CC.
create or replace function public.gerar_pedido_mapa(p_mapa bigint, p_fornecedor bigint, p_itens bigint[] default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_mapa public.mapas; v_mf public.mapa_fornecedores; v_oc bigint;
begin
  if not public.pode_comprar() then raise exception 'Só Suprimentos gera pedidos.' using errcode = '42501'; end if;
  select * into v_mapa from public.mapas where id = p_mapa for update;
  if v_mapa.status not in ('cotacao', 'finalizado', 'aberto') then raise exception 'Envie o mapa para cotação antes de gerar pedido.'; end if;
  if p_itens is null and exists (select 1 from public.ordens_compra where mapa_id = p_mapa and status <> 'cancelada') then
    raise exception 'Mapa já possui Pedido Gerado! Operação não permitida';
  end if;
  if exists (select 1 from public.fornecedor_bloqueios where fornecedor_id = p_fornecedor and desbloqueado_em is null) then
    raise exception 'Fornecedor bloqueado. Não é possível gerar pedido.';
  end if;
  select * into v_mf from public.mapa_fornecedores where mapa_id = p_mapa and fornecedor_id = p_fornecedor;
  if v_mf.id is null then raise exception 'Fornecedor não está no mapa.'; end if;

  create temp table _ped on commit drop as
    select mi.id, mi.ordem, mi.item_id, mi.codigo, mi.descricao, mi.quantidade, mi.unidade, p.valor_unitario
      from public.mapa_itens mi
      join public.mapa_precos p on p.mapa_item_id = mi.id and p.fornecedor_id = p_fornecedor
     where mi.mapa_id = p_mapa and not mi.e_titulo and mi.quantidade > 0
       and (p_itens is null or mi.id = any (p_itens))
       and not exists (select 1 from public.oc_itens oi join public.ordens_compra oc on oc.id = oi.ordem_compra_id
                        where oi.mapa_item_id = mi.id and oc.status <> 'cancelada');
  if not exists (select 1 from _ped) then raise exception 'Nenhum item com preço deste fornecedor disponível para pedido.'; end if;

  insert into public.ordens_compra (obra_id, fornecedor_id, mapa_id, data_entrega, condicao_pagamento, prazo_entrega, frete, impostos, desconto, observacao)
  values (v_mapa.obra_id, p_fornecedor, p_mapa, v_mapa.data_entrega, v_mf.condicao_pagamento, v_mf.prazo_entrega,
          case when p_itens is null then v_mf.frete else 0 end, case when p_itens is null then v_mf.impostos else 0 end,
          case when p_itens is null then v_mf.desconto else 0 end, coalesce(v_mf.observacao, v_mapa.servico))
  returning id into v_oc;

  insert into public.oc_itens (ordem_compra_id, ordem, item_id, codigo, descricao, quantidade, unidade, valor_unitario, mapa_item_id)
  select v_oc, ordem, item_id, codigo, descricao, quantidade, unidade, valor_unitario, id from _ped;

  -- Apropriação da OC: valor do item dividido igualmente entre os CCs do item.
  insert into public.apropriacoes (cc_id, origem, origem_id, valor)
  select a.cc_id, 'oc', v_oc, round(sum(i.quantidade * i.valor_unitario / n.qtd), 2)
    from _ped i
    join public.apropriacoes a on a.origem = 'mapa_item' and a.origem_id = i.id
    join (select origem_id, count(*) as qtd from public.apropriacoes where origem = 'mapa_item' group by origem_id) n on n.origem_id = i.id
   group by a.cc_id;

  if v_mapa.solicitacao_id is not null then
    update public.solicitacoes set status = 'atendida' where id = v_mapa.solicitacao_id and status = 'pendente';
  end if;
  return v_oc;
end $$;

create or replace function public.finalizar_cotacao_mapa(p_id bigint) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.pode_comprar() then raise exception 'Só Suprimentos encerra a cotação.' using errcode = '42501'; end if;
  update public.mapas set status = 'finalizado' where id = p_id and status in ('cotacao', 'aberto');
  if not found then raise exception 'O mapa não está em Cotação.'; end if;
end $$;

create or replace function public.alternar_regularizacao_engenharia(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_montar_mapa() then raise exception 'Seu perfil não pode alterar mapas.' using errcode = '42501'; end if;
  update public.mapas set regularizacao_engenharia = not regularizacao_engenharia where id = p_id;
end $$;

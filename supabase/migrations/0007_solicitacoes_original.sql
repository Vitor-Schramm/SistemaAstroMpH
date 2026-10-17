-- MPH Sistema — Solicitações como no AstroTools: itens com título (Tit.), apropriação de cada item
-- num centro de custo da obra, importação de itens de outra solicitação e "Efetivar Solicitação",
-- que gera o mapa de cotação automaticamente (status Cotação, nº sequencial do cliente).
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run (depois da 0006).

-- Status do mapa como no original: Digitação → Cotação → Finalizado.
alter type public.status_mapa add value if not exists 'digitacao';
alter type public.status_mapa add value if not exists 'cotacao';

alter table public.mapas add column if not exists numero_cliente int;

-- Itens: linha de título (Tit.), quantidade zero permitida (linhas novas e títulos), vínculo com o mapa.
alter table public.solicitacao_itens add column if not exists e_titulo boolean not null default false;
alter table public.solicitacao_itens drop constraint if exists solicitacao_itens_quantidade_check;
alter table public.solicitacao_itens add constraint solicitacao_itens_quantidade_check check (quantidade >= 0);

alter table public.mapa_itens add column if not exists e_titulo boolean not null default false;
alter table public.mapa_itens add column if not exists solicitacao_item_id bigint references public.solicitacao_itens (id) on delete set null;
alter table public.mapa_itens drop constraint if exists mapa_itens_quantidade_check;
alter table public.mapa_itens add constraint mapa_itens_quantidade_check check (quantidade >= 0);

alter table public.solicitacao_itens add column if not exists mapa_item_id bigint references public.mapa_itens (id) on delete set null;

-- Quem pode mexer numa solicitação em aberto: o solicitante, engenharia, compras e admin.
create or replace function public.pode_editar_solicitacao(p_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.usuario_ativo() and exists (
    select 1 from public.solicitacoes s
     where s.id = p_id
       and (s.solicitante_id = auth.uid() or public.meu_papel() in ('admin', 'engenharia', 'suprimentos')))
$$;

-- Listagem (com cliente e solicitante).
create or replace view public.solicitacoes_resumo with (security_invoker = true) as
  select s.*, o.codigo as obra_codigo, o.nome as obra_nome, o.regime as obra_regime, o.cliente_id,
         c.nome as cliente_nome, p.nome as solicitante_nome
  from public.solicitacoes s
  join public.obras o on o.id = s.obra_id
  left join public.clientes c on c.id = o.cliente_id
  left join public.perfis p on p.id = s.solicitante_id;

-- Apropriações de um item de solicitação, com o CC.
create or replace view public.apropriacoes_detalhe with (security_invoker = true) as
  select a.*, cc.codigo as cc_codigo, cc.descricao as cc_descricao, cc.obra_id
  from public.apropriacoes a
  join public.centros_custo cc on cc.id = a.cc_id;

-- ------------------------------------------------------------------
-- Salva cabeçalho e itens preservando os ids (e as apropriações) dos itens existentes.
-- p_itens: [{id?, e_titulo, item_id, codigo, descricao, quantidade, unidade, valor_medio, excluir?}]
-- ------------------------------------------------------------------
create or replace function public.salvar_solicitacao_itens(p_id bigint, p_dados jsonb, p_itens jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint := p_id;
begin
  if not public.usuario_ativo() then raise exception 'Usuário sem acesso.' using errcode = '42501'; end if;
  if coalesce(p_dados ->> 'obra_id', '') = '' then raise exception 'Selecione uma Obra.'; end if;
  if coalesce(trim(p_dados ->> 'servico'), '') = '' then raise exception 'Informe o Serviço.'; end if;

  if v_id is null then
    insert into public.solicitacoes (obra_id, servico, observacao)
    values ((p_dados ->> 'obra_id')::bigint, trim(p_dados ->> 'servico'), nullif(p_dados ->> 'observacao', ''))
    returning id into v_id;
  else
    if not public.pode_editar_solicitacao(v_id) then raise exception 'Você não pode alterar esta solicitação.' using errcode = '42501'; end if;
    update public.solicitacoes set servico = trim(p_dados ->> 'servico'), observacao = nullif(p_dados ->> 'observacao', '')
     where id = v_id and status = 'pendente';
    if not found then raise exception 'Solicitação concluída não pode ser alterada.'; end if;

    -- Itens marcados para excluir (só os que ainda não foram para um mapa).
    delete from public.apropriacoes
     where origem = 'solicitacao_item'
       and origem_id in (select (i ->> 'id')::bigint from jsonb_array_elements(p_itens) i
                          where coalesce(i ->> 'id', '') <> '' and coalesce((i ->> 'excluir')::boolean, false));
    delete from public.solicitacao_itens si
     where si.solicitacao_id = v_id and si.mapa_item_id is null
       and si.id in (select (i ->> 'id')::bigint from jsonb_array_elements(p_itens) i
                      where coalesce(i ->> 'id', '') <> '' and coalesce((i ->> 'excluir')::boolean, false));

    update public.solicitacao_itens si
       set ordem = t.ord, e_titulo = coalesce((t.i ->> 'e_titulo')::boolean, false), descricao = t.i ->> 'descricao',
           quantidade = coalesce(nullif(t.i ->> 'quantidade', '')::numeric, 0),
           unidade = coalesce(nullif(t.i ->> 'unidade', ''), si.unidade)
      from jsonb_array_elements(p_itens) with ordinality as t(i, ord)
     where si.solicitacao_id = v_id and coalesce(t.i ->> 'id', '') <> '' and si.id = (t.i ->> 'id')::bigint
       and si.mapa_item_id is null and not coalesce((t.i ->> 'excluir')::boolean, false);
  end if;

  insert into public.solicitacao_itens (solicitacao_id, ordem, e_titulo, item_id, codigo, descricao, quantidade, unidade, valor_medio)
  select v_id, ord, coalesce((i ->> 'e_titulo')::boolean, false), nullif(i ->> 'item_id', '')::bigint,
         coalesce(nullif(i ->> 'codigo', ''), '0'), i ->> 'descricao', coalesce(nullif(i ->> 'quantidade', '')::numeric, 0),
         coalesce(nullif(i ->> 'unidade', ''), 'UN'), nullif(i ->> 'valor_medio', '')::numeric
  from jsonb_array_elements(p_itens) with ordinality as t(i, ord)
  where coalesce(i ->> 'id', '') = '' and coalesce(trim(i ->> 'descricao'), '') <> '';

  return v_id;
end $$;

-- Apropria um item num centro de custo da obra da solicitação.
create or replace function public.apropriar_item_solicitacao(p_item_id bigint, p_cc_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_sol bigint; v_obra bigint;
begin
  select si.solicitacao_id, s.obra_id into v_sol, v_obra
    from public.solicitacao_itens si join public.solicitacoes s on s.id = si.solicitacao_id where si.id = p_item_id;
  if v_sol is null then raise exception 'Item não encontrado.'; end if;
  if not public.pode_editar_solicitacao(v_sol) then raise exception 'Você não pode alterar esta solicitação.' using errcode = '42501'; end if;
  if not exists (select 1 from public.centros_custo where id = p_cc_id and obra_id = v_obra) then
    raise exception 'Centro de custo não pertence à obra.';
  end if;
  if exists (select 1 from public.apropriacoes where origem = 'solicitacao_item' and origem_id = p_item_id and cc_id = p_cc_id) then
    raise exception 'Item já apropriado neste centro de custo.';
  end if;
  insert into public.apropriacoes (cc_id, origem, origem_id, valor) values (p_cc_id, 'solicitacao_item', p_item_id, 0);
end $$;

create or replace function public.excluir_apropriacao_solicitacao(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_sol bigint;
begin
  select si.solicitacao_id into v_sol from public.apropriacoes a join public.solicitacao_itens si on si.id = a.origem_id
   where a.id = p_id and a.origem = 'solicitacao_item' and si.mapa_item_id is null;
  if v_sol is null then raise exception 'Apropriação não encontrada ou item já enviado para mapa.'; end if;
  if not public.pode_editar_solicitacao(v_sol) then raise exception 'Você não pode alterar esta solicitação.' using errcode = '42501'; end if;
  delete from public.apropriacoes where id = p_id;
end $$;

-- Copia os itens de outra solicitação da mesma obra.
create or replace function public.importar_itens_solicitacao(p_destino bigint, p_origem bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_max int;
begin
  if not public.pode_editar_solicitacao(p_destino) then raise exception 'Você não pode alterar esta solicitação.' using errcode = '42501'; end if;
  if not exists (select 1 from public.solicitacoes where id = p_destino and status = 'pendente') then
    raise exception 'Solicitação concluída não pode ser alterada.';
  end if;
  select coalesce(max(ordem), 0) into v_max from public.solicitacao_itens where solicitacao_id = p_destino;
  insert into public.solicitacao_itens (solicitacao_id, ordem, e_titulo, item_id, codigo, descricao, quantidade, unidade, valor_medio)
  select p_destino, v_max + ordem, e_titulo, item_id, codigo, descricao, quantidade, unidade, valor_medio
    from public.solicitacao_itens where solicitacao_id = p_origem order by ordem;
end $$;

-- Efetiva a solicitação: cria o mapa (Cotação, nº sequencial do cliente) com os itens escolhidos
-- (todos quando p_itens é nulo) e as apropriações deles. Retorna o id do mapa.
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
  select a.cc_id, 'mapa_item', v.mapa_item, 0
    from vinc v join public.apropriacoes a on a.origem = 'solicitacao_item' and a.origem_id = v.id;

  -- Concluída quando todos os itens (não título) já estão em mapa.
  if not exists (select 1 from public.solicitacao_itens where solicitacao_id = p_id and not e_titulo and mapa_item_id is null) then
    update public.solicitacoes set status = 'atendida' where id = p_id;
  end if;
  return v_mapa;
end $$;

-- Exclusão da solicitação (admin), desde que nada tenha ido para mapa.
create or replace function public.excluir_solicitacao(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.meu_papel() is distinct from 'admin' then raise exception 'Só o administrador exclui solicitações.' using errcode = '42501'; end if;
  if exists (select 1 from public.solicitacao_itens where solicitacao_id = p_id and mapa_item_id is not null) then
    raise exception 'A solicitação já gerou mapa e não pode ser excluída.';
  end if;
  delete from public.apropriacoes where origem = 'solicitacao_item'
     and origem_id in (select id from public.solicitacao_itens where solicitacao_id = p_id);
  delete from public.solicitacoes where id = p_id;
end $$;

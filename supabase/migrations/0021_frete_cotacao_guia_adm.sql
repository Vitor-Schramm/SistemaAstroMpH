-- MPH Sistema — regras confirmadas pelo Vitor (05/11/2026) depois do teste de ponta a ponta:
-- 1. Frete (e desconto) do mapa/OC não têm apropriação própria: o valor entra na apropriação dos itens,
--    proporcional ao valor de cada item. Os impostos da cotação (já rateados nos itens) também entram.
--    Assim o Total Apropriado da OC gerada pelo mapa fica igual ao Total da OC.
-- 2. Depois de gerar pedido, a cotação do mapa não pode mais ser alterada.
-- 3. Guia ADM paga: os valores de Administração e Impostos entram como pagos (Pago Guia) nas linhas
--    ADM e Impostos da planilha; o estorno tira. Guias ADM já pagas antes desta migração são lançadas.
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run (depois da 0020).

-- ------------------------------------------------------------------
-- 1. Gerar pedido do mapa (mesmo texto da 0009; muda só a apropriação no fim)
-- ------------------------------------------------------------------
create or replace function public.gerar_pedido_mapa(p_mapa bigint, p_fornecedor bigint, p_itens bigint[] default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_mapa public.mapas; v_mf public.mapa_fornecedores; v_oc bigint; v_num int; v_cliente bigint;
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

  select cliente_id into v_cliente from public.obras where id = v_mapa.obra_id;
  select coalesce(max(oc.numero_cliente), 0) + 1 into v_num
    from public.ordens_compra oc join public.obras o on o.id = oc.obra_id where o.cliente_id is not distinct from v_cliente;

  insert into public.ordens_compra (obra_id, fornecedor_id, mapa_id, nome, numero_cliente, tipo, data_entrega, prazo_locacao, data_devolucao,
                                    condicao_pagamento, prazo_entrega, frete, impostos, desconto, observacao, status)
  values (v_mapa.obra_id, p_fornecedor, p_mapa, v_mapa.servico, v_num, v_mapa.tipo, v_mapa.data_entrega, v_mapa.prazo_locacao, v_mapa.data_devolucao,
          v_mf.condicao_pagamento, v_mf.prazo_entrega,
          case when p_itens is null then v_mf.frete else 0 end, 0,
          case when p_itens is null then v_mf.desconto else 0 end, v_mf.observacao, 'rascunho')
  returning id into v_oc;

  -- Impostos da cotação vão para os itens, proporcionalmente ao valor de cada um.
  insert into public.oc_itens (ordem_compra_id, ordem, item_id, codigo, descricao, quantidade, unidade, valor_unitario, mapa_item_id, valor_impostos)
  select v_oc, ordem, item_id, codigo, descricao, quantidade, unidade, valor_unitario, id,
         case when p_itens is null and coalesce(v_mf.impostos, 0) > 0
              then round(v_mf.impostos * quantidade * valor_unitario / nullif(sum(quantidade * valor_unitario) over (), 0), 2) else 0 end
    from _ped;

  -- Apropriação: valor do item (com impostos) + parte do frete − desconto, proporcional ao valor do item,
  -- dividido igualmente entre os CCs do item. A diferença de arredondamento vai para o CC de maior valor.
  insert into public.apropriacoes (cc_id, origem, origem_id, valor, saldo_ref)
  with it as (
         select oi.mapa_item_id, oi.quantidade * oi.valor_unitario + oi.valor_impostos as v
           from public.oc_itens oi where oi.ordem_compra_id = v_oc and not oi.e_titulo
       ),
       tot as (select sum(v) as t from it),
       ext as (select frete - desconto as e from public.ordens_compra where id = v_oc),
       por_item as (
         select it.mapa_item_id, it.v + case when tot.t > 0 then ext.e * it.v / tot.t else 0 end as vf
           from it, tot, ext
       ),
       por_cc as (
         select a.cc_id, sum(p.vf / n.qtd) as bruto
           from por_item p
           join public.apropriacoes a on a.origem = 'mapa_item' and a.origem_id = p.mapa_item_id
           join (select origem_id, count(*) as qtd from public.apropriacoes where origem = 'mapa_item' group by origem_id) n on n.origem_id = p.mapa_item_id
          group by a.cc_id
       ),
       ordenado as (
         select cc_id, bruto, round(bruto, 2) as arred, row_number() over (order by bruto desc, cc_id) as rn,
                round(sum(bruto) over (), 2) - sum(round(bruto, 2)) over () as residuo
           from por_cc
       )
  select cc_id, 'oc', v_oc, arred + case when rn = 1 then residuo else 0 end, public.saldo_cc(cc_id)
    from ordenado;

  perform public.verificar_pendencia_oc(v_oc);
  if v_mapa.solicitacao_id is not null then
    update public.solicitacoes set status = 'atendida' where id = v_mapa.solicitacao_id and status = 'pendente';
  end if;
  return v_oc;
end $$;

-- ------------------------------------------------------------------
-- 2. Cotação travada depois de gerar pedido (mesmo texto da 0008, mais a verificação do pedido)
-- ------------------------------------------------------------------
create or replace function public.salvar_cotacao_mapa(p_mapa bigint, p_fornecedores jsonb, p_precos jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.pode_comprar() then raise exception 'Só Suprimentos atualiza a cotação.' using errcode = '42501'; end if;
  if not exists (select 1 from public.mapas where id = p_mapa and status in ('cotacao', 'aberto')) then
    raise exception 'Só mapas em Cotação podem ter a cotação alterada.';
  end if;
  if exists (select 1 from public.ordens_compra where mapa_id = p_mapa and status <> 'cancelada') then
    raise exception 'Mapa já possui Pedido Gerado! A cotação não pode ser alterada.';
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

-- ------------------------------------------------------------------
-- 3. Guia ADM paga → Pago Guia nas linhas ADM e Impostos
-- ------------------------------------------------------------------
-- Lança os valores de uma Guia ADM nos CCs de Administração (nível ADM) e Impostos (nível I) de cada planilha.
create or replace function public.lancar_pagamento_guia_adm(p_id bigint, p_data date) returns void
language sql security definer set search_path = '' as $$
  insert into public.pagamentos_cc (cc_id, modo, origem, origem_id, valor, data)
  select cc.id, 'guia', 'guia_adm', p_id, v.valor, p_data
    from public.guia_adm_calculo c
    cross join lateral (values ('ADM', c.administracao), ('I', c.imposto)) v(nivel, valor)
    join lateral (select id from public.centros_custo
                   where planilha_id = c.planilha_id and nivel = v.nivel order by ordem, codigo limit 1) cc on true
   where c.guia_adm_id = p_id and v.valor > 0
$$;
revoke execute on function public.lancar_pagamento_guia_adm(bigint, date) from public, anon, authenticated;

-- Confirmar / estornar pagamento (mesmo texto da 0013, mais o lançamento nos CCs).
create or replace function public.pagar_guia_adm(p_id bigint, p_pagar boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_pagar() then raise exception 'Só o financeiro confirma pagamentos.' using errcode = '42501'; end if;
  update public.guias
     set pago = p_pagar, data_pagamento = case when p_pagar then current_date end, pago_por = case when p_pagar then auth.uid() end
   where id = p_id and tipo = 'adm' and pago = not p_pagar;
  if not found then raise exception 'A guia não está em uma situação que permita essa ação.'; end if;
  delete from public.pagamentos_cc where origem = 'guia_adm' and origem_id = p_id;
  if p_pagar then perform public.lancar_pagamento_guia_adm(p_id, current_date); end if;
end $$;

-- Guias ADM pagas antes desta migração.
select public.lancar_pagamento_guia_adm(g.id, g.data_pagamento)
  from public.guias g
 where g.tipo = 'adm' and g.pago
   and not exists (select 1 from public.pagamentos_cc p where p.origem = 'guia_adm' and p.origem_id = g.id);

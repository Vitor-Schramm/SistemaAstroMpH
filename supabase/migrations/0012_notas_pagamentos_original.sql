-- MPH Sistema — Notas Fase Cinza (Aprovação NF, Pendentes, Pagas) e Notas Fase Azul (Pendentes, Pagas)
-- como no AstroTools. O pagamento da Fase Cinza confere a verba alocada de cada CC da OC e grava o
-- "Val Pago" rateado por CC (pagamentos_cc); sem verba, só com "Efetivar pagamento com falta de verba alocada".
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run (depois da 0011).

-- Listagem das notas com os dados que as telas do original mostram.
create or replace view public.notas_lista with (security_invoker = true) as
  select n.id, n.fase, n.status, n.numero, n.serie, n.tipo_documento, n.vencimento, n.valor, n.criado_em, n.pago_em,
         n.pagamento_forcado, n.guia_id, n.ordem_compra_id, n.obra_id, n.fornecedor_id, n.tipo_pagamento,
         o.nome as obra_nome, o.cliente_id, c.nome as cliente_nome,
         oc.numero_cliente as pedido, oc.nome as pedido_nome,
         coalesce(f.nome_fantasia, f.nome) as fornecedor_nome,
         pp.nome as pago_por_nome, pr.nome as registrado_por_nome,
         (select count(*) from public.nf_anexos a where a.nota_fiscal_id = n.id) as anexos
  from public.notas_fiscais n
  join public.obras o on o.id = n.obra_id
  left join public.clientes c on c.id = o.cliente_id
  left join public.ordens_compra oc on oc.id = n.ordem_compra_id
  join public.fornecedores f on f.id = n.fornecedor_id
  left join public.perfis pp on pp.id = n.pago_por
  left join public.perfis pr on pr.id = n.registrado_por;

-- Rateio de uma nota da Fase Cinza pelos CCs da OC (proporcional ao apontado).
create or replace function public.rateio_nota_cinza(p_id bigint)
returns table (cc_id bigint, valor numeric)
language sql stable security definer set search_path = '' as $$
  with n as (select ordem_compra_id, valor from public.notas_fiscais where id = p_id),
       a as (select a.cc_id, sum(a.valor) as v from public.apropriacoes a, n where a.origem = 'oc' and a.origem_id = n.ordem_compra_id group by a.cc_id),
       t as (select sum(v) as total from a)
  select a.cc_id, round(n.valor * a.v / nullif(t.total, 0), 2) from a, n, t
$$;

-- Efetivar pagamento (redefinida): confere a verba alocada de cada CC (planilhas de obra fechada).
create or replace function public.efetivar_pagamento(p_id bigint, p_data date, p_forcar boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare v_nf public.notas_fiscais; v_falta text := ''; r record;
begin
  if not public.pode_pagar() then raise exception 'Só o financeiro efetiva pagamentos.' using errcode = '42501'; end if;
  select * into v_nf from public.notas_fiscais where id = p_id for update;
  if v_nf.id is null or v_nf.fase <> 'cinza' or v_nf.status <> 'pendente_pagamento' then
    raise exception 'Esta nota não está pendente de pagamento.';
  end if;

  for r in
    select rt.cc_id, rt.valor, s.codigo, s.verba_alocada, s.val_pago, s.planilha_modo
      from public.rateio_nota_cinza(p_id) rt join public.centros_custo_saldos s on s.id = rt.cc_id
  loop
    if r.planilha_modo = 'verba' and r.valor > r.verba_alocada - r.val_pago + 0.005 then
      v_falta := v_falta || format('CC %s: disponível %s, nota %s. ', r.codigo, public.valor_br(r.verba_alocada - r.val_pago), public.valor_br(r.valor));
    end if;
  end loop;
  if v_falta <> '' and not p_forcar then
    raise exception 'VERBA_INSUFICIENTE: %', trim(v_falta);
  end if;

  update public.notas_fiscais
     set status = 'paga', pago_em = coalesce(p_data, current_date), pago_por = auth.uid(), pagamento_forcado = v_falta <> ''
   where id = p_id;
  delete from public.pagamentos_cc where origem = 'nf' and origem_id = p_id;
  insert into public.pagamentos_cc (cc_id, modo, origem, origem_id, valor, data)
  select cc_id, 'pago', 'nf', p_id, valor, coalesce(p_data, current_date) from public.rateio_nota_cinza(p_id) where valor > 0;
end $$;

-- Excluir pagamento realizado: "Excluir pagamento" (volta para Pendentes) ou "Excluir pagamento + Nota".
create or replace function public.excluir_pagamento_nf(p_id bigint, p_tipo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.meu_papel() is distinct from 'admin' and not public.pode_pagar() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if not exists (select 1 from public.notas_fiscais where id = p_id and fase = 'cinza' and status = 'paga') then
    raise exception 'Só notas pagas da Fase Cinza.';
  end if;
  delete from public.pagamentos_cc where origem = 'nf' and origem_id = p_id;
  if p_tipo = 'pagamento_nota' then
    delete from public.notas_fiscais where id = p_id;
  else
    update public.notas_fiscais set status = 'pendente_pagamento', pago_em = null, pago_por = null, pagamento_forcado = false where id = p_id;
  end if;
end $$;

-- Estornar pagamento (redefinida) também desfaz o Val Pago dos CCs.
create or replace function public.estornar_pagamento(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.excluir_pagamento_nf(p_id, 'pagamento');
end $$;

-- "Deseja alterar numero da nota?"
create or replace function public.alterar_numero_nf(p_id bigint, p_numero text, p_serie text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.meu_papel() is distinct from 'admin' and not public.pode_pagar() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if coalesce(trim(p_numero), '') = '' then raise exception 'Informe o novo número.'; end if;
  update public.notas_fiscais set numero = trim(p_numero), serie = coalesce(nullif(trim(p_serie), ''), serie) where id = p_id;
end $$;

-- Val Pago das notas já pagas antes desta migração.
insert into public.pagamentos_cc (cc_id, modo, origem, origem_id, valor, data)
select r.cc_id, 'pago', 'nf', n.id, r.valor, n.pago_em
  from public.notas_fiscais n cross join lateral public.rateio_nota_cinza(n.id) r
 where n.fase = 'cinza' and n.status = 'paga' and r.valor > 0
   and not exists (select 1 from public.pagamentos_cc p where p.origem = 'nf' and p.origem_id = n.id);

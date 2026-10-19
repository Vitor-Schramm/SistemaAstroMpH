-- MPH Sistema — ajustes da pendência da OC:
-- 1) valores da mensagem no formato brasileiro (1.234,56);
-- 2) OC já liberada pela Engenharia/Coordenação não volta a ficar pendente ao ser salva.
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run (depois da 0009).

create or replace function public.valor_br(v numeric) returns text
language sql immutable set search_path = '' as $$
  select translate(to_char(v, 'FM999G999G990D00'), ',.', '.,')
$$;

create or replace function public.verificar_pendencia_oc(p_id bigint) returns text
language plpgsql security definer set search_path = '' as $$
declare v_msg text := ''; v_total numeric := public.total_oc(p_id); v_obra bigint; v_limite numeric; r record; v_liberada boolean;
begin
  select obra_id into v_obra from public.ordens_compra where id = p_id;
  for r in
    select a.valor, a.saldo_ref, cc.codigo from public.apropriacoes a join public.centros_custo cc on cc.id = a.cc_id
     where a.origem = 'oc' and a.origem_id = p_id
  loop
    if r.saldo_ref is not null and r.valor > r.saldo_ref + 0.005 then
      v_msg := v_msg || format('Valor apontado no CC %s (%s) maior que o saldo (%s). ', r.codigo, public.valor_br(r.valor), public.valor_br(r.saldo_ref));
    end if;
  end loop;
  select max(limite_aprovacao_oc) into v_limite from public.obra_responsaveis
   where obra_id = v_obra and tipo = 'engenheiro' and limite_aprovacao_oc > 0;
  if v_limite is not null and v_total > v_limite + 0.005 then
    v_msg := v_msg || format('Valor da OC (%s) acima do limite de aprovação do engenheiro (%s). ', public.valor_br(v_total), public.valor_br(v_limite));
  end if;
  v_msg := nullif(trim(v_msg), '');

  -- A última decisão registrada vale: liberada continua liberada; bloqueada continua bloqueada.
  select status = 'Liberado' into v_liberada from public.oc_justificativas where ordem_compra_id = p_id order by criado_em desc limit 1;

  update public.ordens_compra
     set pendencia = v_msg,
         status = case when v_msg is null or v_liberada then 'aprovada'::public.status_oc
                       when status in ('rascunho', 'aprovada') then 'aguardando_aprovacao'::public.status_oc
                       else status end
   where id = p_id and status not in ('cancelada', 'reprovada');
  return v_msg;
end $$;

-- Refaz a mensagem das OCs pendentes no formato novo.
select public.verificar_pendencia_oc(id) from public.ordens_compra where pendencia is not null;

-- Correção da 0014: "Efetivar Solicitação" do reembolso — fase e status da nota com os tipos certos.
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run (depois da 0014).

create or replace function public.efetivar_solicitacao_reembolso(p_id bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_r public.ordens_reembolso; v_total numeric; v_aprop numeric; v_regime text; v_nota bigint; v_azul boolean;
begin
  if not public.pode_editar_reembolso() then raise exception 'Seu perfil não pode alterar ordens de reembolso.' using errcode = '42501'; end if;
  select * into v_r from public.ordens_reembolso where id = p_id for update;
  if v_r.id is null then raise exception 'Ordem de reembolso não encontrada.'; end if;
  if v_r.solicitacao_enviada then raise exception 'Solicitação já enviada ao Financeiro.'; end if;
  v_total := public.total_reembolso(p_id);
  select coalesce(sum(valor), 0) into v_aprop from public.apropriacoes where origem = 'reembolso' and origem_id = p_id;
  if v_total <= 0 or abs(v_total - v_aprop) > 0.005 then raise exception 'Aproprie o valor total da ordem antes de enviar.'; end if;

  select regime::text into v_regime from public.obras where id = v_r.obra_id;
  v_azul := v_regime = 'administracao';
  insert into public.notas_fiscais (fase, ordem_compra_id, ordem_reembolso_id, obra_id, fornecedor_id, numero, serie, tipo_documento, vencimento, valor, status,
                                    tipo_pagamento, favorecido_cpf_cnpj, favorecido, banco, agencia, conta)
  values ((case when v_azul then 'azul' else 'cinza' end)::public.fase_nf, null, p_id, v_r.obra_id, v_r.fornecedor_id,
          extract(epoch from clock_timestamp())::bigint::text, '1', 'REEMBOLSO', current_date, v_total,
          (case when v_azul then 'aguardando_guia' else 'pendente_pagamento' end)::public.status_nf,
          'Transferencia', v_r.cpf_cnpj, (select nome from public.fornecedores where id = v_r.fornecedor_id), v_r.banco, v_r.agencia, v_r.conta)
  returning id into v_nota;
  if v_azul then
    insert into public.nf_rateios (nota_fiscal_id, cc_id, valor)
    select v_nota, cc_id, sum(valor) from public.apropriacoes where origem = 'reembolso' and origem_id = p_id group by cc_id;
  end if;

  update public.ordens_reembolso set solicitacao_enviada = true, enviada_em = now(), enviada_por = auth.uid() where id = p_id;
  return v_nota;
end $$;

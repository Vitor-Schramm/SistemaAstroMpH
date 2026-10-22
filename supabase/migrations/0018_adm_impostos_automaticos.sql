-- MPH Sistema — Controle Financeiro como no AstroTools: nas planilhas Administradas (modo guia) as linhas de
-- Administração e Impostos são calculadas pelas taxas da planilha (Percentuais), nas três colunas:
--   ADM      = Taxa ADM (%) × Σ dos CCs normais da planilha (An. Financeira, Orçamento e Fechamento)
--   Impostos = Taxa IMP (%) × linha ADM
-- Conferido no original: obras 464 (10%/8% e 18%) e 582 (10% e 19,5%). Nas planilhas de verba (Fechado) nada muda.
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run (depois da 0017).

create or replace view public.centros_custo_saldos with (security_invoker = true) as
  with base as (
    select cc.*, p.nome as planilha_nome, p.modo as planilha_modo, p.seq as planilha_seq,
           coalesce(a.fechamento, 0) as fech_apropriado,
           coalesce(pg.val_pago, 0) as val_pago,
           coalesce(pg.pago_guia, 0) as pago_guia
    from public.centros_custo cc
    join public.planilhas p on p.id = cc.planilha_id
    left join (select cc_id, sum(valor) as fechamento from public.apropriacoes
               where origem in ('oc', 'reembolso') group by cc_id) a on a.cc_id = cc.id
    left join (select cc_id,
                      sum(valor) filter (where modo = 'pago') as val_pago,
                      sum(valor) filter (where modo = 'guia') as pago_guia
               from public.pagamentos_cc group by cc_id) pg on pg.cc_id = cc.id
  ),
  normais as (
    select planilha_id, sum(an_financeira) as af, sum(orcamento) as orc, sum(fech_apropriado) as fech
    from base where nivel = 'CC' group by planilha_id
  ),
  taxas as (
    select planilha_id,
           coalesce(sum(valor) filter (where tipo = 'adm'), 0) as adm,
           coalesce(sum(valor) filter (where tipo = 'imp'), 0) as imp
    from public.planilha_percentuais group by planilha_id
  ),
  calc as (
    select b.*,
           (b.planilha_modo = 'guia' and b.nivel in ('ADM', 'I') and coalesce(t.adm, 0) > 0) as automatico,
           round(coalesce(n.af, 0) * coalesce(t.adm, 0) / 100, 2) as adm_af,
           round(coalesce(n.orc, 0) * coalesce(t.adm, 0) / 100, 2) as adm_orc,
           round(coalesce(n.fech, 0) * coalesce(t.adm, 0) / 100, 2) as adm_fech,
           coalesce(t.imp, 0) as taxa_imp
    from base b
    left join normais n on n.planilha_id = b.planilha_id
    left join taxas t on t.planilha_id = b.planilha_id
  ),
  final as (
    select c.*,
           case when not c.automatico then c.an_financeira
                when c.nivel = 'ADM' then c.adm_af else round(c.adm_af * c.taxa_imp / 100, 2) end as af_final,
           case when not c.automatico then c.orcamento
                when c.nivel = 'ADM' then c.adm_orc else round(c.adm_orc * c.taxa_imp / 100, 2) end as orc_final,
           case when not c.automatico then c.fech_apropriado
                when c.nivel = 'ADM' then c.adm_fech else round(c.adm_fech * c.taxa_imp / 100, 2) end as fech_final
    from calc c
  )
  select f.id, f.planilha_id, f.obra_id, f.codigo, f.descricao, f.nivel, f.ordem,
         f.af_final::numeric(14, 2) as an_financeira, f.orc_final::numeric(14, 2) as orcamento, f.verba_alocada, f.criado_em,
         f.planilha_nome, f.planilha_modo, f.planilha_seq,
         f.fech_final as fechamento,
         f.val_pago, f.pago_guia,
         f.fech_final - f.val_pago as a_pagar,
         f.orc_final - f.fech_final as meta
  from final f;

-- MPH Sistema — "Anexar OC x NF" como no AstroTools.
-- Fase Cinza (obra Fechado): Vincular OCXNF — Nota Fiscal ou Recibo, nº, série, vencimento, valor, arquivo.
-- Fase Azul (obra Administração): Vincular OC Adm — Tipo (BOLETO / NF / RECIBO / TRANSFERENCIA),
-- Nº nota/parcela, vencimento, tipo de pagamento, rateio entre os CCs da OC (limitado ao disponível),
-- dados bancários do favorecido (selo "Incompleto") e arquivos.
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run (depois da 0010).

alter table public.notas_fiscais
  add column if not exists tipo_documento text,
  add column if not exists tipo_pagamento text,
  add column if not exists favorecido_cpf_cnpj text,
  add column if not exists favorecido text,
  add column if not exists banco text,
  add column if not exists agencia text,
  add column if not exists conta text;

-- Rateio do lançamento entre os CCs da OC (Fase Azul).
create table if not exists public.nf_rateios (
  id bigint generated always as identity primary key,
  nota_fiscal_id bigint not null references public.notas_fiscais (id) on delete cascade,
  cc_id bigint not null references public.centros_custo (id),
  valor numeric(14, 2) not null check (valor > 0)
);
create index if not exists nf_rateios_nota on public.nf_rateios (nota_fiscal_id);
alter table public.nf_rateios enable row level security;
create policy nf_rateios_select on public.nf_rateios for select to authenticated using (public.usuario_ativo());

-- Quem anexa NF à OC: engenharia, suprimentos, financeiro e admin.
create or replace function public.pode_vincular_nf() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.meu_papel() in ('admin', 'engenharia', 'suprimentos', 'financeiro'), false)
$$;

-- OCs para vínculo: liberadas, com Valor, Utilizado e Disponível.
create or replace view public.ocs_vinculo with (security_invoker = true) as
  select r.id, r.obra_id, r.fornecedor_id, r.nome, r.numero_cliente, r.obra_nome, r.obra_regime, r.cliente_id, r.cliente_nome,
         r.fornecedor_nome, r.fornecedor_fantasia, r.valor_total, oc.saldo_zerado,
         coalesce((select sum(n.valor) from public.notas_fiscais n where n.ordem_compra_id = r.id and n.status <> 'cancelada'), 0) as utilizado,
         case when oc.saldo_zerado then 0
              else r.valor_total - coalesce((select sum(n.valor) from public.notas_fiscais n where n.ordem_compra_id = r.id and n.status <> 'cancelada'), 0) end as disponivel
  from public.ocs_resumo r
  join public.ordens_compra oc on oc.id = r.id
  where r.status = 'aprovada';

-- Zerar Saldo Pedido (redefinida): o apontado fica igual ao já utilizado em notas (pagas ou não).
create or replace function public.zerar_saldo_oc(p_oc bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_aprop numeric; v_usado numeric;
begin
  if not public.pode_editar_oc() and not public.pode_pagar() then raise exception 'Seu perfil não pode zerar o saldo.' using errcode = '42501'; end if;
  select coalesce(sum(valor), 0) into v_aprop from public.apropriacoes where origem = 'oc' and origem_id = p_oc;
  select coalesce(sum(valor), 0) into v_usado from public.notas_fiscais where ordem_compra_id = p_oc and status <> 'cancelada';
  if v_aprop > v_usado and v_aprop > 0 then
    update public.apropriacoes set valor = round(valor * v_usado / v_aprop, 2) where origem = 'oc' and origem_id = p_oc;
  end if;
  update public.ordens_compra set saldo_zerado = true where id = p_oc;
end $$;

-- ------------------------------------------------------------------
-- Fase Cinza: vincula Nota Fiscal ou Recibo à OC. Vai para "Aprovação NF" (engenharia).
-- p_dados: {numero, serie, tipo_documento ('NOTA FISCAL' | 'RECIBO'), vencimento, valor}
-- ------------------------------------------------------------------
create or replace function public.vincular_nf_cinza(p_oc bigint, p_dados jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_oc public.ocs_vinculo; v_valor numeric := (p_dados ->> 'valor')::numeric; v_id bigint;
begin
  if not public.pode_vincular_nf() then raise exception 'Seu perfil não pode vincular notas.' using errcode = '42501'; end if;
  select * into v_oc from public.ocs_vinculo where id = p_oc;
  if v_oc.id is null then raise exception 'A OC precisa estar liberada para receber notas.'; end if;
  if coalesce(trim(p_dados ->> 'numero'), '') = '' then raise exception 'Informe a Nota Fiscal.'; end if;
  if coalesce(p_dados ->> 'vencimento', '') = '' then raise exception 'Informe o Vencimento.'; end if;
  if coalesce(v_valor, 0) <= 0 then raise exception 'Informe o Valor.'; end if;
  if v_valor > v_oc.disponivel + 0.005 then
    raise exception 'O valor da nota (%) é maior que o valor pendente da OC (%).', public.valor_br(v_valor), public.valor_br(v_oc.disponivel);
  end if;
  insert into public.notas_fiscais (fase, ordem_compra_id, obra_id, fornecedor_id, numero, serie, tipo_documento, vencimento, valor, status)
  values ('cinza', p_oc, v_oc.obra_id, v_oc.fornecedor_id, trim(p_dados ->> 'numero'), coalesce(nullif(p_dados ->> 'serie', ''), '1'),
          coalesce(nullif(p_dados ->> 'tipo_documento', ''), 'NOTA FISCAL'), (p_dados ->> 'vencimento')::date, v_valor, 'aguardando_engenharia')
  returning id into v_id;
  return v_id;
end $$;

-- ------------------------------------------------------------------
-- Fase Azul: lançamento com rateio entre os CCs da OC. Vai para "Notas Pendentes Fase Azul".
-- p_dados: {numero (controle), tipo_documento, vencimento, tipo_pagamento}; p_rateio: [{cc_id, valor}]
-- ------------------------------------------------------------------
create or replace function public.vincular_nf_azul(p_oc bigint, p_dados jsonb, p_rateio jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_oc public.ocs_vinculo; v_total numeric; v_id bigint; r record; v_forn public.fornecedores;
begin
  if not public.pode_vincular_nf() then raise exception 'Seu perfil não pode vincular notas.' using errcode = '42501'; end if;
  select * into v_oc from public.ocs_vinculo where id = p_oc;
  if v_oc.id is null then raise exception 'A OC precisa estar liberada para receber lançamentos.'; end if;
  if coalesce(trim(p_dados ->> 'numero'), '') = '' then raise exception 'Informe o Nº Nota/Parcela.'; end if;
  if coalesce(p_dados ->> 'vencimento', '') = '' then raise exception 'Informe a Data de Vencimento.'; end if;
  if coalesce(trim(p_dados ->> 'tipo_pagamento'), '') = '' then raise exception 'Informe o Tipo Pagamento.'; end if;

  select coalesce(sum((x ->> 'valor')::numeric), 0) into v_total from jsonb_array_elements(p_rateio) x where coalesce((x ->> 'valor')::numeric, 0) > 0;
  if v_total <= 0 then raise exception 'Informe o valor do lançamento nos centros de custo.'; end if;
  if v_total > v_oc.disponivel + 0.005 then
    raise exception 'O valor do lançamento (%) é maior que o saldo pendente da OC (%).', public.valor_br(v_total), public.valor_br(v_oc.disponivel);
  end if;

  -- Cada CC não pode passar do seu disponível (apontado na OC − já rateado em lançamentos ativos).
  for r in
    select (x ->> 'cc_id')::bigint as cc_id, (x ->> 'valor')::numeric as valor from jsonb_array_elements(p_rateio) x where coalesce((x ->> 'valor')::numeric, 0) > 0
  loop
    if r.valor > coalesce((select sum(a.valor) from public.apropriacoes a where a.origem = 'oc' and a.origem_id = p_oc and a.cc_id = r.cc_id), 0)
                 - coalesce((select sum(t.valor) from public.nf_rateios t join public.notas_fiscais n on n.id = t.nota_fiscal_id
                              where n.ordem_compra_id = p_oc and n.status <> 'cancelada' and t.cc_id = r.cc_id), 0) + 0.005 then
      raise exception 'O valor rateado é maior que o valor disponivel, por favor, valide o valor inserido e tente novamente.';
    end if;
  end loop;

  select * into v_forn from public.fornecedores where id = v_oc.fornecedor_id;
  insert into public.notas_fiscais (fase, ordem_compra_id, obra_id, fornecedor_id, numero, serie, tipo_documento, vencimento, valor, status,
                                    tipo_pagamento, favorecido_cpf_cnpj, favorecido, banco, agencia, conta)
  values ('azul', p_oc, v_oc.obra_id, v_oc.fornecedor_id, trim(p_dados ->> 'numero'), 'P' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS'),
          coalesce(nullif(p_dados ->> 'tipo_documento', ''), 'NF'), (p_dados ->> 'vencimento')::date, v_total, 'aguardando_guia',
          trim(p_dados ->> 'tipo_pagamento'), coalesce(v_forn.banco_cnpj_favorecido, v_forn.cpf_cnpj), coalesce(v_forn.banco_favorecido, v_forn.nome),
          v_forn.banco, v_forn.agencia, v_forn.conta)
  returning id into v_id;

  insert into public.nf_rateios (nota_fiscal_id, cc_id, valor)
  select v_id, (x ->> 'cc_id')::bigint, round((x ->> 'valor')::numeric, 2) from jsonb_array_elements(p_rateio) x where coalesce((x ->> 'valor')::numeric, 0) > 0;
  return v_id;
end $$;

-- Editar lançamento (Fase Azul): controle, tipo, vencimento e tipo de pagamento.
create or replace function public.editar_lancamento_azul(p_id bigint, p_dados jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_vincular_nf() then raise exception 'Seu perfil não pode alterar lançamentos.' using errcode = '42501'; end if;
  update public.notas_fiscais
     set numero = coalesce(nullif(trim(p_dados ->> 'numero'), ''), numero), tipo_documento = coalesce(nullif(p_dados ->> 'tipo_documento', ''), tipo_documento),
         vencimento = coalesce(nullif(p_dados ->> 'vencimento', '')::date, vencimento), tipo_pagamento = coalesce(nullif(trim(p_dados ->> 'tipo_pagamento'), ''), tipo_pagamento)
   where id = p_id and status in ('aguardando_guia', 'aguardando_engenharia', 'reprovada');
  if not found then raise exception 'Lançamento já enviado em guia ou pago não pode ser alterado.'; end if;
end $$;

-- Dados bancários do favorecido do lançamento.
create or replace function public.editar_banco_lancamento(p_id bigint, p_dados jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_vincular_nf() then raise exception 'Seu perfil não pode alterar lançamentos.' using errcode = '42501'; end if;
  update public.notas_fiscais
     set favorecido_cpf_cnpj = nullif(trim(p_dados ->> 'cpf_cnpj'), ''), favorecido = nullif(trim(p_dados ->> 'favorecido'), ''),
         banco = nullif(trim(p_dados ->> 'banco'), ''), agencia = nullif(trim(p_dados ->> 'agencia'), ''), conta = nullif(trim(p_dados ->> 'conta'), '')
   where id = p_id and status not in ('paga', 'cancelada');
  if not found then raise exception 'Lançamento pago não pode ser alterado.'; end if;
end $$;

-- Excluir nota/lançamento ainda não pago nem em guia.
create or replace function public.excluir_lancamento_nf(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_vincular_nf() then raise exception 'Seu perfil não pode excluir notas.' using errcode = '42501'; end if;
  delete from public.notas_fiscais where id = p_id and status in ('aguardando_engenharia', 'reprovada', 'aguardando_guia', 'pendente_pagamento');
  if not found then raise exception 'Nota paga ou já enviada em guia não pode ser excluída.'; end if;
end $$;

-- MPH Sistema — Guias de Envio e Guias Adm como no AstroTools.
-- Cada obra tem UMA numeração de guias ("Guia Cliente") com dois tipos:
--   Normal: linhas de rateio dos lançamentos da Fase Azul que o cliente paga aos fornecedores (somam em "Pago Guia" do CC);
--   ADM:    a cobrança da MPH = Σ guias Normais escolhidas × Taxa ADM × (1 + Taxa IMP) da planilha de cada CC.
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run (depois da 0012).

create table if not exists public.guias (
  id bigint generated always as identity primary key,
  obra_id bigint not null references public.obras (id) on delete cascade,
  numero int not null,
  tipo text not null check (tipo in ('normal', 'adm')),
  -- Guia ADM
  controle_parcela text,
  conta_faturamento text,
  vencimento date,
  tipo_documento text,
  tipo_pagamento text,
  valor_adm numeric(14, 2) not null default 0,
  pago boolean not null default false,
  data_pagamento date,
  pago_por uuid references public.perfis (id),
  -- Guia Normal cobrada numa Guia ADM
  guia_adm_id bigint references public.guias (id) on delete set null,
  criado_por uuid references public.perfis (id) default auth.uid(),
  criado_em timestamptz not null default now(),
  unique (obra_id, numero)
);
create index if not exists guias_adm_idx on public.guias (guia_adm_id);

create table if not exists public.guia_itens (
  id bigint generated always as identity primary key,
  guia_id bigint not null references public.guias (id) on delete cascade,
  rateio_id bigint not null unique references public.nf_rateios (id) on delete cascade,
  criado_por uuid references public.perfis (id) default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists guia_itens_guia on public.guia_itens (guia_id);

alter table public.guias enable row level security;
alter table public.guia_itens enable row level security;
drop policy if exists guias_select on public.guias;
create policy guias_select on public.guias for select to authenticated using (public.usuario_ativo());
drop policy if exists guia_itens_select on public.guia_itens;
create policy guia_itens_select on public.guia_itens for select to authenticated using (public.usuario_ativo());

-- As notas da Fase Azul passam a apontar para a guia de envio (antes: guias_adm da versão antiga).
update public.notas_fiscais set status = 'aguardando_guia' where fase = 'azul' and status = 'em_guia';
update public.notas_fiscais set guia_id = null where guia_id is not null;
alter table public.notas_fiscais drop constraint if exists notas_fiscais_guia_id_fkey;
alter table public.notas_fiscais add constraint notas_fiscais_guia_id_fkey foreign key (guia_id) references public.guias (id) on delete set null;
drop function if exists public.criar_guia(bigint, bigint[], text);
drop function if exists public.atualizar_guia(bigint, text, date, boolean);

-- Linhas de rateio (nota × CC) com os dados que a Guia de Envio mostra.
create or replace view public.guia_rateios with (security_invoker = true) as
  select r.id as rateio_id, r.valor, r.cc_id, cc.codigo as cc_codigo, cc.planilha_id,
         n.id as nota_id, n.numero, n.tipo_documento, n.tipo_pagamento, n.vencimento, n.status as nota_status, n.obra_id,
         n.favorecido_cpf_cnpj, n.favorecido, n.banco, n.agencia, n.conta,
         oc.id as pedido, oc.numero_cliente as pedido_cliente, oc.nome as pedido_nome,
         coalesce(f.nome_fantasia, f.nome) as fornecedor_nome,
         gi.id as item_id, gi.guia_id,
         (select count(*) from public.nf_anexos a where a.nota_fiscal_id = n.id) as anexos
  from public.nf_rateios r
  join public.notas_fiscais n on n.id = r.nota_fiscal_id and n.fase = 'azul' and n.status <> 'cancelada'
  join public.centros_custo cc on cc.id = r.cc_id
  left join public.ordens_compra oc on oc.id = n.ordem_compra_id
  join public.fornecedores f on f.id = n.fornecedor_id
  left join public.guia_itens gi on gi.rateio_id = r.id;

-- Taxas da planilha: Administração e Imposto (em %).
create or replace function public.taxas_planilha(p_planilha bigint, out adm numeric, out imp numeric)
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(valor) filter (where tipo = 'adm'), 0), coalesce(sum(valor) filter (where tipo = 'imp'), 0)
  from public.planilha_percentuais where planilha_id = p_planilha
$$;

-- "Cálculo Administração de Obra" da Guia ADM, por planilha:
-- Administração = Σ guias de envio × Taxa ADM; Imposto = Administração × Taxa IMP.
create or replace view public.guia_adm_calculo with (security_invoker = true) as
  select x.guia_adm_id, x.planilha_id, p.nome as planilha_nome, t.adm as taxa_adm, t.imp as taxa_imp, x.base,
         round(x.base * t.adm / 100, 2) as administracao,
         round(round(x.base * t.adm / 100, 2) * t.imp / 100, 2) as imposto,
         (select c.codigo from public.centros_custo c where c.planilha_id = x.planilha_id and c.nivel = 'ADM' order by c.ordem, c.codigo limit 1) as cc_adm,
         (select c.codigo from public.centros_custo c where c.planilha_id = x.planilha_id and c.nivel = 'I' order by c.ordem, c.codigo limit 1) as cc_imp
  from (select g.guia_adm_id, cc.planilha_id, sum(r.valor) as base
          from public.guias g
          join public.guia_itens gi on gi.guia_id = g.id
          join public.nf_rateios r on r.id = gi.rateio_id
          join public.centros_custo cc on cc.id = r.cc_id
         where g.guia_adm_id is not null
         group by g.guia_adm_id, cc.planilha_id) x
  join public.planilhas p on p.id = x.planilha_id
  cross join lateral public.taxas_planilha(x.planilha_id) t;

create or replace view public.guias_lista with (security_invoker = true) as
  select g.*, o.nome as obra_nome,
         case when g.tipo = 'adm' then g.valor_adm
              else coalesce((select sum(r.valor) from public.guia_itens gi join public.nf_rateios r on r.id = gi.rateio_id where gi.guia_id = g.id), 0) end as valor,
         a.numero as guia_adm_numero
  from public.guias g
  join public.obras o on o.id = g.obra_id
  left join public.guias a on a.id = g.guia_adm_id;

-- Notas: número da guia de envio na listagem (coluna "Guia Envio").
create or replace view public.notas_lista with (security_invoker = true) as
  select n.id, n.fase, n.status, n.numero, n.serie, n.tipo_documento, n.vencimento, n.valor, n.criado_em, n.pago_em,
         n.pagamento_forcado, n.guia_id, n.ordem_compra_id, n.obra_id, n.fornecedor_id, n.tipo_pagamento,
         o.nome as obra_nome, o.cliente_id, c.nome as cliente_nome,
         oc.numero_cliente as pedido, oc.nome as pedido_nome,
         coalesce(f.nome_fantasia, f.nome) as fornecedor_nome,
         pp.nome as pago_por_nome, pr.nome as registrado_por_nome,
         (select count(*) from public.nf_anexos a where a.nota_fiscal_id = n.id) as anexos,
         g.numero as guia_numero
  from public.notas_fiscais n
  join public.obras o on o.id = n.obra_id
  left join public.clientes c on c.id = o.cliente_id
  left join public.ordens_compra oc on oc.id = n.ordem_compra_id
  join public.fornecedores f on f.id = n.fornecedor_id
  left join public.perfis pp on pp.id = n.pago_por
  left join public.perfis pr on pr.id = n.registrado_por
  left join public.guias g on g.id = n.guia_id;

create or replace function public.proximo_numero_guia(p_obra bigint) returns int
language sql volatile security definer set search_path = '' as $$
  select coalesce(max(numero), 0) + 1 from public.guias where obra_id = p_obra
$$;

-- Situação da nota conforme suas linhas de rateio: todas em guia = paga (Notas Pagas Fase Azul).
create or replace function public.atualizar_situacao_nota_guia(p_nota bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_total int; v_em_guia int; v_guia bigint;
begin
  select count(*), count(gi.id), max(gi.guia_id) into v_total, v_em_guia, v_guia
    from public.nf_rateios r left join public.guia_itens gi on gi.rateio_id = r.id where r.nota_fiscal_id = p_nota;
  if v_total > 0 and v_em_guia = v_total then
    update public.notas_fiscais set status = 'paga', guia_id = v_guia, pago_em = coalesce(pago_em, current_date), pago_por = coalesce(pago_por, auth.uid())
     where id = p_nota;
  else
    update public.notas_fiscais set status = 'aguardando_guia', guia_id = v_guia, pago_em = null, pago_por = null
     where id = p_nota and status in ('paga', 'em_guia', 'aguardando_guia');
  end if;
end $$;

-- "Confirma a geração de uma nova Guia de Envio?"
create or replace function public.criar_guia_envio(p_obra bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if not public.pode_pagar() then raise exception 'Só o financeiro gera guias.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('guias'), p_obra::int);
  insert into public.guias (obra_id, numero, tipo) values (p_obra, public.proximo_numero_guia(p_obra), 'normal') returning id into v_id;
  return v_id;
end $$;

-- Guia de Envio → "Salvar": adiciona uma linha de rateio pendente da obra.
create or replace function public.adicionar_item_guia(p_guia bigint, p_rateio bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_g public.guias; v_r record; v_item bigint;
begin
  if not public.pode_pagar() then raise exception 'Só o financeiro altera guias.' using errcode = '42501'; end if;
  select * into v_g from public.guias where id = p_guia for update;
  if v_g.id is null or v_g.tipo <> 'normal' then raise exception 'Guia de envio não encontrada.'; end if;
  if v_g.guia_adm_id is not null then raise exception 'Esta guia já foi cobrada na Guia ADM % e não pode ser alterada.', (select numero from public.guias where id = v_g.guia_adm_id); end if;
  select * into v_r from public.guia_rateios where rateio_id = p_rateio;
  if v_r.rateio_id is null or v_r.obra_id <> v_g.obra_id or v_r.nota_status not in ('aguardando_engenharia', 'aguardando_guia') then
    raise exception 'Nota indisponível para esta guia.';
  end if;
  if v_r.item_id is not null then raise exception 'Esta nota já está em outra guia.'; end if;

  insert into public.guia_itens (guia_id, rateio_id) values (p_guia, p_rateio) returning id into v_item;
  insert into public.pagamentos_cc (cc_id, modo, origem, origem_id, valor, data) values (v_r.cc_id, 'guia', 'guia_item', v_item, v_r.valor, current_date);
  perform public.atualizar_situacao_nota_guia(v_r.nota_id);
end $$;

-- "Confirma a Exclusão? NF: … Valor: R$ …"
create or replace function public.excluir_item_guia(p_item bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_nota bigint; v_g public.guias;
begin
  if not public.pode_pagar() then raise exception 'Só o financeiro altera guias.' using errcode = '42501'; end if;
  select g.* into v_g from public.guias g join public.guia_itens gi on gi.guia_id = g.id where gi.id = p_item;
  if v_g.id is null then raise exception 'Item não encontrado.'; end if;
  if v_g.guia_adm_id is not null then raise exception 'Esta guia já foi cobrada numa Guia ADM e não pode ser alterada.'; end if;
  select r.nota_fiscal_id into v_nota from public.guia_itens gi join public.nf_rateios r on r.id = gi.rateio_id where gi.id = p_item;
  delete from public.pagamentos_cc where origem = 'guia_item' and origem_id = p_item;
  delete from public.guia_itens where id = p_item;
  perform public.atualizar_situacao_nota_guia(v_nota);
end $$;

-- Guias Adm → "Nova Guia" (modal Adicionar Guia) e "Alterar dados Guia".
create or replace function public.salvar_guia_adm(p_obra bigint, p_id bigint, p_dados jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint := p_id;
begin
  if not public.pode_pagar() then raise exception 'Só o financeiro gera guias.' using errcode = '42501'; end if;
  if coalesce(trim(p_dados ->> 'controle_parcela'), '') = '' then raise exception 'Informe o N°Controle/Parcela.'; end if;
  if coalesce(p_dados ->> 'vencimento', '') = '' then raise exception 'Informe a Data Validade.'; end if;
  if coalesce(trim(p_dados ->> 'tipo_pagamento'), '') = '' then raise exception 'Informe o Tipo Pagamento.'; end if;
  if v_id is null then
    perform pg_advisory_xact_lock(hashtext('guias'), p_obra::int);
    insert into public.guias (obra_id, numero, tipo) values (p_obra, public.proximo_numero_guia(p_obra), 'adm') returning id into v_id;
  end if;
  update public.guias
     set controle_parcela = trim(p_dados ->> 'controle_parcela'),
         conta_faturamento = coalesce(nullif(p_dados ->> 'conta_faturamento', ''), 'MPH ENGENHARIA LTDA'),
         vencimento = (p_dados ->> 'vencimento')::date,
         tipo_documento = coalesce(nullif(p_dados ->> 'tipo_documento', ''), 'NF'),
         tipo_pagamento = trim(p_dados ->> 'tipo_pagamento')
   where id = v_id and tipo = 'adm';
  if not found then raise exception 'Guia ADM não encontrada.'; end if;
  return v_id;
end $$;

create or replace function public.recalcular_guia_adm(p_adm bigint) returns void
language sql security definer set search_path = '' as $$
  update public.guias a set valor_adm = coalesce((select sum(c.administracao + c.imposto) from public.guia_adm_calculo c where c.guia_adm_id = a.id), 0)
   where a.id = p_adm
$$;

-- Guia de Adm → "Adicionar" uma guia de envio Normal.
create or replace function public.adicionar_guia_na_adm(p_adm bigint, p_guia bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_a public.guias; v_g public.guias;
begin
  if not public.pode_pagar() then raise exception 'Só o financeiro altera guias.' using errcode = '42501'; end if;
  select * into v_a from public.guias where id = p_adm for update;
  select * into v_g from public.guias where id = p_guia for update;
  if v_a.id is null or v_a.tipo <> 'adm' then raise exception 'Guia ADM não encontrada.'; end if;
  if v_a.pago then raise exception 'Guia ADM já paga não pode ser alterada.'; end if;
  if v_g.id is null or v_g.tipo <> 'normal' or v_g.obra_id <> v_a.obra_id then raise exception 'Selecione uma guia de envio desta obra.'; end if;
  if v_g.guia_adm_id is not null then raise exception 'Esta guia já está na Guia ADM %.', (select numero from public.guias where id = v_g.guia_adm_id); end if;
  update public.guias set guia_adm_id = p_adm where id = p_guia;
  perform public.recalcular_guia_adm(p_adm);
end $$;

-- "Confirma a Exclusão da Guia: …" (tira a guia de envio da Guia ADM).
create or replace function public.remover_guia_da_adm(p_guia bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_adm bigint;
begin
  if not public.pode_pagar() then raise exception 'Só o financeiro altera guias.' using errcode = '42501'; end if;
  select guia_adm_id into v_adm from public.guias where id = p_guia;
  if v_adm is null then raise exception 'A guia não está em uma Guia ADM.'; end if;
  if (select pago from public.guias where id = v_adm) then raise exception 'Guia ADM já paga não pode ser alterada.'; end if;
  update public.guias set guia_adm_id = null where id = p_guia;
  perform public.recalcular_guia_adm(v_adm);
end $$;

-- Consulta Guias → "Confirma o pagamento da Guia de Administração?" / "Confirma a exclução do pagamento…".
create or replace function public.pagar_guia_adm(p_id bigint, p_pagar boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_pagar() then raise exception 'Só o financeiro confirma pagamentos.' using errcode = '42501'; end if;
  update public.guias
     set pago = p_pagar, data_pagamento = case when p_pagar then current_date end, pago_por = case when p_pagar then auth.uid() end
   where id = p_id and tipo = 'adm' and pago = not p_pagar;
  if not found then raise exception 'A guia não está em uma situação que permita essa ação.'; end if;
end $$;

-- Excluir lançamento (redefinida): não deixa excluir lançamento com linha já enviada em guia.
create or replace function public.excluir_lancamento_nf(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_vincular_nf() then raise exception 'Seu perfil não pode excluir notas.' using errcode = '42501'; end if;
  if exists (select 1 from public.guia_itens gi join public.nf_rateios r on r.id = gi.rateio_id where r.nota_fiscal_id = p_id) then
    raise exception 'Lançamento já enviado em guia não pode ser excluído.';
  end if;
  delete from public.notas_fiscais where id = p_id and status in ('aguardando_engenharia', 'reprovada', 'aguardando_guia', 'pendente_pagamento');
  if not found then raise exception 'Nota paga ou já enviada em guia não pode ser excluída.'; end if;
end $$;

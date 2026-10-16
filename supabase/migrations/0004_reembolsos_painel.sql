-- MPH Sistema — fase 4: Ordens de Reembolso e visões dos dashboards.
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run.
--
-- Reembolso: rascunho → aguardando_aprovacao → (engenharia) aprovada → (financeiro) paga
-- O pagamento consome a verba da obra, como as notas da Fase Cinza.

-- ============================================================
-- Ordens de reembolso
-- ============================================================
create type public.status_reembolso as enum ('rascunho', 'aguardando_aprovacao', 'aprovada', 'reprovada', 'paga', 'cancelada');

create table public.ordens_reembolso (
  id bigint generated always as identity primary key,
  obra_id bigint not null references public.obras (id),
  filial text,
  fornecedor_id bigint not null references public.fornecedores (id),
  cpf_cnpj text not null,
  banco text not null,
  agencia text not null,
  conta text not null,
  observacao text,
  status public.status_reembolso not null default 'rascunho',
  aprovado_por uuid references public.perfis (id),
  aprovado_em timestamptz,
  justificativa text,
  pago_em date,
  pago_por uuid references public.perfis (id),
  pagamento_forcado boolean not null default false,
  criado_por uuid references public.perfis (id) default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on public.ordens_reembolso (status);
create index on public.ordens_reembolso (obra_id);

create table public.reembolso_itens (
  id bigint generated always as identity primary key,
  reembolso_id bigint not null references public.ordens_reembolso (id) on delete cascade,
  ordem int not null default 0,
  descricao text not null,
  apropriacao text,
  tipo text,
  data date,
  valor numeric(14, 2) not null check (valor > 0)
);
create index on public.reembolso_itens (reembolso_id);

create trigger t_reembolsos_upd before update on public.ordens_reembolso for each row execute function public.set_atualizado_em();

create view public.reembolsos_resumo with (security_invoker = true) as
  select r.*, o.codigo as obra_codigo, o.nome as obra_nome, c.nome as cliente_nome,
         f.nome as fornecedor_nome, pc.nome as criado_por_nome, pa.nome as aprovado_por_nome, pp.nome as pago_por_nome,
         coalesce((select sum(i.valor) from public.reembolso_itens i where i.reembolso_id = r.id), 0) as valor_total,
         (select count(*) from public.reembolso_itens i where i.reembolso_id = r.id) as qtd_itens
  from public.ordens_reembolso r
  join public.obras o on o.id = r.obra_id
  left join public.clientes c on c.id = o.cliente_id
  join public.fornecedores f on f.id = r.fornecedor_id
  left join public.perfis pc on pc.id = r.criado_por
  left join public.perfis pa on pa.id = r.aprovado_por
  left join public.perfis pp on pp.id = r.pago_por;

-- ============================================================
-- Verba da obra: passa a considerar os reembolsos
-- ============================================================
create or replace view public.obras_verba with (security_invoker = true) as
  with
    ap as (select obra_id, sum(valor) as v from public.obra_aportes group by obra_id),
    nf_pago as (select obra_id, sum(valor) as v from public.notas_fiscais where fase = 'cinza' and status = 'paga' group by obra_id),
    nf_aberto as (select obra_id, sum(valor) as v from public.notas_fiscais
                  where fase = 'cinza' and status in ('aguardando_engenharia', 'pendente_pagamento') group by obra_id),
    re as (select r.obra_id, r.status, sum(i.valor) as v from public.ordens_reembolso r
           join public.reembolso_itens i on i.reembolso_id = r.id group by r.obra_id, r.status)
  select o.id as obra_id, o.codigo, o.nome, o.ativo, c.nome as cliente_nome,
         coalesce(ap.v, 0) as aportes,
         coalesce(nf_pago.v, 0) + coalesce((select sum(v) from re where re.obra_id = o.id and re.status = 'paga'), 0) as pago,
         coalesce(nf_aberto.v, 0) + coalesce((select sum(v) from re where re.obra_id = o.id and re.status in ('aguardando_aprovacao', 'aprovada')), 0) as a_pagar,
         coalesce(ap.v, 0) - coalesce(nf_pago.v, 0) - coalesce((select sum(v) from re where re.obra_id = o.id and re.status = 'paga'), 0) as disponivel
  from public.obras o
  left join public.clientes c on c.id = o.cliente_id
  left join ap on ap.obra_id = o.id
  left join nf_pago on nf_pago.obra_id = o.id
  left join nf_aberto on nf_aberto.obra_id = o.id;

-- ============================================================
-- Painel por obra (dashboards Início e Financeiro)
-- ============================================================
create view public.painel_obras with (security_invoker = true) as
  select o.id as obra_id, o.codigo, o.nome, o.ativo, o.ano, o.regime, o.status, o.tipo_obra, o.metragem,
         o.inicio, o.termino, o.entrega_prevista, o.engenheiro, o.orcamentista, o.suprimento,
         o.valor_total, o.taxa_adm_analise_financeira, o.taxa_adm_analise_orcamento,
         c.nome as cliente_nome,
         v.aportes, v.pago, v.a_pagar, v.disponivel,
         -- Fase Cinza
         coalesce((select sum(n.valor) from public.notas_fiscais n where n.obra_id = o.id and n.fase = 'cinza' and n.status = 'pendente_pagamento'), 0)
           + coalesce((select sum(i.valor) from public.ordens_reembolso r join public.reembolso_itens i on i.reembolso_id = r.id
                       where r.obra_id = o.id and r.status = 'aprovada'), 0) as pagamentos_pendentes,
         (select count(*) from public.ordens_compra oc
           where oc.obra_id = o.id and oc.status in ('rascunho', 'aguardando_aprovacao', 'aprovada')
             and exists (select 1 from public.fornecedor_bloqueios b where b.fornecedor_id = oc.fornecedor_id and b.desbloqueado_em is null)) as ocs_bloqueadas,
         coalesce((select sum(r.valor_total) from public.ordens_compra_resumo r where r.obra_id = o.id and r.status = 'aprovada'), 0) as ocs_aprovadas,
         -- Fase Azul
         coalesce((select sum(n.valor) from public.notas_fiscais n where n.obra_id = o.id and n.fase = 'azul' and n.status in ('aguardando_engenharia', 'aguardando_guia')), 0) as azul_pendente_guia,
         coalesce((select sum(n.valor) from public.notas_fiscais n where n.obra_id = o.id and n.fase = 'azul' and n.status = 'em_guia'), 0) as azul_em_guia,
         coalesce((select sum(n.valor) from public.notas_fiscais n where n.obra_id = o.id and n.fase = 'azul' and n.status = 'paga'), 0) as azul_pago,
         -- Administração prevista sobre o valor da obra
         round(coalesce(o.valor_total, 0) * coalesce(o.taxa_adm_analise_financeira, 0) / 100, 2) as adm_prevista
  from public.obras o
  left join public.clientes c on c.id = o.cliente_id
  join public.obras_verba v on v.obra_id = o.id;

-- ============================================================
-- Funções de negócio
-- ============================================================
create function public.salvar_reembolso(p_id bigint, p_dados jsonb, p_itens jsonb) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare v_id bigint;
begin
  if not public.usuario_ativo() then raise exception 'Usuário sem acesso.' using errcode = '42501'; end if;
  if jsonb_array_length(coalesce(p_itens, '[]')) = 0 then raise exception 'Inclua ao menos um item.'; end if;
  if coalesce(p_dados ->> 'cpf_cnpj', '') = '' or coalesce(p_dados ->> 'banco', '') = ''
     or coalesce(p_dados ->> 'agencia', '') = '' or coalesce(p_dados ->> 'conta', '') = '' then
    raise exception 'Informe CPF/CNPJ, banco, agência e conta do favorecido.';
  end if;

  if p_id is null then
    insert into public.ordens_reembolso (obra_id, filial, fornecedor_id, cpf_cnpj, banco, agencia, conta, observacao)
    values ((p_dados ->> 'obra_id')::bigint, nullif(p_dados ->> 'filial', ''), (p_dados ->> 'fornecedor_id')::bigint,
            p_dados ->> 'cpf_cnpj', p_dados ->> 'banco', p_dados ->> 'agencia', p_dados ->> 'conta', nullif(p_dados ->> 'observacao', ''))
    returning id into v_id;
  else
    update public.ordens_reembolso
       set obra_id = (p_dados ->> 'obra_id')::bigint, filial = nullif(p_dados ->> 'filial', ''),
           fornecedor_id = (p_dados ->> 'fornecedor_id')::bigint, cpf_cnpj = p_dados ->> 'cpf_cnpj', banco = p_dados ->> 'banco',
           agencia = p_dados ->> 'agencia', conta = p_dados ->> 'conta', observacao = nullif(p_dados ->> 'observacao', ''),
           status = 'rascunho', aprovado_por = null, aprovado_em = null, justificativa = null
     where id = p_id and status in ('rascunho', 'reprovada')
    returning id into v_id;
    if v_id is null then raise exception 'Só reembolsos em rascunho ou reprovados podem ser editados.'; end if;
    delete from public.reembolso_itens where reembolso_id = v_id;
  end if;

  insert into public.reembolso_itens (reembolso_id, ordem, descricao, apropriacao, tipo, data, valor)
  select v_id, ord, i ->> 'descricao', nullif(i ->> 'apropriacao', ''), nullif(i ->> 'tipo', ''),
         nullif(i ->> 'data', '')::date, (i ->> 'valor')::numeric
  from jsonb_array_elements(p_itens) with ordinality as t(i, ord);
  return v_id;
end $$;

create function public.enviar_reembolso(p_id bigint) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.ordens_reembolso set status = 'aguardando_aprovacao' where id = p_id and status in ('rascunho', 'reprovada');
  if not found then raise exception 'O reembolso precisa estar em rascunho ou reprovado.'; end if;
end $$;

create function public.decidir_reembolso(p_id bigint, p_aprovado boolean, p_justificativa text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_aprovar_nf() then raise exception 'Só a engenharia aprova reembolsos.' using errcode = '42501'; end if;
  if not p_aprovado and coalesce(trim(p_justificativa), '') = '' then raise exception 'Informe a justificativa da reprovação.'; end if;
  update public.ordens_reembolso
     set status = case when p_aprovado then 'aprovada'::public.status_reembolso else 'reprovada'::public.status_reembolso end,
         aprovado_por = auth.uid(), aprovado_em = now(), justificativa = nullif(trim(p_justificativa), '')
   where id = p_id and status = 'aguardando_aprovacao';
  if not found then raise exception 'Este reembolso não está aguardando aprovação.'; end if;
end $$;

create function public.pagar_reembolso(p_id bigint, p_data date, p_forcar boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare v_r record; v_disp numeric;
begin
  if not public.pode_pagar() then raise exception 'Só o financeiro efetiva pagamentos.' using errcode = '42501'; end if;
  select id, obra_id, status, valor_total into v_r from public.reembolsos_resumo where id = p_id;
  if v_r.id is null or v_r.status <> 'aprovada' then raise exception 'Este reembolso não está aprovado para pagamento.'; end if;

  select disponivel into v_disp from public.obras_verba where obra_id = v_r.obra_id;
  if coalesce(v_disp, 0) < v_r.valor_total and not p_forcar then
    raise exception 'VERBA_INSUFICIENTE: verba disponível da obra R$ %, reembolso R$ %.',
      to_char(coalesce(v_disp, 0), 'FM999G999G990D00'), to_char(v_r.valor_total, 'FM999G999G990D00');
  end if;

  update public.ordens_reembolso
     set status = 'paga', pago_em = coalesce(p_data, current_date), pago_por = auth.uid(),
         pagamento_forcado = coalesce(v_disp, 0) < v_r.valor_total
   where id = p_id;
end $$;

create function public.cancelar_reembolso(p_id bigint) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.ordens_reembolso set status = 'cancelada' where id = p_id and status in ('rascunho', 'aguardando_aprovacao', 'reprovada', 'aprovada');
  if not found then raise exception 'Reembolsos pagos não podem ser cancelados.'; end if;
end $$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.ordens_reembolso enable row level security;
alter table public.reembolso_itens enable row level security;

create policy ordens_reembolso_select on public.ordens_reembolso for select to authenticated using (public.usuario_ativo());
create policy reembolso_itens_select on public.reembolso_itens for select to authenticated using (public.usuario_ativo());

-- Qualquer usuário ativo cria; edita/envia/cancela o autor ou quem lança notas.
create policy ordens_reembolso_insert on public.ordens_reembolso for insert to authenticated with check (public.usuario_ativo());
create policy ordens_reembolso_update on public.ordens_reembolso for update to authenticated
  using (public.pode_lancar_nf() or criado_por = auth.uid());
create policy reembolso_itens_write on public.reembolso_itens for all to authenticated
  using (exists (select 1 from public.ordens_reembolso r where r.id = reembolso_id and (public.pode_lancar_nf() or r.criado_por = auth.uid())))
  with check (exists (select 1 from public.ordens_reembolso r where r.id = reembolso_id and (public.pode_lancar_nf() or r.criado_por = auth.uid())));

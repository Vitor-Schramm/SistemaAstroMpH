-- MPH Sistema — Ordem de Reembolso como no AstroTools.
-- Fluxo: itens (Item, Apropriação, Tipo, Data, Valor) → Apropriações por CC (a partir da 1ª apropriação a ordem trava)
-- → com o total apropriado, "Efetivar Solicitação" envia ao Financeiro: gera uma nota (nº = timestamp, série 1,
-- tipo REEMBOLSO) que entra em Pagamentos Pendentes (obra Fechada/Completa) ou Notas Pendentes Fase Azul (Administração),
-- rateada pelas apropriações. A lista mostra "NF Emitida" = S depois do envio.
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run (depois da 0013).

alter table public.ordens_reembolso
  add column if not exists filial_cliente_id bigint references public.clientes (id),
  add column if not exists solicitacao_enviada boolean not null default false,
  add column if not exists enviada_em timestamptz,
  add column if not exists enviada_por uuid references public.perfis (id);

create table if not exists public.reembolso_arquivos (
  id bigint generated always as identity primary key,
  reembolso_id bigint not null references public.ordens_reembolso (id) on delete cascade,
  caminho text not null,
  nome text not null,
  tamanho bigint,
  enviado_por uuid references public.perfis (id) default auth.uid(),
  enviado_em timestamptz not null default now()
);
alter table public.reembolso_arquivos enable row level security;
drop policy if exists reembolso_arquivos_select on public.reembolso_arquivos;
create policy reembolso_arquivos_select on public.reembolso_arquivos for select to authenticated using (public.usuario_ativo());
drop policy if exists reembolso_arquivos_write on public.reembolso_arquivos;
create policy reembolso_arquivos_write on public.reembolso_arquivos for all to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());

insert into storage.buckets (id, name, public, file_size_limit)
values ('reembolso-arquivos', 'reembolso-arquivos', false, 20971520)
on conflict (id) do nothing;
drop policy if exists reembolso_arquivos_ler on storage.objects;
create policy reembolso_arquivos_ler on storage.objects for select to authenticated using (bucket_id = 'reembolso-arquivos' and public.usuario_ativo());
drop policy if exists reembolso_arquivos_enviar on storage.objects;
create policy reembolso_arquivos_enviar on storage.objects for insert to authenticated with check (bucket_id = 'reembolso-arquivos' and public.usuario_ativo());
drop policy if exists reembolso_arquivos_apagar on storage.objects;
create policy reembolso_arquivos_apagar on storage.objects for delete to authenticated using (bucket_id = 'reembolso-arquivos' and public.usuario_ativo());

-- A nota gerada pelo reembolso não tem OC.
alter table public.notas_fiscais alter column ordem_compra_id drop not null;
alter table public.notas_fiscais add column if not exists ordem_reembolso_id bigint references public.ordens_reembolso (id) on delete set null;

-- Quem cria e altera reembolsos: engenharia, suprimentos, financeiro e admin.
create or replace function public.pode_editar_reembolso() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.meu_papel() in ('admin', 'engenharia', 'suprimentos', 'financeiro'), false)
$$;

create or replace function public.total_reembolso(p_id bigint) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(valor), 0) from public.reembolso_itens where reembolso_id = p_id
$$;

create or replace view public.reembolsos_lista with (security_invoker = true) as
  select r.id, r.obra_id, r.filial_cliente_id, r.fornecedor_id, r.cpf_cnpj, r.banco, r.agencia, r.conta, r.observacao,
         r.solicitacao_enviada, r.enviada_em, r.criado_em, r.criado_por,
         o.nome as obra_nome, o.regime as obra_regime, o.cliente_id, c.nome as cliente_nome,
         f.nome as fornecedor_nome, f.nome_fantasia as fornecedor_fantasia,
         public.total_reembolso(r.id) as valor_total,
         coalesce((select sum(a.valor) from public.apropriacoes a where a.origem = 'reembolso' and a.origem_id = r.id), 0) as apropriado
  from public.ordens_reembolso r
  join public.obras o on o.id = r.obra_id
  left join public.clientes c on c.id = o.cliente_id
  join public.fornecedores f on f.id = r.fornecedor_id
  where r.status <> 'cancelada';

-- "Salvar": cria ou altera a ordem e os itens (só enquanto não há apropriações).
create or replace function public.salvar_reembolso_original(p_id bigint, p_dados jsonb, p_itens jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint := p_id; v_obra bigint := (p_dados ->> 'obra_id')::bigint;
begin
  if not public.pode_editar_reembolso() then raise exception 'Seu perfil não pode alterar ordens de reembolso.' using errcode = '42501'; end if;
  if v_obra is null then raise exception 'Selecione a Obra.'; end if;
  if coalesce(p_dados ->> 'fornecedor_id', '') = '' then raise exception 'Selecione o Fornecedor.'; end if;
  if coalesce(trim(p_dados ->> 'cpf_cnpj'), '') = '' or coalesce(trim(p_dados ->> 'banco'), '') = ''
     or coalesce(trim(p_dados ->> 'agencia'), '') = '' or coalesce(trim(p_dados ->> 'conta'), '') = '' then
    raise exception 'Informe CPF/CNPJ, Banco, Agência e Conta.';
  end if;
  if not exists (select 1 from jsonb_array_elements(p_itens) x where coalesce(trim(x ->> 'descricao'), '') <> '' and coalesce((x ->> 'valor')::numeric, 0) > 0) then
    raise exception 'Informe ao menos um item com valor.';
  end if;

  if v_id is null then
    insert into public.ordens_reembolso (obra_id, filial_cliente_id, fornecedor_id, cpf_cnpj, banco, agencia, conta, observacao, status)
    values (v_obra, nullif(p_dados ->> 'filial_cliente_id', '')::bigint, (p_dados ->> 'fornecedor_id')::bigint, trim(p_dados ->> 'cpf_cnpj'),
            trim(p_dados ->> 'banco'), trim(p_dados ->> 'agencia'), trim(p_dados ->> 'conta'), nullif(trim(p_dados ->> 'observacao'), ''), 'rascunho')
    returning id into v_id;
  else
    if exists (select 1 from public.ordens_reembolso where id = v_id and solicitacao_enviada) then raise exception 'Solicitação já enviada ao Financeiro.'; end if;
    if exists (select 1 from public.apropriacoes where origem = 'reembolso' and origem_id = v_id) then
      raise exception 'Ordem com apropriações não pode ser alterada. Exclua as apropriações primeiro.';
    end if;
    update public.ordens_reembolso
       set obra_id = v_obra, filial_cliente_id = nullif(p_dados ->> 'filial_cliente_id', '')::bigint, fornecedor_id = (p_dados ->> 'fornecedor_id')::bigint,
           cpf_cnpj = trim(p_dados ->> 'cpf_cnpj'), banco = trim(p_dados ->> 'banco'), agencia = trim(p_dados ->> 'agencia'), conta = trim(p_dados ->> 'conta'),
           observacao = nullif(trim(p_dados ->> 'observacao'), '')
     where id = v_id;
    if not found then raise exception 'Ordem de reembolso não encontrada.'; end if;
    delete from public.reembolso_itens where reembolso_id = v_id;
  end if;

  insert into public.reembolso_itens (reembolso_id, ordem, descricao, apropriacao, tipo, data, valor)
  select v_id, x.n, trim(x.v ->> 'descricao'), nullif(trim(x.v ->> 'apropriacao'), ''), nullif(trim(x.v ->> 'tipo'), ''),
         nullif(x.v ->> 'data', '')::date, round((x.v ->> 'valor')::numeric, 2)
    from jsonb_array_elements(p_itens) with ordinality as x(v, n)
   where coalesce(trim(x.v ->> 'descricao'), '') <> '' and coalesce((x.v ->> 'valor')::numeric, 0) > 0;
  return v_id;
end $$;

-- Modal "Apropriações": Saldo a utilizar não passa do Valor Restante.
create or replace function public.apropriar_reembolso(p_id bigint, p_cc bigint, p_valor numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare v_r public.ordens_reembolso; v_aprop numeric;
begin
  if not public.pode_editar_reembolso() then raise exception 'Seu perfil não pode alterar ordens de reembolso.' using errcode = '42501'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Valor informado deve ser maior que 0'; end if;
  select * into v_r from public.ordens_reembolso where id = p_id for update;
  if v_r.id is null then raise exception 'Ordem de reembolso não encontrada.'; end if;
  if v_r.solicitacao_enviada then raise exception 'Solicitação já enviada ao Financeiro.'; end if;
  if not exists (select 1 from public.centros_custo where id = p_cc and obra_id = v_r.obra_id) then raise exception 'Centro de custo não pertence à obra.'; end if;
  select coalesce(sum(valor), 0) into v_aprop from public.apropriacoes where origem = 'reembolso' and origem_id = p_id;
  if v_aprop + p_valor > public.total_reembolso(p_id) + 0.005 then
    raise exception 'Valor informado R$ % maior que saldo R$ %', public.valor_br(p_valor), public.valor_br(public.total_reembolso(p_id) - v_aprop);
  end if;
  insert into public.apropriacoes (cc_id, origem, origem_id, valor, saldo_ref) values (p_cc, 'reembolso', p_id, p_valor, public.saldo_cc(p_cc));
end $$;

create or replace function public.excluir_apropriacao_reembolso(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_r bigint;
begin
  if not public.pode_editar_reembolso() then raise exception 'Seu perfil não pode alterar ordens de reembolso.' using errcode = '42501'; end if;
  select origem_id into v_r from public.apropriacoes where id = p_id and origem = 'reembolso';
  if v_r is null then raise exception 'Apropriação não encontrada.'; end if;
  if (select solicitacao_enviada from public.ordens_reembolso where id = v_r) then raise exception 'Solicitação já enviada ao Financeiro.'; end if;
  delete from public.apropriacoes where id = p_id;
end $$;

-- "Confirma o envio da Solicitação para o setor Financeiro? Esta opção bloqueia a solicitação para possiveis alterações!"
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
  values (case when v_azul then 'azul' else 'cinza' end, null, p_id, v_r.obra_id, v_r.fornecedor_id,
          extract(epoch from clock_timestamp())::bigint::text, '1', 'REEMBOLSO', current_date, v_total,
          case when v_azul then 'aguardando_guia' else 'pendente_pagamento' end,
          'Transferencia', v_r.cpf_cnpj, (select nome from public.fornecedores where id = v_r.fornecedor_id), v_r.banco, v_r.agencia, v_r.conta)
  returning id into v_nota;
  if v_azul then
    insert into public.nf_rateios (nota_fiscal_id, cc_id, valor)
    select v_nota, cc_id, sum(valor) from public.apropriacoes where origem = 'reembolso' and origem_id = p_id group by cc_id;
  end if;

  update public.ordens_reembolso set solicitacao_enviada = true, enviada_em = now(), enviada_por = auth.uid() where id = p_id;
  return v_nota;
end $$;

-- Lista do cliente → "Confirma a Exclusão do Pedido?"
create or replace function public.excluir_reembolso(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_editar_reembolso() then raise exception 'Seu perfil não pode excluir ordens de reembolso.' using errcode = '42501'; end if;
  if (select solicitacao_enviada from public.ordens_reembolso where id = p_id) then raise exception 'Solicitação já enviada ao Financeiro não pode ser excluída.'; end if;
  delete from public.apropriacoes where origem = 'reembolso' and origem_id = p_id;
  delete from public.ordens_reembolso where id = p_id;
  if not found then raise exception 'Ordem de reembolso não encontrada.'; end if;
end $$;

-- Rateio da nota (Fase Cinza) pelos CCs: apropriações da OC ou, na nota de reembolso, do reembolso.
create or replace function public.rateio_nota_cinza(p_id bigint)
returns table (cc_id bigint, valor numeric)
language sql stable security definer set search_path = '' as $$
  with n as (select ordem_compra_id, ordem_reembolso_id, valor from public.notas_fiscais where id = p_id),
       a as (select a.cc_id, sum(a.valor) as v from public.apropriacoes a, n
              where (n.ordem_compra_id is not null and a.origem = 'oc' and a.origem_id = n.ordem_compra_id)
                 or (n.ordem_reembolso_id is not null and a.origem = 'reembolso' and a.origem_id = n.ordem_reembolso_id)
              group by a.cc_id),
       t as (select sum(v) as total from a)
  select a.cc_id, round(n.valor * a.v / nullif(t.total, 0), 2) from a, n, t
$$;

-- Notas: id do reembolso (link "Vizualizar Pedido" das telas de notas).
create or replace view public.notas_lista with (security_invoker = true) as
  select n.id, n.fase, n.status, n.numero, n.serie, n.tipo_documento, n.vencimento, n.valor, n.criado_em, n.pago_em,
         n.pagamento_forcado, n.guia_id, n.ordem_compra_id, n.obra_id, n.fornecedor_id, n.tipo_pagamento,
         o.nome as obra_nome, o.cliente_id, c.nome as cliente_nome,
         oc.numero_cliente as pedido, oc.nome as pedido_nome,
         coalesce(f.nome_fantasia, f.nome) as fornecedor_nome,
         pp.nome as pago_por_nome, pr.nome as registrado_por_nome,
         (select count(*) from public.nf_anexos a where a.nota_fiscal_id = n.id) as anexos,
         g.numero as guia_numero,
         n.ordem_reembolso_id
  from public.notas_fiscais n
  join public.obras o on o.id = n.obra_id
  left join public.clientes c on c.id = o.cliente_id
  left join public.ordens_compra oc on oc.id = n.ordem_compra_id
  join public.fornecedores f on f.id = n.fornecedor_id
  left join public.perfis pp on pp.id = n.pago_por
  left join public.perfis pr on pr.id = n.registrado_por
  left join public.guias g on g.id = n.guia_id;

-- MPH Sistema — Ordem de Compra e "Aprovação de OC com Pendência" como no AstroTools.
-- Campos da OC (nome, nº do cliente, % especial, filial, serviço, forma de pagamento, prazo, frete,
-- desconto, impostos por item), apropriações com "Valor Apontado" e "Saldo Aprop.", Total / Total
-- Apropriado / Total Pago / Saldo, Zerar Saldo Pedido, Dados do Contrato, Local de Entrega, Arquivos,
-- Justificativas e a liberação de OC com pendência (Coordenação / Engenharia).
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run (depois da 0008).

alter table public.ordens_compra
  add column if not exists nome text,
  add column if not exists numero_cliente int,
  add column if not exists percentual_especial numeric(6, 2),
  add column if not exists filial_cliente_id bigint references public.clientes (id),
  add column if not exists tipo public.tipo_servico_mapa,
  add column if not exists prazo_locacao text,
  add column if not exists data_devolucao date,
  add column if not exists regularizacao_engenharia boolean not null default false,
  add column if not exists saldo_zerado boolean not null default false,
  add column if not exists pendencia text,
  add column if not exists contrato_tipo text,
  add column if not exists contrato_inicio date,
  add column if not exists contrato_termino date,
  add column if not exists contrato_datas_pagamento text,
  add column if not exists contrato_info text,
  add column if not exists entrega_cep text,
  add column if not exists entrega_endereco text,
  add column if not exists entrega_numero text,
  add column if not exists entrega_complemento text,
  add column if not exists entrega_responsavel text,
  add column if not exists entrega_telefone text,
  add column if not exists entrega_contato_mestre text,
  add column if not exists entrega_telefone_mestre text,
  add column if not exists entrega_bairro text,
  add column if not exists entrega_cidade text,
  add column if not exists entrega_uf text;

alter table public.oc_itens add column if not exists e_titulo boolean not null default false;
alter table public.oc_itens add column if not exists valor_impostos numeric(14, 2) not null default 0;
alter table public.oc_itens drop constraint if exists oc_itens_quantidade_check;
alter table public.oc_itens add constraint oc_itens_quantidade_check check (quantidade >= 0);

-- "Saldo Aprop." da apropriação: saldo do CC quando o valor foi apontado.
alter table public.apropriacoes add column if not exists saldo_ref numeric(14, 2);

-- Justificativas de liberação / bloqueio da OC.
create table if not exists public.oc_justificativas (
  id bigint generated always as identity primary key,
  ordem_compra_id bigint not null references public.ordens_compra (id) on delete cascade,
  status text not null,
  perfil text,
  justificativa text not null,
  usuario_id uuid references public.perfis (id) default auth.uid(),
  criado_em timestamptz not null default now()
);
alter table public.oc_justificativas enable row level security;
create policy oc_justificativas_select on public.oc_justificativas for select to authenticated using (public.usuario_ativo());

create table if not exists public.oc_arquivos (
  id bigint generated always as identity primary key,
  ordem_compra_id bigint not null references public.ordens_compra (id) on delete cascade,
  caminho text not null,
  nome text not null,
  tamanho bigint,
  enviado_por uuid references public.perfis (id) default auth.uid(),
  enviado_em timestamptz not null default now()
);
alter table public.oc_arquivos enable row level security;
create policy oc_arquivos_select on public.oc_arquivos for select to authenticated using (public.usuario_ativo());
create policy oc_arquivos_write on public.oc_arquivos for all to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo());

insert into storage.buckets (id, name, public, file_size_limit)
values ('oc-arquivos', 'oc-arquivos', false, 20971520)
on conflict (id) do nothing;
create policy oc_arquivos_ler on storage.objects for select to authenticated using (bucket_id = 'oc-arquivos' and public.usuario_ativo());
create policy oc_arquivos_enviar on storage.objects for insert to authenticated with check (bucket_id = 'oc-arquivos' and public.usuario_ativo());
create policy oc_arquivos_apagar on storage.objects for delete to authenticated using (bucket_id = 'oc-arquivos' and public.usuario_ativo());

-- Quem mexe na OC (dados, itens, apropriações): suprimentos, engenharia e admin.
create or replace function public.pode_editar_oc() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.meu_papel() in ('admin', 'engenharia', 'suprimentos'), false)
$$;

-- Total da OC = Σ (qtde × unitário + impostos) + frete − desconto.
create or replace function public.total_oc(p_id bigint) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(i.quantidade * i.valor_unitario + i.valor_impostos) from public.oc_itens i where i.ordem_compra_id = p_id and not i.e_titulo), 0)
         + oc.frete - oc.desconto
    from public.ordens_compra oc where oc.id = p_id
$$;

-- Listagem e tela da OC.
create or replace view public.ocs_resumo with (security_invoker = true) as
  select oc.id, oc.obra_id, oc.fornecedor_id, oc.mapa_id, oc.status, oc.nome, oc.numero_cliente, oc.data_emissao,
         oc.regularizacao_engenharia, oc.saldo_zerado, oc.pendencia, oc.criado_em,
         o.nome as obra_nome, o.regime as obra_regime, o.cliente_id, c.nome as cliente_nome,
         f.nome as fornecedor_nome, f.nome_fantasia as fornecedor_fantasia,
         public.total_oc(oc.id) as valor_total,
         coalesce((select sum(a.valor) from public.apropriacoes a where a.origem = 'oc' and a.origem_id = oc.id), 0) as total_apropriado,
         coalesce((select sum(n.valor) from public.notas_fiscais n where n.ordem_compra_id = oc.id and n.status = 'paga'), 0) as total_pago,
         coalesce((select sum(a.valor) from public.apropriacoes a where a.origem = 'oc' and a.origem_id = oc.id), 0)
           - coalesce((select sum(n.valor) from public.notas_fiscais n where n.ordem_compra_id = oc.id and n.status = 'paga'), 0) as saldo,
         (select string_agg(p.nome, ' | ' order by r.tipo, p.nome) from public.obra_responsaveis r join public.perfis p on p.id = r.perfil_id
           where r.obra_id = oc.obra_id) as responsaveis
  from public.ordens_compra oc
  join public.obras o on o.id = oc.obra_id
  left join public.clientes c on c.id = o.cliente_id
  join public.fornecedores f on f.id = oc.fornecedor_id;

-- ------------------------------------------------------------------
-- Consistência: a OC fica com pendência quando estoura o saldo de algum CC ou o limite de
-- aprovação do engenheiro responsável da obra. Sem pendência ela já nasce liberada.
-- ------------------------------------------------------------------
create or replace function public.verificar_pendencia_oc(p_id bigint) returns text
language plpgsql security definer set search_path = '' as $$
declare v_msg text := ''; v_total numeric := public.total_oc(p_id); v_obra bigint; v_limite numeric; r record;
begin
  select obra_id into v_obra from public.ordens_compra where id = p_id;
  for r in
    select a.valor, a.saldo_ref, cc.codigo from public.apropriacoes a join public.centros_custo cc on cc.id = a.cc_id
     where a.origem = 'oc' and a.origem_id = p_id
  loop
    if r.saldo_ref is not null and r.valor > r.saldo_ref + 0.005 then
      v_msg := v_msg || format('Valor apontado no CC %s (%s) maior que o saldo (%s). ', r.codigo,
               to_char(r.valor, 'FM999G999G990D00'), to_char(r.saldo_ref, 'FM999G999G990D00'));
    end if;
  end loop;
  select max(limite_aprovacao_oc) into v_limite from public.obra_responsaveis
   where obra_id = v_obra and tipo = 'engenheiro' and limite_aprovacao_oc > 0;
  if v_limite is not null and v_total > v_limite + 0.005 then
    v_msg := v_msg || format('Valor da OC (%s) acima do limite de aprovação do engenheiro (%s). ',
             to_char(v_total, 'FM999G999G990D00'), to_char(v_limite, 'FM999G999G990D00'));
  end if;
  v_msg := nullif(trim(v_msg), '');
  update public.ordens_compra
     set pendencia = v_msg,
         status = case when v_msg is null then 'aprovada'::public.status_oc
                       when status in ('rascunho', 'aprovada') then 'aguardando_aprovacao'::public.status_oc
                       else status end
   where id = p_id and status not in ('cancelada', 'reprovada');
  return v_msg;
end $$;

-- Gerar pedido do mapa (redefinida): nome e nº do cliente da OC, impostos e saldo de referência
-- das apropriações, e verificação de pendência.
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

  insert into public.apropriacoes (cc_id, origem, origem_id, valor, saldo_ref)
  select a.cc_id, 'oc', v_oc, round(sum(i.quantidade * i.valor_unitario / n.qtd), 2), public.saldo_cc(a.cc_id)
    from _ped i
    join public.apropriacoes a on a.origem = 'mapa_item' and a.origem_id = i.id
    join (select origem_id, count(*) as qtd from public.apropriacoes where origem = 'mapa_item' group by origem_id) n on n.origem_id = i.id
   group by a.cc_id;

  perform public.verificar_pendencia_oc(v_oc);
  if v_mapa.solicitacao_id is not null then
    update public.solicitacoes set status = 'atendida' where id = v_mapa.solicitacao_id and status = 'pendente';
  end if;
  return v_oc;
end $$;

-- Salva os dados editáveis da OC e os itens (preservando ids). p_itens como na solicitação, com valor_unitario e valor_impostos.
create or replace function public.salvar_oc_original(p_id bigint, p_dados jsonb, p_itens jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_editar_oc() then raise exception 'Seu perfil não pode alterar ordens de compra.' using errcode = '42501'; end if;
  if exists (select 1 from public.ordens_compra where id = p_id and status = 'cancelada') then raise exception 'OC cancelada.'; end if;
  update public.ordens_compra
     set nome = nullif(trim(p_dados ->> 'nome'), ''), numero_cliente = nullif(p_dados ->> 'numero_cliente', '')::int,
         observacao = nullif(p_dados ->> 'observacao', ''), tipo = nullif(p_dados ->> 'tipo', '')::public.tipo_servico_mapa,
         data_entrega = nullif(p_dados ->> 'data_entrega', '')::date, prazo_locacao = nullif(p_dados ->> 'prazo_locacao', ''),
         data_devolucao = nullif(p_dados ->> 'data_devolucao', '')::date, condicao_pagamento = nullif(p_dados ->> 'forma_pagamento', ''),
         prazo_entrega = nullif(p_dados ->> 'prazo', '')
   where id = p_id;

  delete from public.oc_itens i
   where i.ordem_compra_id = p_id
     and i.id in (select (x ->> 'id')::bigint from jsonb_array_elements(p_itens) x where coalesce(x ->> 'id', '') <> '' and coalesce((x ->> 'excluir')::boolean, false));
  update public.oc_itens i
     set ordem = t.ord, e_titulo = coalesce((t.x ->> 'e_titulo')::boolean, false), descricao = t.x ->> 'descricao',
         quantidade = coalesce(nullif(t.x ->> 'quantidade', '')::numeric, 0), unidade = coalesce(nullif(t.x ->> 'unidade', ''), i.unidade),
         valor_unitario = coalesce(nullif(t.x ->> 'valor_unitario', '')::numeric, 0), valor_impostos = coalesce(nullif(t.x ->> 'valor_impostos', '')::numeric, 0)
    from jsonb_array_elements(p_itens) with ordinality as t(x, ord)
   where i.ordem_compra_id = p_id and coalesce(t.x ->> 'id', '') <> '' and i.id = (t.x ->> 'id')::bigint and not coalesce((t.x ->> 'excluir')::boolean, false);
  insert into public.oc_itens (ordem_compra_id, ordem, e_titulo, item_id, codigo, descricao, quantidade, unidade, valor_unitario, valor_impostos)
  select p_id, ord, coalesce((x ->> 'e_titulo')::boolean, false), nullif(x ->> 'item_id', '')::bigint, coalesce(nullif(x ->> 'codigo', ''), '0'),
         x ->> 'descricao', coalesce(nullif(x ->> 'quantidade', '')::numeric, 0), coalesce(nullif(x ->> 'unidade', ''), 'UN'),
         coalesce(nullif(x ->> 'valor_unitario', '')::numeric, 0), coalesce(nullif(x ->> 'valor_impostos', '')::numeric, 0)
    from jsonb_array_elements(p_itens) with ordinality as t(x, ord)
   where coalesce(x ->> 'id', '') = '' and coalesce(trim(x ->> 'descricao'), '') <> '';

  perform public.verificar_pendencia_oc(p_id);
end $$;

-- Dados do Contrato e Local de Entrega.
create or replace function public.salvar_oc_complemento(p_id bigint, p_dados jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_editar_oc() then raise exception 'Seu perfil não pode alterar ordens de compra.' using errcode = '42501'; end if;
  update public.ordens_compra set
    contrato_tipo = coalesce(p_dados ->> 'contrato_tipo', contrato_tipo),
    contrato_inicio = case when p_dados ? 'contrato_inicio' then nullif(p_dados ->> 'contrato_inicio', '')::date else contrato_inicio end,
    contrato_termino = case when p_dados ? 'contrato_termino' then nullif(p_dados ->> 'contrato_termino', '')::date else contrato_termino end,
    contrato_datas_pagamento = coalesce(p_dados ->> 'contrato_datas_pagamento', contrato_datas_pagamento),
    contrato_info = coalesce(p_dados ->> 'contrato_info', contrato_info),
    entrega_cep = coalesce(p_dados ->> 'entrega_cep', entrega_cep),
    entrega_endereco = coalesce(p_dados ->> 'entrega_endereco', entrega_endereco),
    entrega_numero = coalesce(p_dados ->> 'entrega_numero', entrega_numero),
    entrega_complemento = coalesce(p_dados ->> 'entrega_complemento', entrega_complemento),
    entrega_responsavel = coalesce(p_dados ->> 'entrega_responsavel', entrega_responsavel),
    entrega_telefone = coalesce(p_dados ->> 'entrega_telefone', entrega_telefone),
    entrega_contato_mestre = coalesce(p_dados ->> 'entrega_contato_mestre', entrega_contato_mestre),
    entrega_telefone_mestre = coalesce(p_dados ->> 'entrega_telefone_mestre', entrega_telefone_mestre),
    entrega_bairro = coalesce(p_dados ->> 'entrega_bairro', entrega_bairro),
    entrega_cidade = coalesce(p_dados ->> 'entrega_cidade', entrega_cidade),
    entrega_uf = coalesce(p_dados ->> 'entrega_uf', entrega_uf)
  where id = p_id;
end $$;

-- Apropriações da OC (modal "Apropriações"): Σ apontado não passa do valor da OC.
create or replace function public.apropriar_oc(p_oc bigint, p_cc bigint, p_valor numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare v_obra bigint; v_total numeric; v_aprop numeric;
begin
  if not public.pode_editar_oc() then raise exception 'Seu perfil não pode alterar ordens de compra.' using errcode = '42501'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Informe o saldo a utilizar.'; end if;
  select obra_id into v_obra from public.ordens_compra where id = p_oc and status <> 'cancelada';
  if v_obra is null then raise exception 'OC não encontrada.'; end if;
  if not exists (select 1 from public.centros_custo where id = p_cc and obra_id = v_obra) then raise exception 'Centro de custo não pertence à obra.'; end if;
  v_total := public.total_oc(p_oc);
  select coalesce(sum(valor), 0) into v_aprop from public.apropriacoes where origem = 'oc' and origem_id = p_oc;
  if v_aprop + p_valor > v_total + 0.005 then
    raise exception 'O valor apropriado (%) passa do valor da OC (%).', to_char(v_aprop + p_valor, 'FM999G999G990D00'), to_char(v_total, 'FM999G999G990D00');
  end if;
  insert into public.apropriacoes (cc_id, origem, origem_id, valor, saldo_ref) values (p_cc, 'oc', p_oc, p_valor, public.saldo_cc(p_cc));
  perform public.verificar_pendencia_oc(p_oc);
end $$;

create or replace function public.excluir_apropriacao_oc(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_oc bigint;
begin
  if not public.pode_editar_oc() then raise exception 'Seu perfil não pode alterar ordens de compra.' using errcode = '42501'; end if;
  delete from public.apropriacoes where id = p_id and origem = 'oc' returning origem_id into v_oc;
  if v_oc is null then raise exception 'Apropriação não encontrada.'; end if;
  perform public.verificar_pendencia_oc(v_oc);
end $$;

-- Zerar Saldo Pedido: reduz o apontado ao que já foi pago (libera o apropriado não utilizado).
create or replace function public.zerar_saldo_oc(p_oc bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_aprop numeric; v_pago numeric;
begin
  if not public.pode_editar_oc() and not public.pode_pagar() then raise exception 'Seu perfil não pode zerar o saldo.' using errcode = '42501'; end if;
  select coalesce(sum(valor), 0) into v_aprop from public.apropriacoes where origem = 'oc' and origem_id = p_oc;
  select coalesce(sum(valor), 0) into v_pago from public.notas_fiscais where ordem_compra_id = p_oc and status = 'paga';
  if v_aprop <= v_pago then raise exception 'A OC não tem saldo a zerar.'; end if;
  update public.apropriacoes set valor = round(valor * v_pago / v_aprop, 2) where origem = 'oc' and origem_id = p_oc;
  update public.ordens_compra set saldo_zerado = true where id = p_oc;
end $$;

-- Liberar / Bloquear OC com pendência (Coordenação ou Engenharia), com justificativa.
create or replace function public.liberar_oc(p_oc bigint, p_liberar boolean, p_perfil text, p_justificativa text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(public.meu_papel() in ('admin', 'engenharia'), false) then
    raise exception 'Só Engenharia ou Coordenação liberam OCs com pendência.' using errcode = '42501';
  end if;
  if coalesce(trim(p_justificativa), '') = '' then raise exception 'Informe a justificativa.'; end if;
  update public.ordens_compra set status = case when p_liberar then 'aprovada'::public.status_oc else 'reprovada'::public.status_oc end
   where id = p_oc and status <> 'cancelada';
  if not found then raise exception 'OC não encontrada.'; end if;
  insert into public.oc_justificativas (ordem_compra_id, status, perfil, justificativa)
  values (p_oc, case when p_liberar then 'Liberado' else 'Bloqueado' end, p_perfil, trim(p_justificativa));
end $$;

create or replace function public.alternar_regularizacao_oc(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_editar_oc() then raise exception 'Seu perfil não pode alterar ordens de compra.' using errcode = '42501'; end if;
  update public.ordens_compra set regularizacao_engenharia = not regularizacao_engenharia where id = p_id;
end $$;

-- OCs já existentes: nome e nº do cliente a partir do mapa, e verificação de pendência.
update public.ordens_compra oc set nome = coalesce(oc.nome, m.servico) from public.mapas m where m.id = oc.mapa_id and oc.nome is null;
with seq as (
  select oc.id, row_number() over (partition by o.cliente_id order by oc.id) as n
    from public.ordens_compra oc join public.obras o on o.id = oc.obra_id where oc.numero_cliente is null
)
update public.ordens_compra oc set numero_cliente = seq.n from seq where seq.id = oc.id;

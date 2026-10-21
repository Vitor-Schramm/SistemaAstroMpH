-- MPH Sistema — Perfil Suprimentos como no AstroTools: Materiais, notificações ("Nova Solicitação …") e
-- "Nova Ordem de Compra" direta (sem mapa).
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run (depois da 0015).

-- ============================================================
-- Materiais (cadastro de itens): Tipo Item, Fornecedor preferencial e Observação
-- ============================================================
alter table public.itens
  add column if not exists tipo_item text,
  add column if not exists fornecedor_preferencial_id bigint references public.fornecedores (id),
  add column if not exists observacao text;

-- Novo material: código sequencial automático (o original identifica pelo Id).
create or replace function public.salvar_material(p_id bigint, p_dados jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint := p_id;
begin
  if not public.pode_comprar() then raise exception 'Só Suprimentos altera materiais.' using errcode = '42501'; end if;
  if coalesce(trim(p_dados ->> 'nome'), '') = '' then raise exception 'Informe o Nome do Material.'; end if;
  if coalesce(trim(p_dados ->> 'unid_med'), '') = '' then raise exception 'Informe a Unidade de Medida.'; end if;
  if v_id is null then
    insert into public.itens (codigo, descricao, unidade, tipo_item, fornecedor_preferencial_id, observacao)
    values ('M' || (select coalesce(max(id), 0) + 1 from public.itens), trim(p_dados ->> 'nome'), trim(p_dados ->> 'unid_med'),
            nullif(trim(p_dados ->> 'tipo_item'), ''), nullif(p_dados ->> 'fornecedor_preferencial_id', '')::bigint, nullif(trim(p_dados ->> 'observacao'), ''))
    returning id into v_id;
  else
    update public.itens
       set descricao = trim(p_dados ->> 'nome'), unidade = trim(p_dados ->> 'unid_med'), tipo_item = nullif(trim(p_dados ->> 'tipo_item'), ''),
           fornecedor_preferencial_id = nullif(p_dados ->> 'fornecedor_preferencial_id', '')::bigint, observacao = nullif(trim(p_dados ->> 'observacao'), '')
     where id = v_id;
    if not found then raise exception 'Material não encontrado.'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.ativar_material(p_id bigint, p_ativo boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_comprar() then raise exception 'Só Suprimentos altera materiais.' using errcode = '42501'; end if;
  update public.itens set ativo = p_ativo where id = p_id;
end $$;

-- ============================================================
-- Notificações (sino da barra superior e "Minhas Notificações")
-- ============================================================
create table if not exists public.notificacoes (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfis (id) on delete cascade,
  titulo text not null,
  texto text,
  link text,
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists notificacoes_usuario on public.notificacoes (usuario_id, lida, criado_em desc);
alter table public.notificacoes enable row level security;
drop policy if exists notificacoes_proprias on public.notificacoes;
create policy notificacoes_proprias on public.notificacoes for select to authenticated using (usuario_id = auth.uid());
drop policy if exists notificacoes_atualizar on public.notificacoes;
create policy notificacoes_atualizar on public.notificacoes for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
drop policy if exists notificacoes_apagar on public.notificacoes;
create policy notificacoes_apagar on public.notificacoes for delete to authenticated using (usuario_id = auth.uid());

-- "Nova Solicitação {OBRA}. 👋" para todo o Suprimentos quando uma solicitação é criada.
create or replace function public.notificar_nova_solicitacao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notificacoes (usuario_id, titulo, texto, link)
  select p.id, 'Nova Solicitação ' || (select nome from public.obras where id = new.obra_id) || '. 👋', new.servico, '/solicitacoes/' || new.id
    from public.perfis p
   where p.papel = 'suprimentos' and p.ativo;
  return new;
end $$;
drop trigger if exists t_notificar_solicitacao on public.solicitacoes;
create trigger t_notificar_solicitacao after insert on public.solicitacoes for each row execute function public.notificar_nova_solicitacao();

-- ============================================================
-- "Nova Ordem de Compra" direta (sem mapa)
-- ============================================================
create or replace function public.criar_oc_direta(p_dados jsonb, p_itens jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_obra bigint := nullif(p_dados ->> 'obra_id', '')::bigint; v_forn bigint := nullif(p_dados ->> 'fornecedor_id', '')::bigint;
        v_id bigint; v_num int; v_cliente bigint;
begin
  if not public.pode_comprar() then raise exception 'Só Suprimentos cria ordens de compra.' using errcode = '42501'; end if;
  if v_obra is null then raise exception 'Selecione a Obra.'; end if;
  if v_forn is null then raise exception 'Selecione o Fornecedor.'; end if;
  if coalesce(trim(p_dados ->> 'nome'), '') = '' then raise exception 'Informe o Nome da Ordem.'; end if;
  if coalesce(trim(p_dados ->> 'forma_pagamento'), '') = '' then raise exception 'Informe a Forma Pagamento.'; end if;
  if coalesce(trim(p_dados ->> 'prazo'), '') = '' then raise exception 'Informe o Prazo.'; end if;
  if exists (select 1 from public.fornecedor_bloqueios where fornecedor_id = v_forn and desbloqueado_em is null) then
    raise exception 'Fornecedor bloqueado. Não é possível gerar pedido.';
  end if;
  if not exists (select 1 from jsonb_array_elements(p_itens) x where coalesce(trim(x ->> 'descricao'), '') <> '' and not coalesce((x ->> 'e_titulo')::boolean, false)) then
    raise exception 'Adicione ao menos um item.';
  end if;

  select cliente_id into v_cliente from public.obras where id = v_obra;
  v_num := nullif(p_dados ->> 'numero_cliente', '')::int;
  if v_num is null then
    select coalesce(max(oc.numero_cliente), 0) + 1 into v_num
      from public.ordens_compra oc join public.obras o on o.id = oc.obra_id where o.cliente_id is not distinct from v_cliente;
  end if;

  insert into public.ordens_compra (obra_id, fornecedor_id, mapa_id, nome, numero_cliente, percentual_especial, filial_cliente_id, tipo,
                                    data_entrega, prazo_locacao, data_devolucao, condicao_pagamento, prazo_entrega, frete, impostos, desconto, observacao, status)
  values (v_obra, v_forn, null, trim(p_dados ->> 'nome'), v_num, nullif(p_dados ->> 'percentual_especial', '')::numeric,
          nullif(p_dados ->> 'filial_cliente_id', '')::bigint, nullif(p_dados ->> 'tipo', '')::public.tipo_servico_mapa,
          nullif(p_dados ->> 'data_entrega', '')::date, nullif(p_dados ->> 'prazo_locacao', ''), nullif(p_dados ->> 'data_devolucao', '')::date,
          trim(p_dados ->> 'forma_pagamento'), trim(p_dados ->> 'prazo'),
          coalesce(nullif(p_dados ->> 'frete', '')::numeric, 0), 0, coalesce(nullif(p_dados ->> 'desconto', '')::numeric, 0),
          nullif(trim(p_dados ->> 'observacao'), ''), 'rascunho')
  returning id into v_id;

  insert into public.oc_itens (ordem_compra_id, ordem, e_titulo, item_id, codigo, descricao, quantidade, unidade, valor_unitario, valor_impostos)
  select v_id, ord, coalesce((x ->> 'e_titulo')::boolean, false), nullif(x ->> 'item_id', '')::bigint, coalesce(nullif(x ->> 'codigo', ''), '0'),
         trim(x ->> 'descricao'), coalesce(nullif(x ->> 'quantidade', '')::numeric, 0), coalesce(nullif(x ->> 'unidade', ''), 'UN'),
         coalesce(nullif(x ->> 'valor_unitario', '')::numeric, 0), coalesce(nullif(x ->> 'valor_impostos', '')::numeric, 0)
    from jsonb_array_elements(p_itens) with ordinality as t(x, ord)
   where coalesce(trim(x ->> 'descricao'), '') <> '';

  perform public.verificar_pendencia_oc(v_id);
  return v_id;
end $$;

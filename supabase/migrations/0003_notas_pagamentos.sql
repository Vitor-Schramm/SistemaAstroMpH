-- MPH Sistema — fase 3: Notas fiscais (Fase Cinza / Fase Azul), aprovação da engenharia,
-- pagamentos, verba da obra (aportes) e Guias Adm.
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run.
--
-- Fase Cinza: a MPH paga o fornecedor com a verba da obra.
--   registrada → aguardando_engenharia → pendente_pagamento → paga
-- Fase Azul: o cliente paga o fornecedor direto; a MPH envia guias ao cliente.
--   registrada → aguardando_engenharia → aguardando_guia → em_guia → paga

-- ============================================================
-- Permissões
-- ============================================================
create function public.pode_lancar_nf() returns boolean
language sql stable as $$ select coalesce(public.meu_papel() in ('admin', 'suprimentos', 'financeiro'), false) $$;

create function public.pode_aprovar_nf() returns boolean
language sql stable as $$ select coalesce(public.meu_papel() in ('admin', 'engenharia'), false) $$;

create function public.pode_pagar() returns boolean
language sql stable as $$ select coalesce(public.meu_papel() in ('admin', 'financeiro'), false) $$;

-- ============================================================
-- Verba da obra: aportes do cliente
-- ============================================================
create table public.obra_aportes (
  id bigint generated always as identity primary key,
  obra_id bigint not null references public.obras (id),
  data date not null default current_date,
  valor numeric(14, 2) not null check (valor <> 0),
  descricao text,
  lancado_por uuid references public.perfis (id) default auth.uid(),
  criado_em timestamptz not null default now()
);
create index on public.obra_aportes (obra_id);

-- ============================================================
-- Guias Adm (Fase Azul): lote de NFs enviado ao cliente para pagamento direto
-- ============================================================
create type public.status_guia as enum ('aberta', 'enviada', 'paga', 'cancelada');

create table public.guias_adm (
  id bigint generated always as identity primary key,
  obra_id bigint not null references public.obras (id),
  status public.status_guia not null default 'aberta',
  observacao text,
  enviada_em date,
  paga_em date,
  nf_taxa_gerada boolean not null default false,
  criado_por uuid references public.perfis (id) default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ============================================================
-- Notas fiscais
-- ============================================================
create type public.fase_nf as enum ('cinza', 'azul');
create type public.status_nf as enum (
  'aguardando_engenharia', 'reprovada', 'pendente_pagamento', 'aguardando_guia', 'em_guia', 'paga', 'cancelada'
);

create table public.notas_fiscais (
  id bigint generated always as identity primary key,
  fase public.fase_nf not null,
  ordem_compra_id bigint not null references public.ordens_compra (id),
  obra_id bigint not null references public.obras (id),
  fornecedor_id bigint not null references public.fornecedores (id),
  numero text not null,
  serie text not null default '1',
  emissao date,
  vencimento date not null,
  valor numeric(14, 2) not null check (valor > 0),
  observacao text,
  status public.status_nf not null default 'aguardando_engenharia',
  -- aprovação da engenharia
  aprovado_por uuid references public.perfis (id),
  aprovado_em timestamptz,
  justificativa text,
  -- pagamento (Fase Cinza) / baixa (Fase Azul)
  pago_em date,
  pago_por uuid references public.perfis (id),
  pagamento_forcado boolean not null default false,
  guia_id bigint references public.guias_adm (id),
  registrado_por uuid references public.perfis (id) default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index notas_fiscais_unica on public.notas_fiscais (fornecedor_id, numero, serie) where status <> 'cancelada';
create index on public.notas_fiscais (status);
create index on public.notas_fiscais (obra_id);
create index on public.notas_fiscais (ordem_compra_id);

create table public.nf_anexos (
  id bigint generated always as identity primary key,
  nota_fiscal_id bigint not null references public.notas_fiscais (id) on delete cascade,
  caminho text not null unique,
  nome text not null,
  tamanho bigint,
  enviado_por uuid references public.perfis (id) default auth.uid(),
  criado_em timestamptz not null default now()
);

create trigger t_notas_upd before update on public.notas_fiscais for each row execute function public.set_atualizado_em();
create trigger t_guias_upd before update on public.guias_adm for each row execute function public.set_atualizado_em();

-- ============================================================
-- Visões
-- ============================================================
create view public.notas_resumo with (security_invoker = true) as
  select n.*,
         o.codigo as obra_codigo, o.nome as obra_nome, c.nome as cliente_nome,
         f.nome as fornecedor_nome, f.cpf_cnpj as fornecedor_cnpj,
         pa.nome as aprovado_por_nome, pp.nome as pago_por_nome,
         (select count(*) from public.nf_anexos a where a.nota_fiscal_id = n.id) as anexos
  from public.notas_fiscais n
  join public.obras o on o.id = n.obra_id
  left join public.clientes c on c.id = o.cliente_id
  join public.fornecedores f on f.id = n.fornecedor_id
  left join public.perfis pa on pa.id = n.aprovado_por
  left join public.perfis pp on pp.id = n.pago_por;

-- Verba por obra: aportes − pagamentos efetivados da Fase Cinza.
create view public.obras_verba with (security_invoker = true) as
  select o.id as obra_id, o.codigo, o.nome, o.ativo, c.nome as cliente_nome,
         coalesce((select sum(a.valor) from public.obra_aportes a where a.obra_id = o.id), 0) as aportes,
         coalesce((select sum(n.valor) from public.notas_fiscais n where n.obra_id = o.id and n.fase = 'cinza' and n.status = 'paga'), 0) as pago,
         coalesce((select sum(n.valor) from public.notas_fiscais n where n.obra_id = o.id and n.fase = 'cinza'
                   and n.status in ('aguardando_engenharia', 'pendente_pagamento')), 0) as a_pagar,
         coalesce((select sum(a.valor) from public.obra_aportes a where a.obra_id = o.id), 0)
           - coalesce((select sum(n.valor) from public.notas_fiscais n where n.obra_id = o.id and n.fase = 'cinza' and n.status = 'paga'), 0) as disponivel
  from public.obras o
  left join public.clientes c on c.id = o.cliente_id;

-- OCs aprovadas com saldo para vincular notas.
create view public.ocs_saldo with (security_invoker = true) as
  select r.id, r.obra_id, r.obra_codigo, r.obra_nome, r.fornecedor_id, r.fornecedor_nome, r.valor_total,
         coalesce((select sum(n.valor) from public.notas_fiscais n where n.ordem_compra_id = r.id and n.status <> 'cancelada'), 0) as notas,
         r.valor_total - coalesce((select sum(n.valor) from public.notas_fiscais n where n.ordem_compra_id = r.id and n.status <> 'cancelada'), 0) as saldo
  from public.ordens_compra_resumo r
  where r.status = 'aprovada';

create view public.guias_resumo with (security_invoker = true) as
  select g.*, o.codigo as obra_codigo, o.nome as obra_nome, c.nome as cliente_nome,
         (select count(*) from public.notas_fiscais n where n.guia_id = g.id) as qtd_notas,
         coalesce((select sum(n.valor) from public.notas_fiscais n where n.guia_id = g.id), 0) as valor_total
  from public.guias_adm g
  join public.obras o on o.id = g.obra_id
  left join public.clientes c on c.id = o.cliente_id;

-- ============================================================
-- Funções de negócio
-- ============================================================

-- Registra (p_id nulo) ou corrige uma NF. Só OC aprovada; soma das NFs não passa do valor da OC.
-- Corrigir uma NF reprovada a devolve para a engenharia.
create function public.salvar_nf(p_id bigint, p_dados jsonb) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare
  v_id bigint;
  v_oc record;
  v_valor numeric := (p_dados ->> 'valor')::numeric;
  v_outras numeric;
begin
  if not public.pode_lancar_nf() then raise exception 'Seu perfil não pode lançar notas fiscais.' using errcode = '42501'; end if;

  select id, obra_id, fornecedor_id, valor_total, status into v_oc
  from public.ordens_compra_resumo where id = (p_dados ->> 'ordem_compra_id')::bigint;
  if v_oc.id is null then raise exception 'Ordem de compra não encontrada.'; end if;
  if v_oc.status <> 'aprovada' then raise exception 'A nota só pode ser vinculada a uma OC aprovada.'; end if;
  if coalesce(v_valor, 0) <= 0 then raise exception 'Informe o valor da nota.'; end if;
  if coalesce(p_dados ->> 'numero', '') = '' then raise exception 'Informe o número da nota.'; end if;
  if coalesce(p_dados ->> 'vencimento', '') = '' then raise exception 'Informe o vencimento.'; end if;

  select coalesce(sum(valor), 0) into v_outras from public.notas_fiscais
   where ordem_compra_id = v_oc.id and status <> 'cancelada' and id is distinct from p_id;
  if v_outras + v_valor > v_oc.valor_total + 0.01 then
    raise exception 'O valor ultrapassa o saldo da OC (saldo: R$ %).', to_char(v_oc.valor_total - v_outras, 'FM999G999G990D00');
  end if;

  if p_id is null then
    insert into public.notas_fiscais (fase, ordem_compra_id, obra_id, fornecedor_id, numero, serie, emissao, vencimento, valor, observacao)
    values ((p_dados ->> 'fase')::public.fase_nf, v_oc.id, v_oc.obra_id, v_oc.fornecedor_id, trim(p_dados ->> 'numero'),
            coalesce(nullif(trim(p_dados ->> 'serie'), ''), '1'), nullif(p_dados ->> 'emissao', '')::date,
            (p_dados ->> 'vencimento')::date, v_valor, nullif(p_dados ->> 'observacao', ''))
    returning id into v_id;
  else
    update public.notas_fiscais
       set fase = (p_dados ->> 'fase')::public.fase_nf, ordem_compra_id = v_oc.id, obra_id = v_oc.obra_id,
           fornecedor_id = v_oc.fornecedor_id, numero = trim(p_dados ->> 'numero'),
           serie = coalesce(nullif(trim(p_dados ->> 'serie'), ''), '1'), emissao = nullif(p_dados ->> 'emissao', '')::date,
           vencimento = (p_dados ->> 'vencimento')::date, valor = v_valor, observacao = nullif(p_dados ->> 'observacao', ''),
           status = 'aguardando_engenharia', aprovado_por = null, aprovado_em = null, justificativa = null
     where id = p_id and status in ('aguardando_engenharia', 'reprovada')
    returning id into v_id;
    if v_id is null then raise exception 'Só notas aguardando engenharia ou reprovadas podem ser corrigidas.'; end if;
  end if;
  return v_id;
end $$;

-- Engenharia aprova ou reprova a NF.
create function public.decidir_nf(p_id bigint, p_aprovado boolean, p_justificativa text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_aprovar_nf() then raise exception 'Só a engenharia aprova notas fiscais.' using errcode = '42501'; end if;
  if not p_aprovado and coalesce(trim(p_justificativa), '') = '' then raise exception 'Informe a justificativa da reprovação.'; end if;

  update public.notas_fiscais
     set status = case when not p_aprovado then 'reprovada'::public.status_nf
                       when fase = 'cinza' then 'pendente_pagamento'::public.status_nf
                       else 'aguardando_guia'::public.status_nf end,
         aprovado_por = auth.uid(), aprovado_em = now(), justificativa = nullif(trim(p_justificativa), '')
   where id = p_id and status = 'aguardando_engenharia';
  if not found then raise exception 'Esta nota não está aguardando a engenharia.'; end if;
end $$;

-- Efetiva o pagamento de uma NF da Fase Cinza. Sem verba suficiente, exige p_forcar.
create function public.efetivar_pagamento(p_id bigint, p_data date, p_forcar boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare v_nf public.notas_fiscais; v_disp numeric;
begin
  if not public.pode_pagar() then raise exception 'Só o financeiro efetiva pagamentos.' using errcode = '42501'; end if;
  select * into v_nf from public.notas_fiscais where id = p_id for update;
  if v_nf.id is null or v_nf.fase <> 'cinza' or v_nf.status <> 'pendente_pagamento' then
    raise exception 'Esta nota não está pendente de pagamento.';
  end if;

  select disponivel into v_disp from public.obras_verba where obra_id = v_nf.obra_id;
  if coalesce(v_disp, 0) < v_nf.valor and not p_forcar then
    raise exception 'VERBA_INSUFICIENTE: verba disponível da obra R$ %, nota R$ %.',
      to_char(coalesce(v_disp, 0), 'FM999G999G990D00'), to_char(v_nf.valor, 'FM999G999G990D00');
  end if;

  update public.notas_fiscais
     set status = 'paga', pago_em = coalesce(p_data, current_date), pago_por = auth.uid(),
         pagamento_forcado = coalesce(v_disp, 0) < v_nf.valor
   where id = p_id;
end $$;

-- Desfaz um pagamento lançado por engano (volta para pendente).
create function public.estornar_pagamento(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.meu_papel() is distinct from 'admin' and not public.pode_pagar() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  update public.notas_fiscais set status = 'pendente_pagamento', pago_em = null, pago_por = null, pagamento_forcado = false
   where id = p_id and fase = 'cinza' and status = 'paga';
  if not found then raise exception 'Só notas pagas da Fase Cinza podem ser estornadas.'; end if;
end $$;

create function public.cancelar_nf(p_id bigint) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.pode_lancar_nf() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  update public.notas_fiscais set status = 'cancelada'
   where id = p_id and status in ('aguardando_engenharia', 'reprovada', 'pendente_pagamento', 'aguardando_guia');
  if not found then raise exception 'Notas pagas ou em guia não podem ser canceladas.'; end if;
end $$;

-- Cria uma guia com NFs da Fase Azul aprovadas da mesma obra.
create function public.criar_guia(p_obra_id bigint, p_nf_ids bigint[], p_observacao text) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare v_id bigint; v_qtd int;
begin
  if not public.pode_pagar() then raise exception 'Só o financeiro monta guias.' using errcode = '42501'; end if;
  if coalesce(array_length(p_nf_ids, 1), 0) = 0 then raise exception 'Selecione ao menos uma nota.'; end if;
  select count(*) into v_qtd from public.notas_fiscais
   where id = any (p_nf_ids) and obra_id = p_obra_id and fase = 'azul' and status = 'aguardando_guia';
  if v_qtd <> array_length(p_nf_ids, 1) then
    raise exception 'Todas as notas precisam ser da Fase Azul, da mesma obra e aguardando guia.';
  end if;

  insert into public.guias_adm (obra_id, observacao) values (p_obra_id, nullif(trim(p_observacao), '')) returning id into v_id;
  update public.notas_fiscais set status = 'em_guia', guia_id = v_id where id = any (p_nf_ids);
  return v_id;
end $$;

-- Avança a guia: enviada ao cliente → paga pelo cliente (baixa as NFs) ou cancelada (devolve as NFs).
create function public.atualizar_guia(p_id bigint, p_acao text, p_data date default null, p_nf_taxa boolean default null) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.pode_pagar() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_acao = 'enviar' then
    update public.guias_adm set status = 'enviada', enviada_em = coalesce(p_data, current_date) where id = p_id and status = 'aberta';
  elsif p_acao = 'pagar' then
    update public.guias_adm set status = 'paga', paga_em = coalesce(p_data, current_date) where id = p_id and status in ('aberta', 'enviada');
    if found then
      update public.notas_fiscais set status = 'paga', pago_em = coalesce(p_data, current_date), pago_por = auth.uid() where guia_id = p_id;
    end if;
  elsif p_acao = 'cancelar' then
    update public.guias_adm set status = 'cancelada' where id = p_id and status in ('aberta', 'enviada');
    if found then
      update public.notas_fiscais set status = 'aguardando_guia', guia_id = null where guia_id = p_id;
    end if;
  elsif p_acao = 'nf_taxa' then
    update public.guias_adm set nf_taxa_gerada = coalesce(p_nf_taxa, true) where id = p_id;
  else
    raise exception 'Ação inválida.';
  end if;
  if not found then raise exception 'A guia não está em um status que permita essa ação.'; end if;
end $$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.obra_aportes enable row level security;
alter table public.guias_adm enable row level security;
alter table public.notas_fiscais enable row level security;
alter table public.nf_anexos enable row level security;

do $$
declare t text;
begin
  foreach t in array array['obra_aportes', 'guias_adm', 'notas_fiscais', 'nf_anexos'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.usuario_ativo())', t);
  end loop;
end $$;

create policy obra_aportes_write on public.obra_aportes for all to authenticated
  using (public.pode_pagar()) with check (public.pode_pagar());

-- NFs e guias mudam só pelas funções acima; estas políticas cobrem as funções security invoker.
create policy notas_fiscais_insert on public.notas_fiscais for insert to authenticated with check (public.pode_lancar_nf());
create policy notas_fiscais_update on public.notas_fiscais for update to authenticated
  using (public.pode_lancar_nf() or public.pode_pagar()) with check (public.pode_lancar_nf() or public.pode_pagar());
create policy guias_adm_write on public.guias_adm for all to authenticated using (public.pode_pagar()) with check (public.pode_pagar());

create policy nf_anexos_insert on public.nf_anexos for insert to authenticated with check (public.pode_lancar_nf() or public.pode_aprovar_nf());
create policy nf_anexos_delete on public.nf_anexos for delete to authenticated using (public.pode_lancar_nf());

-- ============================================================
-- Armazenamento dos anexos (bucket privado)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('nf-anexos', 'nf-anexos', false, 20971520)
on conflict (id) do nothing;

create policy nf_anexos_ler on storage.objects for select to authenticated
  using (bucket_id = 'nf-anexos' and public.usuario_ativo());
create policy nf_anexos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'nf-anexos' and (public.pode_lancar_nf() or public.pode_aprovar_nf()));
create policy nf_anexos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'nf-anexos' and public.pode_lancar_nf());

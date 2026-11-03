-- MPH Sistema — endurecimento de acesso (auditoria de 03/11/2026). Não muda telas nem fluxo.
-- 1. Usuário novo entra INATIVO (o primeiro do sistema continua admin e ativo); o admin libera em perfis.ativo.
-- 2. Apropriações só mudam pelas funções do fluxo (que já conferem o perfil); a API direta deixa de gravar.
-- 3. Arquivos de mapa, OC, reembolso e obra: quem envia fica registrado; só quem enviou (ou o setor
--    responsável) pode apagar.
-- 4. Funções do banco deixam de ser executáveis sem login; as funções internas, só pelo próprio banco.
-- 5. Vincular NF (Cinza/Azul) trava a OC durante a conferência do saldo (evita passar do saldo em clique duplo).
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run (depois da 0019).

-- ------------------------------------------------------------------
-- 1. Usuário novo inativo
-- ------------------------------------------------------------------
alter table public.perfis alter column ativo set default false;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_primeiro boolean := not exists (select 1 from public.perfis);
begin
  insert into public.perfis (id, nome, email, papel, ativo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email,
    case when v_primeiro then 'admin'::public.papel else 'usuario'::public.papel end,
    v_primeiro
  );
  return new;
end $$;

-- ------------------------------------------------------------------
-- 2. Apropriações: sem gravação direta pela API
-- ------------------------------------------------------------------
drop policy if exists apropriacoes_write on public.apropriacoes;

-- ------------------------------------------------------------------
-- 3. Arquivos
-- ------------------------------------------------------------------
drop policy if exists mapa_arquivos_write on public.mapa_arquivos;
drop policy if exists mapa_arquivos_insert on public.mapa_arquivos;
drop policy if exists mapa_arquivos_delete on public.mapa_arquivos;
create policy mapa_arquivos_insert on public.mapa_arquivos for insert to authenticated
  with check (public.usuario_ativo() and enviado_por = auth.uid());
create policy mapa_arquivos_delete on public.mapa_arquivos for delete to authenticated
  using (public.usuario_ativo() and (enviado_por = auth.uid() or public.pode_comprar()));

drop policy if exists oc_arquivos_write on public.oc_arquivos;
drop policy if exists oc_arquivos_insert on public.oc_arquivos;
drop policy if exists oc_arquivos_delete on public.oc_arquivos;
create policy oc_arquivos_insert on public.oc_arquivos for insert to authenticated
  with check (public.usuario_ativo() and enviado_por = auth.uid());
create policy oc_arquivos_delete on public.oc_arquivos for delete to authenticated
  using (public.usuario_ativo() and (enviado_por = auth.uid() or public.pode_comprar()));

drop policy if exists reembolso_arquivos_write on public.reembolso_arquivos;
drop policy if exists reembolso_arquivos_insert on public.reembolso_arquivos;
drop policy if exists reembolso_arquivos_delete on public.reembolso_arquivos;
create policy reembolso_arquivos_insert on public.reembolso_arquivos for insert to authenticated
  with check (public.usuario_ativo() and enviado_por = auth.uid());
create policy reembolso_arquivos_delete on public.reembolso_arquivos for delete to authenticated
  using (public.usuario_ativo() and (enviado_por = auth.uid() or public.pode_lancar_nf()));

drop policy if exists obra_arquivos_insert on public.obra_arquivos;
create policy obra_arquivos_insert on public.obra_arquivos for insert to authenticated
  with check (public.usuario_ativo() and enviado_por = auth.uid());

-- Storage: apagar só o próprio arquivo, ou o setor responsável.
drop policy if exists mapa_arquivos_apagar on storage.objects;
create policy mapa_arquivos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'mapa-arquivos' and public.usuario_ativo() and (owner_id = auth.uid()::text or public.pode_comprar()));
drop policy if exists oc_arquivos_apagar on storage.objects;
create policy oc_arquivos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'oc-arquivos' and public.usuario_ativo() and (owner_id = auth.uid()::text or public.pode_comprar()));
drop policy if exists reembolso_arquivos_apagar on storage.objects;
create policy reembolso_arquivos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'reembolso-arquivos' and public.usuario_ativo() and (owner_id = auth.uid()::text or public.pode_lancar_nf()));

-- ------------------------------------------------------------------
-- 4. Execução de funções
-- ------------------------------------------------------------------
-- Sem login, nenhuma função do schema public pode ser chamada pela API (as políticas são todas "to authenticated").
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;

-- Funções internas: chamadas só de dentro das funções do fluxo (que rodam como dono do banco).
revoke execute on function public.verificar_pendencia_oc(bigint) from authenticated;
revoke execute on function public.recalcular_guia_adm(bigint) from authenticated;
revoke execute on function public.atualizar_situacao_nota_guia(bigint) from authenticated;
revoke execute on function public.proximo_numero_guia(bigint) from authenticated;

-- ------------------------------------------------------------------
-- 5. Vincular NF com a OC travada (mesmo texto da 0011, mais o "for update")
-- ------------------------------------------------------------------
create or replace function public.vincular_nf_cinza(p_oc bigint, p_dados jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_oc public.ocs_vinculo; v_valor numeric := (p_dados ->> 'valor')::numeric; v_id bigint;
begin
  if not public.pode_vincular_nf() then raise exception 'Seu perfil não pode vincular notas.' using errcode = '42501'; end if;
  perform 1 from public.ordens_compra where id = p_oc for update;
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
  perform 1 from public.ordens_compra where id = p_oc for update;
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

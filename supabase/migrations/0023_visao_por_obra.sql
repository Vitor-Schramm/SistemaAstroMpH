-- MPH Sistema — visão por obra, como no AstroTools: o Engenheiro só enxerga as obras em que está entre os
-- Responsáveis da obra (qualquer tipo). Os outros perfis continuam vendo todas as obras.
-- Vale para a leitura da obra e de tudo que pertence a ela (planilhas, CCs, solicitações, mapas, OCs, notas,
-- reembolsos, guias, pagamentos, arquivos). Listas, dashboards e consultas filtram sozinhos, porque as views
-- respeitam estas regras (security_invoker).
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run (depois da 0022).

create or replace function public.ve_obra(p_obra bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.meu_papel() <> 'engenharia', false)
      or exists (select 1 from public.obra_responsaveis r where r.obra_id = p_obra and r.perfil_id = auth.uid())
$$;
revoke execute on function public.ve_obra(bigint) from public, anon;

drop policy if exists obras_select on public.obras;
create policy obras_select on public.obras for select to authenticated using (public.meu_papel() is not null and public.ve_obra(id));

do $$
declare t text;
begin
  foreach t in array array['planilhas', 'centros_custo', 'pagamentos_cliente', 'obra_responsaveis', 'obra_filiais',
                           'solicitacoes', 'mapas', 'ordens_compra', 'ordens_reembolso', 'notas_fiscais', 'guias',
                           'guias_adm', 'obra_aportes', 'obra_arquivos'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.usuario_ativo() and public.ve_obra(obra_id))', t);
  end loop;
end $$;

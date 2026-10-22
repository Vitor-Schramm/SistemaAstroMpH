-- MPH Sistema — Arquivos da obra como no AstroTools: "Relatório de Obra" (Arquivo / Data Envio) e
-- "Upload Contrato da Obra" (Arquivo / Data), com download. Enviar um relatório atualiza o
-- "Ultimo Envio Relatório" do Controle Financeiro.
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run (depois da 0018).

create table if not exists public.obra_arquivos (
  id bigint generated always as identity primary key,
  obra_id bigint not null references public.obras (id) on delete cascade,
  tipo text not null check (tipo in ('relatorio', 'contrato')),
  caminho text not null,
  nome text not null,
  tamanho bigint,
  enviado_por uuid references public.perfis (id) default auth.uid(),
  enviado_em timestamptz not null default now()
);
create index if not exists obra_arquivos_obra on public.obra_arquivos (obra_id, tipo);

alter table public.obra_arquivos enable row level security;
drop policy if exists obra_arquivos_select on public.obra_arquivos;
create policy obra_arquivos_select on public.obra_arquivos for select to authenticated using (public.usuario_ativo());
drop policy if exists obra_arquivos_insert on public.obra_arquivos;
create policy obra_arquivos_insert on public.obra_arquivos for insert to authenticated with check (public.usuario_ativo());

insert into storage.buckets (id, name, public, file_size_limit)
values ('obra-arquivos', 'obra-arquivos', false, 20971520)
on conflict (id) do nothing;
drop policy if exists obra_arquivos_ler on storage.objects;
create policy obra_arquivos_ler on storage.objects for select to authenticated using (bucket_id = 'obra-arquivos' and public.usuario_ativo());
drop policy if exists obra_arquivos_enviar on storage.objects;
create policy obra_arquivos_enviar on storage.objects for insert to authenticated with check (bucket_id = 'obra-arquivos' and public.usuario_ativo());

-- Relatório enviado → "Ultimo Envio Relatório" da obra.
create or replace function public.t_obra_relatorio_enviado() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.tipo = 'relatorio' then
    update public.obras set ultimo_envio_relatorio = (new.enviado_em at time zone 'America/Sao_Paulo')::date where id = new.obra_id;
  end if;
  return new;
end $$;
drop trigger if exists t_obra_relatorio_enviado on public.obra_arquivos;
create trigger t_obra_relatorio_enviado after insert on public.obra_arquivos for each row execute function public.t_obra_relatorio_enviado();

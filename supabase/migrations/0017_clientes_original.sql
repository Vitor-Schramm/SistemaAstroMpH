-- MPH Sistema — Cadastro de Clientes como no AstroTools: dados fiscais, endereço completo, endereço de entrega
-- (obra), contato do mestre, dados da obra (tipo, metragem, seguro, CNO).
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run (depois da 0016).

alter table public.clientes
  add column if not exists ie text,
  add column if not exists email text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists cidade text,
  add column if not exists uf text,
  add column if not exists codigo_municipio text,
  add column if not exists cep_entrega text,
  add column if not exists endereco_entrega text,
  add column if not exists numero_entrega text,
  add column if not exists complemento_entrega text,
  add column if not exists bairro_entrega text,
  add column if not exists cidade_entrega text,
  add column if not exists uf_entrega text,
  add column if not exists contato_mestre text,
  add column if not exists telefone_mestre text,
  add column if not exists metragem numeric(12, 2),
  add column if not exists vencimento_seguro date,
  add column if not exists cno text;

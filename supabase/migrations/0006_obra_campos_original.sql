-- MPH Sistema — campos da obra e da planilha como no AstroTools.
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run (depois da 0005).

-- "As Built" no original é uma data, não um sim/não.
alter table public.obras add column if not exists as_built_em date;

-- Percentuais da planilha: além de Administração e Imposto, o original guarda
-- o valor total ("TOT", ex.: "Atualização total") usado no quadro Total Geral.
alter table public.planilha_percentuais drop constraint if exists planilha_percentuais_tipo_check;
alter table public.planilha_percentuais add constraint planilha_percentuais_tipo_check check (tipo in ('adm', 'imp', 'tot'));
alter table public.planilha_percentuais drop constraint if exists planilha_percentuais_valor_check;

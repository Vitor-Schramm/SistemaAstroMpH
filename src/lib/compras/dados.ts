import { createClient } from "@/lib/supabase/server";
import type { ItemCatalogo, Opcao } from "./tipos";

export async function opcoesObras(): Promise<Opcao[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("obras").select("id, codigo, nome").eq("ativo", true).order("codigo");
  return (data ?? []).map((o) => ({ valor: String(o.id), rotulo: `${o.codigo} — ${o.nome}` }));
}

export async function opcoesFornecedores(): Promise<(Opcao & { bloqueado: boolean })[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fornecedores_status")
    .select("id, nome, cpf_cnpj, bloqueio_id")
    .eq("ativo", true)
    .order("nome");
  return (data ?? []).map((f) => ({
    valor: String(f.id),
    rotulo: `${f.nome} — ${f.cpf_cnpj}`,
    bloqueado: Boolean(f.bloqueio_id),
  }));
}

export async function catalogoItens(): Promise<ItemCatalogo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("itens")
    .select("id, codigo, descricao, unidade, valor_medio")
    .eq("ativo", true)
    .order("descricao")
    .limit(10000);
  return (data ?? []) as ItemCatalogo[];
}

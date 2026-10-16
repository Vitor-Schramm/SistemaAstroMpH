import { createClient } from "@/lib/supabase/server";
import { getPerfil, podeEditarCadastros } from "@/lib/auth";
import { ENTIDADES } from "./config";
import type { Registro } from "@/components/cadastros/registro-form";

export async function carregarCadastro(chave: string) {
  const ent = ENTIDADES[chave];
  const [perfil, supabase] = await Promise.all([getPerfil(), createClient()]);
  const { data, error } = await supabase
    .from(ent.tabela)
    .select(ent.select ?? "*")
    .order(ent.ordem)
    .limit(5000);
  if (error) throw new Error(`Erro ao carregar ${ent.titulo}: ${error.message}`);

  return {
    registros: (data ?? []) as unknown as Registro[],
    podeEditar: perfil.ativo && podeEditarCadastros(perfil.papel),
    podeExcluir: perfil.ativo && perfil.papel === "admin",
  };
}

export async function opcoesClientes() {
  const supabase = await createClient();
  const { data } = await supabase.from("clientes").select("id, nome").eq("ativo", true).order("nome");
  return (data ?? []).map((c) => ({ valor: String(c.id), rotulo: c.nome as string }));
}

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, podeEditarCadastros } from "@/lib/auth";
import { BloqueadosView, type Bloqueado } from "./view";

export const metadata: Metadata = { title: "Fornecedores Bloqueados" };

export default async function FornecedoresBloqueadosPage() {
  const [perfil, supabase] = await Promise.all([getPerfil(), createClient()]);
  const { data, error } = await supabase
    .from("fornecedores_status")
    .select("id, cpf_cnpj, nome, nome_fantasia, ativo, bloqueio_id, bloqueio_justificativa, bloqueado_em, bloqueado_por_nome")
    .order("nome")
    .limit(5000);
  if (error) throw new Error(error.message);

  const todos = data ?? [];
  const bloqueados = todos.filter((f) => f.bloqueio_id) as Bloqueado[];
  const disponiveis = todos
    .filter((f) => !f.bloqueio_id && f.ativo)
    .map((f) => ({ valor: String(f.id), rotulo: `${f.nome} — ${f.cpf_cnpj}` }));

  return (
    <BloqueadosView
      bloqueados={bloqueados}
      disponiveis={disponiveis}
      podeEditar={perfil.ativo && podeEditarCadastros(perfil.papel)}
    />
  );
}

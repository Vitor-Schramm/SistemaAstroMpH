import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";
import { BloqueadosView, type Bloqueado } from "./view";

export const metadata: Metadata = { title: "Fornecedores Bloqueados" };

export default async function FornecedoresBloqueadosPage() {
  const [perfil, supabase] = await Promise.all([getPerfil(), createClient()]);
  const { data, error } = await supabase
    .from("fornecedores_status")
    .select("id, cpf_cnpj, nome, nome_fantasia, ativo, bloqueio_id, bloqueio_justificativa, bloqueado_em, bloqueado_por_nome")
    .order("nome")
    .limit(10000);
  if (error) throw new Error(error.message);

  const todos = data ?? [];
  const bloqueados = todos.filter((f) => f.bloqueio_id) as Bloqueado[];
  // "Fornecedores Ativos": CNPJ - Fantasia, como no original.
  const disponiveis = todos.filter((f) => !f.bloqueio_id && f.ativo).map((f) => ({ valor: String(f.id), rotulo: `${f.cpf_cnpj} - ${f.nome_fantasia ?? ""}` }));

  return (
    <>
      <CabecalhoPagina titulo="Fornecedores Bloqueados" migalhas={[{ titulo: "Cadastros" }, { titulo: "Fornecedores Bloqueados" }]} />
      <BloqueadosView bloqueados={bloqueados} disponiveis={disponiveis} ehAdmin={perfil.ativo && perfil.papel === "admin"} />
    </>
  );
}

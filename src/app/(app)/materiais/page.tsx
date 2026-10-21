import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { getPerfil, podeComprar } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TelaMateriais, type Material } from "./tela";

export const metadata: Metadata = { title: "Materiais" };

export default async function MateriaisPage() {
  const supabase = await createClient();
  const [perfil, { data: materiais, error }, { data: fornecedores }] = await Promise.all([
    getPerfil(),
    supabase.from("itens").select("id, descricao, unidade, tipo_item, fornecedor_preferencial_id, observacao, ativo").order("id").limit(20000),
    supabase.from("fornecedores").select("id, nome, nome_fantasia").eq("ativo", true).order("nome").limit(10000),
  ]);
  return (
    <>
      <CabecalhoPagina titulo="Materiais" migalhas={[{ titulo: "Materiais" }]} />
      {error ? (
        <p className="rounded-[0.428rem] bg-card p-4">A tela de Materiais precisa da migração 0016_perfil_suprimentos.sql.</p>
      ) : (
        <TelaMateriais
          materiais={(materiais ?? []) as Material[]}
          fornecedores={(fornecedores ?? []).map((f) => ({ valor: String(f.id), rotulo: `${f.nome} - ${f.nome_fantasia ?? ""}` }))}
          podeEditar={perfil.ativo && podeComprar(perfil.papel)}
        />
      )}
    </>
  );
}

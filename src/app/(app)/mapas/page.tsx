import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, podeComprar } from "@/lib/auth";
import { ListaMapas, type LinhaMapa } from "./lista";

export const metadata: Metadata = { title: "Mapas de cotação" };

export default async function MapasPage() {
  const [perfil, supabase] = await Promise.all([getPerfil(), createClient()]);
  const { data, error } = await supabase
    .from("mapas")
    .select(
      "id, servico, status, tipo, solicitacao_id, criado_em, obra:obras(codigo, nome, cliente:clientes!cliente_id(nome)), itens:mapa_itens(count), fornecedores:mapa_fornecedores(count)",
    )
    .order("id", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);

  return <ListaMapas linhas={(data ?? []) as unknown as LinhaMapa[]} podeComprar={perfil.ativo && podeComprar(perfil.papel)} />;
}

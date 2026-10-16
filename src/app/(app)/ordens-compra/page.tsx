import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, podeComprar } from "@/lib/auth";
import { ListaOcs, type LinhaOc } from "./lista";

export const metadata: Metadata = { title: "Ordens de compra" };

export default async function OrdensCompraPage() {
  const [perfil, supabase] = await Promise.all([getPerfil(), createClient()]);
  const { data, error } = await supabase
    .from("ordens_compra_resumo")
    .select(
      "id, status, data_emissao, obra_codigo, obra_nome, cliente_nome, fornecedor_nome, engenheiro_responsavel, valor_total, fornecedor_bloqueado, aprovado_engenharia, aprovado_financeiro, mapa_id",
    )
    .order("id", { ascending: false })
    .limit(3000);
  if (error) throw new Error(error.message);

  return <ListaOcs linhas={(data ?? []) as LinhaOc[]} podeComprar={perfil.ativo && podeComprar(perfil.papel)} />;
}

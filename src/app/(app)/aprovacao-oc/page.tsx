import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, papeisAprovador } from "@/lib/auth";
import { ListaAprovacao, type LinhaAprovacao } from "./lista";

export const metadata: Metadata = { title: "Aprovação de OC" };

export default async function AprovacaoOcPage() {
  const [perfil, supabase] = await Promise.all([getPerfil(), createClient()]);
  const { data, error } = await supabase
    .from("ordens_compra_resumo")
    .select(
      "id, data_emissao, obra_id, obra_codigo, obra_nome, cliente_nome, fornecedor_id, fornecedor_nome, engenheiro_responsavel, valor_total, aprovado_engenharia, aprovado_financeiro, fornecedor_bloqueado",
    )
    .eq("status", "aguardando_aprovacao")
    .order("data_emissao")
    .limit(2000);
  if (error) throw new Error(error.message);

  return (
    <ListaAprovacao
      linhas={(data ?? []) as LinhaAprovacao[]}
      meusPapeis={perfil.ativo ? papeisAprovador(perfil.papel) : []}
      admin={perfil.papel === "admin"}
    />
  );
}

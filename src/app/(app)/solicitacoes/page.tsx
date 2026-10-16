import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, podeComprar } from "@/lib/auth";
import { ListaSolicitacoes, type LinhaSolicitacao } from "./lista";

export const metadata: Metadata = { title: "Solicitações" };

export default async function SolicitacoesPage() {
  const [perfil, supabase] = await Promise.all([getPerfil(), createClient()]);
  const { data, error } = await supabase
    .from("solicitacoes")
    .select(
      "id, servico, status, criado_em, solicitante_id, obra:obras(codigo, nome, cliente:clientes(nome)), solicitante:perfis(nome), itens:solicitacao_itens(count)",
    )
    .order("id", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);

  return (
    <ListaSolicitacoes
      linhas={(data ?? []) as unknown as LinhaSolicitacao[]}
      podeComprar={perfil.ativo && podeComprar(perfil.papel)}
      usuarioId={perfil.id}
    />
  );
}

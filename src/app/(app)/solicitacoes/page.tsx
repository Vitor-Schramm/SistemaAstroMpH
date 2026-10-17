import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { carregarSolicitacoes } from "@/lib/solicitacoes/dados";
import { AvisoMigracao } from "./aviso";
import { GrupoSolicitacoes } from "./listas";

export const metadata: Metadata = { title: "Solicitações" };

export default async function SolicitacoesPage() {
  const solicitacoes = await carregarSolicitacoes();
  return (
    <>
      <CabecalhoPagina titulo="Solicitações" migalhas={[{ titulo: "Pedidos" }, { titulo: "Solicitações" }]} />
      {solicitacoes ? <GrupoSolicitacoes solicitacoes={solicitacoes} /> : <AvisoMigracao />}
    </>
  );
}

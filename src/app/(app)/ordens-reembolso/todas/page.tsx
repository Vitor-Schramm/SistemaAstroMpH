import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { getPerfil } from "@/lib/auth";
import { carregarReembolsos } from "@/lib/reembolsos/dados";
import { AvisoReembolsos } from "../aviso";
import { ListaReembolsos } from "../listas";

export const metadata: Metadata = { title: "Ordem Reembolso" };

// Botão de filtro da lista agrupada: as últimas 500 ordens, como no original.
export default async function TodasReembolsosPage() {
  const [, reembolsos] = await Promise.all([getPerfil(), carregarReembolsos({ limite: 500 })]);
  return (
    <>
      <CabecalhoPagina titulo="Ordem Reembolso" migalhas={[{ titulo: "Ordens Compra" }]} />
      {reembolsos ? <ListaReembolsos reembolsos={reembolsos} podeExcluir={false} /> : <AvisoReembolsos />}
    </>
  );
}

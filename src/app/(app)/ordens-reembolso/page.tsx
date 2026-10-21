import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { carregarReembolsos } from "@/lib/reembolsos/dados";
import { AvisoReembolsos } from "./aviso";
import { GrupoReembolsos } from "./listas";

export const metadata: Metadata = { title: "Ordem Reembolso" };

export default async function OrdensReembolsoPage() {
  const reembolsos = await carregarReembolsos();
  return (
    <>
      <CabecalhoPagina titulo="Ordem Reembolso" migalhas={[{ titulo: "Ordem Reembolso" }]} />
      {reembolsos ? <GrupoReembolsos reembolsos={reembolsos} /> : <AvisoReembolsos />}
    </>
  );
}

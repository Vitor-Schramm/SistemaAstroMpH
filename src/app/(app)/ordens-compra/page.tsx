import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { carregarOcs } from "@/lib/ocs/dados";
import { AvisoOcs } from "./aviso";
import { GrupoOcs } from "./listas";

export const metadata: Metadata = { title: "Ordem Compra" };

export default async function OrdensCompraPage() {
  const ocs = await carregarOcs();
  return (
    <>
      <CabecalhoPagina titulo="Ordem Compra" migalhas={[{ titulo: "Ordens Compra" }]} />
      {ocs ? <GrupoOcs ocs={ocs} /> : <AvisoOcs />}
    </>
  );
}

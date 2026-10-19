import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { opcoesFornecedores } from "@/lib/compras/dados";
import { obrasDaFase, ocsParaVinculo } from "@/lib/vinculo/dados";
import { AvisoVinculo } from "../aviso";
import { ListaVinculo } from "../lista-vinculo";

export const metadata: Metadata = { title: "Vincular Pedido x Nota" };

export default async function VincularAzulPage() {
  const [ocs, obras, fornecedores] = await Promise.all([ocsParaVinculo("azul"), obrasDaFase("azul"), opcoesFornecedores()]);
  return (
    <>
      <CabecalhoPagina titulo="Vincular Pedido x Nota" migalhas={[{ titulo: "NF's Fase Azul" }]} />
      {ocs ? <ListaVinculo fase="azul" ocs={ocs} obras={obras} fornecedores={fornecedores} /> : <AvisoVinculo />}
    </>
  );
}

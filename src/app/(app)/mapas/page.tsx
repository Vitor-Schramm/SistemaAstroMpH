import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { carregarMapas } from "@/lib/mapas/dados";
import { AvisoMapas } from "./aviso";
import { GrupoMapas } from "./listas";

export const metadata: Metadata = { title: "Mapas" };

export default async function MapasPage() {
  const mapas = await carregarMapas();
  return (
    <>
      <CabecalhoPagina titulo="Mapas" migalhas={[{ titulo: "Pedidos" }, { titulo: "Mapas" }]} />
      {mapas ? <GrupoMapas mapas={mapas} /> : <AvisoMapas />}
    </>
  );
}

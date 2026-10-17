import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { carregarMapas } from "@/lib/mapas/dados";
import { AvisoMapas } from "../../aviso";
import { ListaMapas } from "../../listas";

export const metadata: Metadata = { title: "Mapas" };

export default async function MapasClientePage({ params }: PageProps<"/mapas/cliente/[id]">) {
  const clienteId = Number((await params).id);
  if (!Number.isInteger(clienteId)) notFound();
  const todos = await carregarMapas(clienteId || undefined);
  const mapas = todos && !clienteId ? todos.filter((m) => m.cliente_id === null) : todos;
  return (
    <>
      <CabecalhoPagina titulo="Mapas" migalhas={[{ titulo: "Pedidos", href: "/mapas" }, { titulo: "Mapas" }]} />
      {mapas ? <ListaMapas mapas={mapas} /> : <AvisoMapas />}
    </>
  );
}

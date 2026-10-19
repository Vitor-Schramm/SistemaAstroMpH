import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { carregarOcs } from "@/lib/ocs/dados";
import { AvisoOcs } from "../../aviso";
import { ListaOcs } from "../../listas";

export const metadata: Metadata = { title: "Ordem Compra" };

export default async function OcsClientePage({ params }: PageProps<"/ordens-compra/cliente/[id]">) {
  const clienteId = Number((await params).id);
  if (!Number.isInteger(clienteId)) notFound();
  const todas = await carregarOcs(clienteId ? { clienteId } : undefined);
  const ocs = todas && !clienteId ? todas.filter((o) => o.cliente_id === null) : todas;
  return (
    <>
      <CabecalhoPagina titulo="Ordem Compra" migalhas={[{ titulo: "Ordens Compra", href: "/ordens-compra" }]} />
      {ocs ? <ListaOcs ocs={ocs} /> : <AvisoOcs />}
    </>
  );
}

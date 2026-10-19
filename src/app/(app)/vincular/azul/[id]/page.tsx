import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { carregarVinculo } from "@/lib/vinculo/dados";
import { AvisoVinculo } from "../../aviso";
import { VincularAzul } from "../../telas";

export const metadata: Metadata = { title: "Vincular Pedido x Nota" };

export default async function VincularAzulOcPage({ params }: PageProps<"/vincular/azul/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const d = await carregarVinculo(id, "azul");
  return (
    <>
      <CabecalhoPagina titulo="Vincular Pedido x Nota" migalhas={[{ titulo: "NF's Fase Azul", href: "/vincular/azul" }]} />
      {d.erro === "migracao" ? (
        <AvisoVinculo />
      ) : d.erro === "nao_liberada" ? (
        <p className="rounded-[0.428rem] bg-card p-4">A OC precisa estar liberada (sem pendência) para receber lançamentos.</p>
      ) : (
        <VincularAzul key={d.notas.map((n) => `${n.id}:${n.anexos.length}:${n.favorecido}`).join(",") + d.ccs.map((c) => c.disponivel).join(",")} cab={d.cab} notas={d.notas} ccs={d.ccs} />
      )}
    </>
  );
}

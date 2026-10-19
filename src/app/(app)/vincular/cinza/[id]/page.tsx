import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { carregarVinculo } from "@/lib/vinculo/dados";
import { AvisoVinculo } from "../../aviso";
import { VincularCinza } from "../../telas";

export const metadata: Metadata = { title: "Vincular OCXNF" };

export default async function VincularCinzaOcPage({ params }: PageProps<"/vincular/cinza/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const d = await carregarVinculo(id, "cinza");
  return (
    <>
      <CabecalhoPagina titulo="Vincular OCXNF" migalhas={[{ titulo: "Vincular NF", href: "/vincular/cinza" }]} />
      {d.erro === "migracao" ? (
        <AvisoVinculo />
      ) : d.erro === "nao_liberada" ? (
        <p className="rounded-[0.428rem] bg-card p-4">A OC precisa estar liberada (sem pendência) para receber notas.</p>
      ) : (
        <VincularCinza key={d.notas.map((n) => `${n.id}:${n.anexos.length}`).join(",")} cab={d.cab} notas={d.notas} />
      )}
    </>
  );
}

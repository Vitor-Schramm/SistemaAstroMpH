import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { AvisoGuias } from "@/components/guias/aviso";
import { TelaGuiaEnvio } from "@/components/guias/telas";
import { getPerfil, podePagar } from "@/lib/auth";
import { guiaPorId, linhasGuiaEnvio } from "@/lib/guias/dados";

export const metadata: Metadata = { title: "Guia de Envio" };

export default async function GuiaEnvioPage({ params }: PageProps<"/guias-envio/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [perfil, guia] = await Promise.all([getPerfil(), guiaPorId(id)]);
  if (guia === "migracao") return <AvisoGuias />;
  if (!guia) notFound();
  if (guia.tipo === "adm") redirect(`/guias-adm/${id}`);
  const { itens, disponiveis } = await linhasGuiaEnvio(guia);
  return (
    <>
      <CabecalhoPagina titulo="Guia de Envio" inicio="Obras" migalhas={[{ titulo: "Guia de Envio" }]} />
      <TelaGuiaEnvio
        key={itens.map((i) => `${i.rateio_id}:${i.anexos.length}`).join(",") + "|" + disponiveis.length}
        guia={guia}
        itens={itens}
        disponiveis={disponiveis}
        podeEditar={perfil.ativo && podePagar(perfil.papel)}
      />
    </>
  );
}

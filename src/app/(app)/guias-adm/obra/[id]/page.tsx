import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { AvisoGuias } from "@/components/guias/aviso";
import { ListaGuias } from "@/components/guias/telas";
import { getPerfil, podePagar } from "@/lib/auth";
import { guiasDaObra, obraDaGuia } from "@/lib/guias/dados";

export const metadata: Metadata = { title: "Guias Adm" };

// "Guias de Administração" da obra.
export default async function GuiasAdmObraPage({ params }: PageProps<"/guias-adm/obra/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [perfil, obra, guias] = await Promise.all([getPerfil(), obraDaGuia(id), guiasDaObra(id, "adm")]);
  if (!obra) notFound();
  return (
    <>
      <CabecalhoPagina titulo="Guias Adm" inicio="Obras" migalhas={[{ titulo: "Guias Adm" }]} />
      {guias ? <ListaGuias tipo="adm" obra={obra} guias={[...guias].reverse()} podeEditar={perfil.ativo && podePagar(perfil.papel)} /> : <AvisoGuias />}
    </>
  );
}

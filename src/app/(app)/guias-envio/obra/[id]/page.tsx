import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { AvisoGuias } from "@/components/guias/aviso";
import { ListaGuias } from "@/components/guias/telas";
import { getPerfil, podePagar } from "@/lib/auth";
import { guiasDaObra, obraDaGuia } from "@/lib/guias/dados";

export const metadata: Metadata = { title: "Guias Envio" };

// "Guias de Envio" da obra (Normal e ADM na mesma numeração), aberta pelo menu de opções do Controle Financeiro.
export default async function GuiasEnvioObraPage({ params }: PageProps<"/guias-envio/obra/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [perfil, obra, guias] = await Promise.all([getPerfil(), obraDaGuia(id), guiasDaObra(id)]);
  if (!obra) notFound();
  return (
    <>
      <CabecalhoPagina titulo="Guias Envio" inicio="Obras" migalhas={[{ titulo: "Guias Envio" }]} />
      {guias ? <ListaGuias tipo="envio" obra={obra} guias={guias} podeEditar={perfil.ativo && podePagar(perfil.papel)} /> : <AvisoGuias />}
    </>
  );
}

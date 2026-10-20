import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { AvisoGuias } from "@/components/guias/aviso";
import { ConsultaGuiasAdm } from "@/components/guias/telas";
import { getPerfil, podePagar } from "@/lib/auth";
import { todasGuiasAdm } from "@/lib/guias/dados";
import { obrasPorRegime } from "@/lib/notas/lista";

export const metadata: Metadata = { title: "Consulta Guias" };

// Menu "Guias Adm": Consulta Guias (filtro por obra administrada e vencimento).
export default async function GuiasAdmPage() {
  const [perfil, guias, obras] = await Promise.all([getPerfil(), todasGuiasAdm(), obrasPorRegime(["administracao"])]);
  return (
    <>
      <CabecalhoPagina titulo="Consulta Guias" migalhas={[{ titulo: "Guias Adm" }]} />
      {guias ? <ConsultaGuiasAdm guias={guias} obras={obras} podePagar={perfil.ativo && podePagar(perfil.papel)} /> : <AvisoGuias />}
    </>
  );
}

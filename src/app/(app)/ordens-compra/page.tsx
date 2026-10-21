import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { getPerfil, podeComprar } from "@/lib/auth";
import { carregarOcs } from "@/lib/ocs/dados";
import { AvisoOcs } from "./aviso";
import { GrupoOcs } from "./listas";

export const metadata: Metadata = { title: "Ordem Compra" };

export default async function OrdensCompraPage() {
  const [perfil, ocs] = await Promise.all([getPerfil(), carregarOcs()]);
  return (
    <>
      <CabecalhoPagina titulo="Ordem Compra" migalhas={[{ titulo: "Ordens Compra" }]} />
      {ocs ? <GrupoOcs ocs={ocs} podeCriar={perfil.ativo && podeComprar(perfil.papel)} /> : <AvisoOcs />}
    </>
  );
}

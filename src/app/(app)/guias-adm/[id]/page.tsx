import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { AvisoGuias } from "@/components/guias/aviso";
import { TelaGuiaAdm } from "@/components/guias/telas";
import { getPerfil, podePagar } from "@/lib/auth";
import { guiaPorId, guiasDaObra } from "@/lib/guias/dados";

export const metadata: Metadata = { title: "Guia de Adm" };

export default async function GuiaAdmPage({ params }: PageProps<"/guias-adm/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [perfil, guia] = await Promise.all([getPerfil(), guiaPorId(id)]);
  if (guia === "migracao") return <AvisoGuias />;
  if (!guia) notFound();
  if (guia.tipo !== "adm") redirect(`/guias-envio/${id}`);
  const todas = (await guiasDaObra(guia.obra_id)) ?? [];
  const normais = todas.filter((g) => g.tipo === "normal");
  return (
    <>
      <CabecalhoPagina titulo="Guia de Adm" inicio="Obras" migalhas={[{ titulo: "Guia de Administração" }]} />
      <TelaGuiaAdm
        key={`${guia.valor}:${guia.vencimento}:${guia.controle_parcela}:${guia.tipo_pagamento}`}
        guia={guia}
        incluidas={normais.filter((g) => g.guia_adm_id === guia.id)}
        disponiveis={normais.filter((g) => g.guia_adm_id == null && g.valor > 0)}
        podeEditar={perfil.ativo && podePagar(perfil.papel)}
      />
    </>
  );
}

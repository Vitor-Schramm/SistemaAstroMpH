import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { AvisoNotas } from "@/components/notas/aviso-notas";
import { TelaNotas } from "@/components/notas/telas-original";
import { getPerfil, podeAprovarNf, podePagar } from "@/lib/auth";
import { carregarNotas, obrasPorRegime } from "@/lib/notas/lista";

export const metadata: Metadata = { title: "Pagamentos" };

// Notas Fase Cinza: Pendentes (padrão) e Pagas (?situacao=pagas), como no menu do original.
export default async function NotasCinzaPage({ searchParams }: PageProps<"/notas-cinza">) {
  const pagas = (await searchParams).situacao === "pagas";
  const [perfil, notas, obras] = await Promise.all([
    getPerfil(),
    carregarNotas("cinza", pagas ? ["paga"] : ["pendente_pagamento"]),
    pagas ? obrasPorRegime(["fechado", "completo"]) : Promise.resolve([]),
  ]);
  const ativo = perfil.ativo;
  return (
    <>
      <CabecalhoPagina titulo={pagas ? "Pagamentos Realizados" : "Pagamentos Pendentes"} migalhas={[{ titulo: pagas ? "Pagamentos Realizados" : "Pagamentos Pendentes" }]} />
      {notas ? (
        <TelaNotas
          key={pagas ? "pagas" : "pendentes"}
          tela={pagas ? "pagas" : "pendentes"}
          notas={notas}
          obras={obras}
          podeAprovar={ativo && podeAprovarNf(perfil.papel)}
          podePagar={ativo && podePagar(perfil.papel)}
          podeExcluir={false}
        />
      ) : (
        <AvisoNotas />
      )}
    </>
  );
}

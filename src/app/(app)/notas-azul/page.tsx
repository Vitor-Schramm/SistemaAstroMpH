import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { AvisoNotas } from "@/components/notas/aviso-notas";
import { TelaNotas } from "@/components/notas/telas-original";
import { getPerfil, podeAprovarNf, podePagar } from "@/lib/auth";
import { carregarNotas, obrasPorRegime } from "@/lib/notas/lista";

export const metadata: Metadata = { title: "Notas Fase Azul" };

// Notas Fase Azul: Pendentes (padrão) e Pagas (?situacao=pagas).
export default async function NotasAzulPage({ searchParams }: PageProps<"/notas-azul">) {
  const pagas = (await searchParams).situacao === "pagas";
  const [perfil, notas, obras] = await Promise.all([
    getPerfil(),
    carregarNotas("azul", pagas ? ["em_guia", "paga"] : ["aguardando_engenharia", "aguardando_guia"]),
    pagas ? obrasPorRegime(["administracao", "completo"]) : Promise.resolve([]),
  ]);
  const ativo = perfil.ativo;
  return (
    <>
      <CabecalhoPagina
        titulo={pagas ? "Notas Vinculadas" : "Notas Pendentes Fase Azul"}
        migalhas={[{ titulo: pagas ? "Notas Vinculadas - Filtro" : "Notas Pendentes Fase Azul" }]}
      />
      {notas ? (
        <TelaNotas
          key={pagas ? "pagas" : "pendentes"}
          tela={pagas ? "azul_pagas" : "azul_pendentes"}
          notas={notas}
          obras={obras}
          podeAprovar={ativo && podeAprovarNf(perfil.papel)}
          podePagar={ativo && podePagar(perfil.papel)}
          podeExcluir={ativo && ["admin", "engenharia", "suprimentos", "financeiro"].includes(perfil.papel)}
        />
      ) : (
        <AvisoNotas />
      )}
    </>
  );
}

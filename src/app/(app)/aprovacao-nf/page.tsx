import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { AvisoNotas } from "@/components/notas/aviso-notas";
import { TelaNotas } from "@/components/notas/telas-original";
import { getPerfil, podeAprovarNf, podePagar } from "@/lib/auth";
import { carregarNotas } from "@/lib/notas/lista";

export const metadata: Metadata = { title: "Aprovação NF" };

export default async function AprovacaoNfPage() {
  const [perfil, notas] = await Promise.all([getPerfil(), carregarNotas("cinza", ["aguardando_engenharia"])]);
  const ativo = perfil.ativo;
  return (
    <>
      <CabecalhoPagina titulo="Aprovação NF" migalhas={[{ titulo: "Aprovação NF" }]} />
      {notas ? (
        <TelaNotas
          tela="aprovacao"
          notas={notas}
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

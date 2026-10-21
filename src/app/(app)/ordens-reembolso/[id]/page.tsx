import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { getPerfil } from "@/lib/auth";
import { ccsComSaldo } from "@/lib/mapas/dados";
import { carregarReembolso, filiaisPorObra, fornecedoresReembolso } from "@/lib/reembolsos/dados";
import { obrasSelect } from "@/lib/solicitacoes/dados";
import { AvisoReembolsos, podeEditarReembolso } from "../aviso";
import { TelaReembolso } from "../tela-reembolso";

export const metadata: Metadata = { title: "Vizualizar Ordem Reembolso" };

export default async function ReembolsoPage({ params }: PageProps<"/ordens-reembolso/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [perfil, d, obras, filiais, fornecedores] = await Promise.all([getPerfil(), carregarReembolso(id), obrasSelect(), filiaisPorObra(), fornecedoresReembolso()]);
  if (d === "migracao") return <AvisoReembolsos />;
  if (!d) notFound();
  const ccs = await ccsComSaldo(d.reembolso.obra_id);
  return (
    <>
      <CabecalhoPagina titulo="Vizualizar Ordem Reembolso" migalhas={[{ titulo: "Ordem de Reembolso" }]} />
      <TelaReembolso
        key={`${d.itens.map((i) => `${i.id}:${i.valor}`).join(",")}|${d.aprops.length}|${d.arquivos.length}|${d.reembolso.solicitacao_enviada}`}
        reembolso={d.reembolso}
        itens={d.itens}
        aprops={d.aprops}
        arquivos={d.arquivos}
        ccs={ccs}
        obras={obras}
        filiais={filiais}
        fornecedores={fornecedores}
        podeEditar={perfil.ativo && podeEditarReembolso(perfil.papel)}
      />
    </>
  );
}

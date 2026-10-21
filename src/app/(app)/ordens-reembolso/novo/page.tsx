import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { getPerfil } from "@/lib/auth";
import { filiaisPorObra, fornecedoresReembolso } from "@/lib/reembolsos/dados";
import { obrasSelect } from "@/lib/solicitacoes/dados";
import { podeEditarReembolso } from "../aviso";
import { TelaReembolso } from "../tela-reembolso";

export const metadata: Metadata = { title: "Adicionar Ordem de Reembolso" };

export default async function NovoReembolsoPage() {
  const [perfil, obras, filiais, fornecedores] = await Promise.all([getPerfil(), obrasSelect(), filiaisPorObra(), fornecedoresReembolso()]);
  return (
    <>
      <CabecalhoPagina titulo="Adicionar Ordem de Reembolso" migalhas={[{ titulo: "Ordem de Reembolso" }]} />
      <TelaReembolso reembolso={null} itens={[]} obras={obras} filiais={filiais} fornecedores={fornecedores} podeEditar={perfil.ativo && podeEditarReembolso(perfil.papel)} />
    </>
  );
}

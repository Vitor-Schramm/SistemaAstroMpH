import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { getPerfil, podeComprar } from "@/lib/auth";
import { catalogoItens } from "@/lib/compras/dados";
import { filiaisPorObra, fornecedoresReembolso } from "@/lib/reembolsos/dados";
import { obrasSelect } from "@/lib/solicitacoes/dados";
import { NovaOc } from "../nova-oc";

export const metadata: Metadata = { title: "Adicionar Ordem Compra" };

export default async function NovaOcPage() {
  const perfil = await getPerfil();
  if (!perfil.ativo || !podeComprar(perfil.papel)) redirect("/ordens-compra");
  const [obras, filiais, fornecedores, catalogo] = await Promise.all([obrasSelect(), filiaisPorObra(), fornecedoresReembolso(), catalogoItens()]);
  return (
    <>
      <CabecalhoPagina titulo="Adicionar Ordem Compra" migalhas={[{ titulo: "Ordens Compra", href: "/ordens-compra" }, { titulo: "Nova Ordem de Compra" }]} />
      <NovaOc obras={obras} filiais={filiais} fornecedores={fornecedores.map(({ valor, rotulo }) => ({ valor, rotulo }))} catalogo={catalogo} />
    </>
  );
}

import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { catalogoItens } from "@/lib/compras/dados";
import { obrasSelect } from "@/lib/solicitacoes/dados";
import { TelaSolicitacao } from "../tela-solicitacao";

export const metadata: Metadata = { title: "Adicionar Solicitação" };

export default async function NovaSolicitacaoPage() {
  const [obras, catalogo] = await Promise.all([obrasSelect(), catalogoItens()]);
  return (
    <>
      <CabecalhoPagina titulo="Adicionar Solicitação" migalhas={[{ titulo: "Pedidos", href: "/solicitacoes" }, { titulo: "Solicitações" }]} />
      <TelaSolicitacao cabecalho={null} itens={[]} obras={obras} catalogo={catalogo} ccs={[]} outras={[]} podeEditar />
    </>
  );
}

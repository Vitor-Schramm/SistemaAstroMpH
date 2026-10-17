import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { getPerfil } from "@/lib/auth";
import { carregarSolicitacoes } from "@/lib/solicitacoes/dados";
import { AvisoMigracao } from "../../aviso";
import { ListaSolicitacoes } from "../../listas";

export const metadata: Metadata = { title: "Solicitações" };

export default async function SolicitacoesClientePage({ params }: PageProps<"/solicitacoes/cliente/[id]">) {
  const clienteId = Number((await params).id);
  if (!Number.isInteger(clienteId)) notFound();
  const [perfil, todas] = await Promise.all([getPerfil(), carregarSolicitacoes(clienteId ? { clienteId } : undefined)]);
  const solicitacoes = todas && !clienteId ? todas.filter((s) => s.cliente_id === null) : todas;
  return (
    <>
      <CabecalhoPagina titulo="Solicitações" migalhas={[{ titulo: "Pedidos", href: "/solicitacoes" }, { titulo: "Solicitações" }]} />
      {solicitacoes ? <ListaSolicitacoes solicitacoes={solicitacoes} ehAdmin={perfil.ativo && perfil.papel === "admin"} /> : <AvisoMigracao />}
    </>
  );
}

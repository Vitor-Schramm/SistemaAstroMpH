import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { getPerfil } from "@/lib/auth";
import { carregarReembolsos } from "@/lib/reembolsos/dados";
import { AvisoReembolsos, podeEditarReembolso } from "../../aviso";
import { ListaReembolsos } from "../../listas";

export const metadata: Metadata = { title: "Ordem Reembolso" };

export default async function ReembolsosClientePage({ params }: PageProps<"/ordens-reembolso/cliente/[id]">) {
  const clienteId = Number((await params).id);
  if (!Number.isInteger(clienteId)) notFound();
  const [perfil, todas] = await Promise.all([getPerfil(), carregarReembolsos(clienteId ? { clienteId } : undefined)]);
  const reembolsos = todas && !clienteId ? todas.filter((r) => r.cliente_id === null) : todas;
  return (
    <>
      <CabecalhoPagina titulo="Ordem Reembolso" migalhas={[{ titulo: "Ordens Compra" }]} />
      {reembolsos ? <ListaReembolsos reembolsos={reembolsos} podeExcluir={perfil.ativo && podeEditarReembolso(perfil.papel)} /> : <AvisoReembolsos />}
    </>
  );
}

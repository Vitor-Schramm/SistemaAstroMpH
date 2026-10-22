import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { pagamentosObra } from "@/lib/obras/pagamentos-contratos";
import { TabelaPagamentos } from "./tabela";

export const metadata: Metadata = { title: "Pagamentos" };

// Opções da obra → "Pagamentos" (/obras/pagamentos/{id} no AstroTools): notas pagas da obra com o total.
export default async function PagamentosObraPage({ params }: PageProps<"/obras/[id]/pagamentos">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const linhas = await pagamentosObra(id);
  return (
    <>
      <CabecalhoPagina titulo="Pagamentos" migalhas={[{ titulo: "Obras", href: "/obras" }, { titulo: "Pagamentos" }]} />
      <TabelaPagamentos linhas={linhas} voltar={`/obras/${id}`} />
    </>
  );
}

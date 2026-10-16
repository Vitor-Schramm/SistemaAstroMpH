import type { Metadata } from "next";
import { CrudTable } from "@/components/cadastros/crud-table";
import { carregarCadastro } from "@/lib/cadastros/carregar";

export const metadata: Metadata = { title: "Itens / Materiais" };

export default async function ItensPage() {
  const dados = await carregarCadastro("itens");
  return <CrudTable chave="itens" {...dados} />;
}

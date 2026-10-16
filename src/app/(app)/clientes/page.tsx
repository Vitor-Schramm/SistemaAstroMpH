import type { Metadata } from "next";
import { CrudTable } from "@/components/cadastros/crud-table";
import { carregarCadastro } from "@/lib/cadastros/carregar";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage() {
  const dados = await carregarCadastro("clientes");
  return <CrudTable chave="clientes" {...dados} />;
}

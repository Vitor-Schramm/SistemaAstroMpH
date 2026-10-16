import type { Metadata } from "next";
import { CrudTable } from "@/components/cadastros/crud-table";
import { carregarCadastro, opcoesClientes } from "@/lib/cadastros/carregar";

export const metadata: Metadata = { title: "Obras" };

export default async function ObrasPage() {
  const [dados, clientes] = await Promise.all([carregarCadastro("obras"), opcoesClientes()]);
  return <CrudTable chave="obras" {...dados} opcoes={{ clientes }} linkDetalhe="/obras" />;
}

import type { Metadata } from "next";
import { carregarCadastro, opcoesClientes } from "@/lib/cadastros/carregar";
import { ListaObras } from "./lista";

export const metadata: Metadata = { title: "Listagem de Obras" };

export default async function ObrasPage() {
  const [dados, clientes] = await Promise.all([carregarCadastro("obras"), opcoesClientes()]);
  return <ListaObras registros={dados.registros} opcoes={{ clientes }} podeEditar={dados.podeEditar} podeExcluir={dados.podeExcluir} />;
}

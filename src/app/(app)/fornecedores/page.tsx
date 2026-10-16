import type { Metadata } from "next";
import { CrudTable } from "@/components/cadastros/crud-table";
import { carregarCadastro } from "@/lib/cadastros/carregar";

export const metadata: Metadata = { title: "Fornecedores" };

export default async function FornecedoresPage() {
  const dados = await carregarCadastro("fornecedores");
  const bloqueados: Record<number, string> = {};
  for (const f of dados.registros) {
    const bloqueios = (f.bloqueios ?? []) as { desbloqueado_em: string | null }[];
    if (bloqueios.some((b) => !b.desbloqueado_em)) bloqueados[f.id!] = "Bloqueado";
  }
  return <CrudTable chave="fornecedores" {...dados} extraStatus={bloqueados} />;
}

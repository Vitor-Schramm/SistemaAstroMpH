import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { getPerfil, podeEditarCadastros } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TelaFornecedores, type BuscaFornecedor, type Fornecedor } from "./tela";

export const metadata: Metadata = { title: "Fornecedores" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

// Como no original, a lista só mostra resultado depois da "Busca Avançada".
export default async function FornecedoresPage({ searchParams }: PageProps<"/fornecedores">) {
  const sp = await searchParams;
  const busca: BuscaFornecedor = { cpf: str(sp.cpf), nome: str(sp.nome), classificacao: str(sp.classificacao), status: str(sp.status) };
  const buscou = str(sp.buscar) === "1";
  const perfil = await getPerfil();
  let fornecedores: Fornecedor[] = [];
  if (buscou) {
    const supabase = await createClient();
    let q = supabase.from("fornecedores_status").select("*");
    if (busca.cpf) q = q.ilike("cpf_cnpj", `%${busca.cpf}%`);
    if (busca.nome) q = q.or(`nome.ilike.%${busca.nome.replace(/[,()]/g, " ")}%,nome_fantasia.ilike.%${busca.nome.replace(/[,()]/g, " ")}%`);
    if (busca.classificacao) q = q.ilike("classificacao", `%${busca.classificacao}%`);
    if (busca.status) q = q.eq("ativo", busca.status === "ativo");
    const { data } = await q.order("id").limit(5000);
    fornecedores = ((data ?? []) as (Fornecedor & { bloqueio_id: number | null })[]).map((f) => ({ ...f, bloqueado: f.bloqueio_id != null }));
  }
  return (
    <>
      <CabecalhoPagina titulo="Fornecedores" migalhas={[{ titulo: "Cadastros" }, { titulo: "Fornecedores" }]} />
      <TelaFornecedores key={JSON.stringify(busca) + buscou} fornecedores={fornecedores} busca={busca} buscou={buscou} podeEditar={perfil.ativo && podeEditarCadastros(perfil.papel)} />
    </>
  );
}

import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { getPerfil, podeEditarCadastros } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TelaClientes, type Cliente } from "./tela";

export const metadata: Metadata = { title: "Cadastro de Clientes" };

export default async function ClientesPage({ searchParams }: PageProps<"/clientes">) {
  const inativos = (await searchParams).inativos === "1";
  const supabase = await createClient();
  const [perfil, { data }] = await Promise.all([getPerfil(), supabase.from("clientes").select("*").eq("ativo", !inativos).order("id").limit(5000)]);
  return (
    <>
      <CabecalhoPagina titulo="Cadastro de Clientes" migalhas={[{ titulo: "Clientes" }]} />
      <TelaClientes key={String(inativos)} clientes={(data ?? []) as Cliente[]} inativos={inativos} podeEditar={perfil.ativo && podeEditarCadastros(perfil.papel)} />
    </>
  );
}

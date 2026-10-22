import type { Metadata } from "next";
import { getPerfil } from "@/lib/auth";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { AbasConta } from "./abas";
import { FormPerfil } from "./forms";

export const metadata: Metadata = { title: "Account" };

// "Minha Conta" → "Dados da Conta" do AstroTools: Nome e Celular, com Salvar e Cancelar.
export default async function MinhaContaPage() {
  const perfil = await getPerfil();
  return (
    <>
      <CabecalhoPagina titulo="Account" migalhas={[{ titulo: "Minha Conta", href: "/minha-conta" }, { titulo: "Dados da Conta" }]} />
      <AbasConta ativa="/minha-conta" />
      <FormPerfil nome={perfil.nome} celular={perfil.celular ?? ""} />
    </>
  );
}

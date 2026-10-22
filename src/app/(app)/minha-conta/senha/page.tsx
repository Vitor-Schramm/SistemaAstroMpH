import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { AbasConta } from "../abas";
import { FormSenha } from "../forms";

export const metadata: Metadata = { title: "Senha" };

// "Minha Conta" → "Trocar Senha" do AstroTools: senha atual, nova senha e confirmação, com a recomendação de senha.
export default function SenhaPage() {
  return (
    <>
      <CabecalhoPagina titulo="Senha" migalhas={[{ titulo: "Minha Conta", href: "/minha-conta" }, { titulo: "Trocar Senha" }]} />
      <AbasConta ativa="/minha-conta/senha" />
      <FormSenha />
    </>
  );
}

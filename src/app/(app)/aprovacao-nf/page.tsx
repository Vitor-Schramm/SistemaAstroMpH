import type { Metadata } from "next";
import { getPerfil, podeAprovarNf } from "@/lib/auth";
import { carregarNotas } from "@/lib/notas/dados";
import { AprovacaoNfView } from "./view";

export const metadata: Metadata = { title: "Aprovação NF" };

export default async function AprovacaoNfPage() {
  const [perfil, notas] = await Promise.all([getPerfil(), carregarNotas({ status: ["aguardando_engenharia", "reprovada"] })]);
  return <AprovacaoNfView notas={notas} podeAprovar={perfil.ativo && podeAprovarNf(perfil.papel)} />;
}

import type { Metadata } from "next";
import { getPerfil, podeLancarNf, podePagar } from "@/lib/auth";
import { carregarNotas } from "@/lib/notas/dados";
import { NotasAzulView } from "./view";

export const metadata: Metadata = { title: "Notas Fase Azul" };

export default async function NotasAzulPage() {
  const [perfil, notas] = await Promise.all([getPerfil(), carregarNotas({ fase: "azul" })]);
  return (
    <NotasAzulView
      notas={notas}
      podeGuia={perfil.ativo && podePagar(perfil.papel)}
      podeLancar={perfil.ativo && podeLancarNf(perfil.papel)}
    />
  );
}

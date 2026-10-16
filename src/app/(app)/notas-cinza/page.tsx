import type { Metadata } from "next";
import { getPerfil, podeLancarNf, podePagar } from "@/lib/auth";
import { carregarNotas } from "@/lib/notas/dados";
import { NotasCinzaView } from "./view";

export const metadata: Metadata = { title: "Notas Fase Cinza" };

export default async function NotasCinzaPage() {
  const [perfil, notas] = await Promise.all([getPerfil(), carregarNotas({ fase: "cinza" })]);
  return (
    <NotasCinzaView
      notas={notas}
      podePagar={perfil.ativo && podePagar(perfil.papel)}
      podeLancar={perfil.ativo && podeLancarNf(perfil.papel)}
    />
  );
}

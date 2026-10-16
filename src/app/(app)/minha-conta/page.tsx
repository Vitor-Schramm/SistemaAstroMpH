import type { Metadata } from "next";
import { getPerfil } from "@/lib/auth";
import { ContaForms } from "./forms";

export const metadata: Metadata = { title: "Minha conta" };

export default async function MinhaContaPage() {
  const perfil = await getPerfil();
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Minha conta</h1>
      <ContaForms nome={perfil.nome} email={perfil.email} celular={perfil.celular ?? ""} papel={perfil.papel} />
    </div>
  );
}

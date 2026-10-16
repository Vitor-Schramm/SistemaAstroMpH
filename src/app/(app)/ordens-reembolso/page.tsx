import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, podeAprovarNf, podePagar } from "@/lib/auth";
import type { ReembolsoResumo } from "@/lib/reembolsos/tipos";
import { ListaReembolsos } from "./lista";

export const metadata: Metadata = { title: "Ordens de reembolso" };

export default async function ReembolsosPage() {
  const [perfil, supabase] = await Promise.all([getPerfil(), createClient()]);
  const { data, error } = await supabase.from("reembolsos_resumo").select("*").order("id", { ascending: false }).limit(3000);
  if (error) throw new Error(error.message);
  return (
    <ListaReembolsos
      linhas={(data ?? []) as ReembolsoResumo[]}
      podeAprovar={perfil.ativo && podeAprovarNf(perfil.papel)}
      podePagar={perfil.ativo && podePagar(perfil.papel)}
    />
  );
}

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, podePagar } from "@/lib/auth";
import { GuiasView, type Guia, type NotaGuia } from "./view";

export const metadata: Metadata = { title: "Guias Adm" };

export default async function GuiasAdmPage() {
  const [perfil, supabase] = await Promise.all([getPerfil(), createClient()]);
  const [{ data: guias, error }, { data: notas }] = await Promise.all([
    supabase.from("guias_resumo").select("*").order("id", { ascending: false }).limit(2000),
    supabase
      .from("notas_resumo")
      .select("id, guia_id, numero, serie, vencimento, valor, fornecedor_nome, status")
      .not("guia_id", "is", null)
      .limit(10000),
  ]);
  if (error) throw new Error(error.message);

  return <GuiasView guias={(guias ?? []) as Guia[]} notas={(notas ?? []) as NotaGuia[]} podeEditar={perfil.ativo && podePagar(perfil.papel)} />;
}

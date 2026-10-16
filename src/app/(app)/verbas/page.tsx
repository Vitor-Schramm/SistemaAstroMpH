import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, podePagar } from "@/lib/auth";
import { VerbasView, type Aporte, type VerbaObra } from "./view";

export const metadata: Metadata = { title: "Verbas das obras" };

export default async function VerbasPage() {
  const [perfil, supabase] = await Promise.all([getPerfil(), createClient()]);
  const [{ data: verbas, error }, { data: aportes }] = await Promise.all([
    supabase.from("obras_verba").select("*").order("codigo"),
    supabase.from("obra_aportes").select("id, obra_id, data, valor, descricao, criado_em, lancado:perfis(nome)").order("data", { ascending: false }).limit(10000),
  ]);
  if (error) throw new Error(error.message);

  return (
    <VerbasView
      verbas={(verbas ?? []) as VerbaObra[]}
      aportes={(aportes ?? []) as unknown as Aporte[]}
      podeLancar={perfil.ativo && podePagar(perfil.papel)}
    />
  );
}

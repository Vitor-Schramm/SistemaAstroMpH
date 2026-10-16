import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, podeAprovarNf } from "@/lib/auth";
import { carregarNotas } from "@/lib/notas/dados";
import type { ReembolsoResumo } from "@/lib/reembolsos/tipos";
import { AprovacaoNfView } from "./view";

export const metadata: Metadata = { title: "Aprovação NF" };

export default async function AprovacaoNfPage() {
  const supabase = await createClient();
  const [perfil, notas, { data: reembolsos }] = await Promise.all([
    getPerfil(),
    carregarNotas({ status: ["aguardando_engenharia", "reprovada"] }),
    supabase.from("reembolsos_resumo").select("*").eq("status", "aguardando_aprovacao").order("id"),
  ]);
  return (
    <AprovacaoNfView
      notas={notas}
      reembolsos={(reembolsos ?? []) as ReembolsoResumo[]}
      podeAprovar={perfil.ativo && podeAprovarNf(perfil.papel)}
    />
  );
}

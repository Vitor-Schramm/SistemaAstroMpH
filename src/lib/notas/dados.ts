import { createClient } from "@/lib/supabase/server";
import { SELECT_NOTAS, type NotaResumo } from "./tipos";

export async function carregarNotas(filtro: { fase?: "cinza" | "azul"; status?: string[] }): Promise<NotaResumo[]> {
  const supabase = await createClient();
  let q = supabase.from("notas_resumo").select(SELECT_NOTAS).neq("status", "cancelada");
  if (filtro.fase) q = q.eq("fase", filtro.fase);
  if (filtro.status) q = q.in("status", filtro.status);
  const { data, error } = await q.order("vencimento").limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as NotaResumo[];
}

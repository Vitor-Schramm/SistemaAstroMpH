import { createClient } from "@/lib/supabase/server";

export type Notificacao = { id: number; titulo: string; texto: string | null; link: string | null; lida: boolean; criado_em: string };

/** Sino da barra superior: não lidas e as 5 mais recentes. null quando a migração 0016 ainda não foi rodada. */
export async function resumoNotificacoes(): Promise<{ naoLidas: number; recentes: Notificacao[] } | null> {
  const supabase = await createClient();
  const [{ count, error }, { data }] = await Promise.all([
    supabase.from("notificacoes").select("id", { count: "exact", head: true }).eq("lida", false),
    supabase.from("notificacoes").select("id, titulo, texto, link, lida, criado_em").eq("lida", false).order("criado_em", { ascending: false }).limit(5),
  ]);
  if (error) return null;
  return { naoLidas: count ?? 0, recentes: (data ?? []) as Notificacao[] };
}

export async function minhasNotificacoes(lidas: boolean) {
  const supabase = await createClient();
  const [{ data, error }, { count: naoLidas }, { count: lidasQtd }] = await Promise.all([
    supabase.from("notificacoes").select("id, titulo, texto, link, lida, criado_em").eq("lida", lidas).order("criado_em", { ascending: false }).limit(500),
    supabase.from("notificacoes").select("id", { count: "exact", head: true }).eq("lida", false),
    supabase.from("notificacoes").select("id", { count: "exact", head: true }).eq("lida", true),
  ]);
  if (error) return null;
  return { lista: (data ?? []) as Notificacao[], naoLidas: naoLidas ?? 0, lidas: lidasQtd ?? 0 };
}

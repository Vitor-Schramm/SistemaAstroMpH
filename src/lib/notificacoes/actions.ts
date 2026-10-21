"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";

type Resultado = { ok: true } | { ok: false; erro: string };

export async function marcarLidas(ids: number[]): Promise<Resultado> {
  if (!ids.length) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("notificacoes").update({ lida: true }).in("id", ids);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function excluirNotificacoes(ids: number[]): Promise<Resultado> {
  if (!ids.length) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("notificacoes").delete().in("id", ids);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath("/", "layout");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";

export type DadosMaterial = { nome: string; unid_med: string; tipo_item: string; fornecedor_preferencial_id: string; observacao: string };
type Resultado = { ok: true } | { ok: false; erro: string };

async function chamar(fn: string, args: Record<string, unknown>): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath("/materiais");
  revalidatePath("/itens");
  return { ok: true };
}

export const salvarMaterial = async (id: number | null, dados: DadosMaterial) => chamar("salvar_material", { p_id: id, p_dados: dados });
export const ativarMaterial = async (id: number, ativo: boolean) => chamar("ativar_material", { p_id: id, p_ativo: ativo });

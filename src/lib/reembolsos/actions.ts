"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Resultado = { ok: true; id?: number } | { ok: false; erro: string; verbaInsuficiente?: boolean };

async function rpc(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  return { data, erro: error?.message };
}

function revalidar(id?: number) {
  for (const r of ["/ordens-reembolso", "/verbas", "/", "/financeiro", "/consultas"]) revalidatePath(r);
  if (id) revalidatePath(`/ordens-reembolso/${id}`);
}

export async function salvarReembolso(id: number | null, dados: Record<string, unknown>, itens: Record<string, unknown>[]): Promise<Resultado> {
  if (!dados.obra_id) return { ok: false, erro: "Selecione a obra." };
  if (!dados.fornecedor_id) return { ok: false, erro: "Selecione o fornecedor/favorecido." };
  const { data, erro } = await rpc("salvar_reembolso", { p_id: id, p_dados: dados, p_itens: itens });
  if (erro) return { ok: false, erro };
  revalidar(Number(data));
  return { ok: true, id: Number(data) };
}

export async function enviarReembolso(id: number): Promise<Resultado> {
  const { erro } = await rpc("enviar_reembolso", { p_id: id });
  if (erro) return { ok: false, erro };
  revalidar(id);
  return { ok: true };
}

export async function decidirReembolso(id: number, aprovado: boolean, justificativa: string): Promise<Resultado> {
  const { erro } = await rpc("decidir_reembolso", { p_id: id, p_aprovado: aprovado, p_justificativa: justificativa });
  if (erro) return { ok: false, erro };
  revalidar(id);
  return { ok: true };
}

export async function pagarReembolso(id: number, data: string, forcar: boolean): Promise<Resultado> {
  const { erro } = await rpc("pagar_reembolso", { p_id: id, p_data: data || null, p_forcar: forcar });
  if (erro) {
    if (erro.startsWith("VERBA_INSUFICIENTE")) return { ok: false, verbaInsuficiente: true, erro: erro.replace("VERBA_INSUFICIENTE: ", "Verba insuficiente: ") };
    return { ok: false, erro };
  }
  revalidar(id);
  return { ok: true };
}

export async function cancelarReembolso(id: number): Promise<Resultado> {
  const { erro } = await rpc("cancelar_reembolso", { p_id: id });
  if (erro) return { ok: false, erro };
  revalidar(id);
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";

export type Resultado = { ok: true; id?: number } | { ok: false; erro: string };

async function chamar(fn: string, args: Record<string, unknown>): Promise<Resultado> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  for (const r of ["/guias-envio", "/guias-adm", "/notas-azul", "/obras"]) revalidatePath(r, "layout");
  return { ok: true, id: data == null ? undefined : Number(data) };
}

export const criarGuiaEnvio = async (obraId: number) => chamar("criar_guia_envio", { p_obra: obraId });
export const adicionarItemGuia = async (guiaId: number, rateioId: number) => chamar("adicionar_item_guia", { p_guia: guiaId, p_rateio: rateioId });
export const excluirItemGuia = async (itemId: number) => chamar("excluir_item_guia", { p_item: itemId });

export type DadosGuiaAdm = { controle_parcela: string; conta_faturamento: string; vencimento: string; tipo_documento: string; tipo_pagamento: string };
export const salvarGuiaAdm = async (obraId: number, id: number | null, dados: DadosGuiaAdm) => chamar("salvar_guia_adm", { p_obra: obraId, p_id: id, p_dados: dados });
export const adicionarGuiaNaAdm = async (admId: number, guiaId: number) => chamar("adicionar_guia_na_adm", { p_adm: admId, p_guia: guiaId });
export const removerGuiaDaAdm = async (guiaId: number) => chamar("remover_guia_da_adm", { p_guia: guiaId });
export const pagarGuiaAdm = async (id: number, pagar: boolean) => chamar("pagar_guia_adm", { p_id: id, p_pagar: pagar });

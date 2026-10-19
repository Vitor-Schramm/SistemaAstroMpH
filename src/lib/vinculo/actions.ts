"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";

export type Resultado = { ok: true; id?: number; url?: string } | { ok: false; erro: string };

async function chamar(fn: string, args: Record<string, unknown>, ocId?: number): Promise<Resultado> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  for (const r of ["/vincular/cinza", "/vincular/azul", "/aprovacao-nf", "/notas-cinza", "/notas-azul", "/ordens-compra"]) revalidatePath(r, "layout");
  if (ocId) {
    revalidatePath(`/vincular/cinza/${ocId}`);
    revalidatePath(`/vincular/azul/${ocId}`);
  }
  return { ok: true, id: data == null ? undefined : Number(data) };
}

export const vincularNfCinza = async (ocId: number, dados: { numero: string; serie: string; tipo_documento: string; vencimento: string; valor: number }) =>
  chamar("vincular_nf_cinza", { p_oc: ocId, p_dados: dados }, ocId);

export const vincularNfAzul = async (
  ocId: number,
  dados: { numero: string; tipo_documento: string; vencimento: string; tipo_pagamento: string },
  rateio: { cc_id: number; valor: number }[],
) => chamar("vincular_nf_azul", { p_oc: ocId, p_dados: dados, p_rateio: rateio }, ocId);

export const editarLancamentoAzul = async (ocId: number, id: number, dados: { numero: string; tipo_documento: string; vencimento: string; tipo_pagamento: string }) =>
  chamar("editar_lancamento_azul", { p_id: id, p_dados: dados }, ocId);

export const editarBancoLancamento = async (ocId: number, id: number, dados: { cpf_cnpj: string; favorecido: string; banco: string; agencia: string; conta: string }) =>
  chamar("editar_banco_lancamento", { p_id: id, p_dados: dados }, ocId);

export const excluirLancamento = async (ocId: number, id: number) => chamar("excluir_lancamento_nf", { p_id: id }, ocId);

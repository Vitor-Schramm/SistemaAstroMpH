"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";

export type Resultado = { ok: true; id?: number; url?: string } | { ok: false; erro: string };

async function chamar(fn: string, args: Record<string, unknown>, ocId?: number): Promise<Resultado> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath("/ordens-compra", "layout");
  revalidatePath("/aprovacao-oc");
  if (ocId) revalidatePath(`/ordens-compra/${ocId}`);
  return { ok: true, id: data == null ? undefined : Number(data) };
}

/** "Nova Ordem de Compra" direta (Suprimentos), sem mapa. */
export type DadosOcDireta = DadosOc & { obra_id: string; filial_cliente_id: string; fornecedor_id: string; percentual_especial: string; frete: string; desconto: string };
export type ItemOcDireta = { e_titulo: boolean; item_id: number | null; codigo: string; descricao: string; quantidade: number; unidade: string; valor_unitario: number; valor_impostos: number };
export const criarOcDireta = async (dados: DadosOcDireta, itens: ItemOcDireta[]) => chamar("criar_oc_direta", { p_dados: dados, p_itens: itens });

export type DadosOc = {
  nome: string;
  numero_cliente: string;
  observacao: string;
  tipo: string;
  data_entrega: string;
  prazo_locacao: string;
  data_devolucao: string;
  forma_pagamento: string;
  prazo: string;
};

export type ItemOcEnvio = {
  id?: number;
  e_titulo: boolean;
  item_id: number | null;
  codigo: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_impostos: number;
  excluir?: boolean;
};

export async function salvarOc(id: number, dados: DadosOc, itens: ItemOcEnvio[], complemento: Record<string, string>): Promise<Resultado> {
  const r = await chamar("salvar_oc_original", { p_id: id, p_dados: dados, p_itens: itens }, id);
  if (!r.ok) return r;
  return chamar("salvar_oc_complemento", { p_id: id, p_dados: complemento }, id);
}

export const apropriarOc = async (ocId: number, ccId: number, valor: number) =>
  ccId ? chamar("apropriar_oc", { p_oc: ocId, p_cc: ccId, p_valor: valor }, ocId) : ({ ok: false, erro: "Selecione a apropriação." } as Resultado);
export const excluirApropriacaoOc = async (ocId: number, id: number) => chamar("excluir_apropriacao_oc", { p_id: id }, ocId);
export const zerarSaldoOc = async (ocId: number) => chamar("zerar_saldo_oc", { p_oc: ocId }, ocId);
export const alternarRegularizacaoOc = async (ocId: number) => chamar("alternar_regularizacao_oc", { p_id: ocId }, ocId);
export const liberarOc = async (ocId: number, liberar: boolean, perfil: string, justificativa: string) =>
  chamar("liberar_oc", { p_oc: ocId, p_liberar: liberar, p_perfil: perfil, p_justificativa: justificativa }, ocId);

export async function registrarArquivoOc(ocId: number, caminho: string, nome: string, tamanho: number): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.from("oc_arquivos").insert({ ordem_compra_id: ocId, caminho, nome, tamanho });
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath(`/ordens-compra/${ocId}`);
  return { ok: true };
}

export async function linkArquivoOc(id: number): Promise<Resultado> {
  const supabase = await createClient();
  const { data: a } = await supabase.from("oc_arquivos").select("caminho, nome").eq("id", id).maybeSingle();
  if (!a) return { ok: false, erro: "Arquivo não encontrado." };
  const { data, error } = await supabase.storage.from("oc-arquivos").createSignedUrl(a.caminho, 120, { download: a.nome });
  if (error || !data) return { ok: false, erro: error?.message ?? "Não foi possível gerar o link." };
  return { ok: true, url: data.signedUrl };
}

export async function excluirArquivoOc(ocId: number, id: number): Promise<Resultado> {
  const supabase = await createClient();
  const { data: a } = await supabase.from("oc_arquivos").select("caminho").eq("id", id).maybeSingle();
  if (!a) return { ok: false, erro: "Arquivo não encontrado." };
  const { error } = await supabase.from("oc_arquivos").delete().eq("id", id);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  await supabase.storage.from("oc-arquivos").remove([a.caminho]);
  revalidatePath(`/ordens-compra/${ocId}`);
  return { ok: true };
}

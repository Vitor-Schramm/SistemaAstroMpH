"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";
import type { ItemEnvio } from "@/lib/solicitacoes/actions";

export type Resultado = { ok: true; id?: number; url?: string } | { ok: false; erro: string };

async function rpc(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  return { data, erro: error ? traduzirErro(error.message) : undefined };
}

function revalidar(id?: number) {
  revalidatePath("/mapas", "layout");
  if (id) revalidatePath(`/mapas/${id}`);
}

async function chamar(fn: string, args: Record<string, unknown>, mapaId?: number): Promise<Resultado> {
  const { data, erro } = await rpc(fn, args);
  if (erro) return { ok: false, erro };
  revalidar(mapaId);
  return { ok: true, id: data == null ? undefined : Number(data) };
}

export type DadosMapa = {
  obra_id: string;
  servico: string;
  apropriacao: string;
  observacao: string;
  tipo: string;
  data_entrega: string;
  prazo_locacao: string;
  data_devolucao: string;
};

export async function salvarMapa(id: number | null, dados: DadosMapa, itens: ItemEnvio[]): Promise<Resultado> {
  return chamar("salvar_mapa_itens", { p_id: id, p_dados: dados, p_itens: itens }, id ?? undefined);
}
export const efetivarMapa = async (id: number) => chamar("efetivar_mapa", { p_id: id }, id);
export const apropriarItemMapa = async (mapaId: number, itemId: number, ccId: number) =>
  ccId ? chamar("apropriar_item_mapa", { p_item_id: itemId, p_cc_id: ccId }, mapaId) : ({ ok: false, erro: "Selecione o centro de custo." } as Resultado);
export const excluirApropriacaoMapa = async (mapaId: number, id: number) => chamar("excluir_apropriacao_mapa", { p_id: id }, mapaId);
export const importarItensMapa = async (mapaId: number, solicitacaoId: number) => chamar("importar_itens_mapa", { p_mapa: mapaId, p_solicitacao: solicitacaoId }, mapaId);
export const adicionarFornecedorMapa = async (mapaId: number, fornecedorId: number) =>
  fornecedorId ? chamar("adicionar_fornecedor_mapa", { p_mapa: mapaId, p_fornecedor: fornecedorId }, mapaId) : ({ ok: false, erro: "Selecione o fornecedor." } as Resultado);
export const excluirFornecedorMapa = async (mapaId: number, fornecedorId: number) => chamar("excluir_fornecedor_mapa", { p_mapa: mapaId, p_fornecedor: fornecedorId }, mapaId);
export const finalizarCotacao = async (mapaId: number) => chamar("finalizar_cotacao_mapa", { p_id: mapaId }, mapaId);
export const alternarRegularizacao = async (mapaId: number) => chamar("alternar_regularizacao_engenharia", { p_id: mapaId }, mapaId);

export type FornecedorCotacao = {
  fornecedor_id: number;
  frete: number;
  impostos: number;
  desconto: number;
  condicao_pagamento: string;
  prazo_entrega: string;
  observacao: string;
};

export async function salvarCotacao(mapaId: number, fornecedores: FornecedorCotacao[], precos: { mapa_item_id: number; fornecedor_id: number; valor_unitario: number }[]) {
  return chamar("salvar_cotacao_mapa", { p_mapa: mapaId, p_fornecedores: fornecedores, p_precos: precos }, mapaId);
}

export async function gerarPedido(mapaId: number, fornecedorId: number, itens: number[] | null): Promise<Resultado> {
  const r = await chamar("gerar_pedido_mapa", { p_mapa: mapaId, p_fornecedor: fornecedorId, p_itens: itens }, mapaId);
  if (r.ok) revalidatePath("/ordens-compra", "layout");
  return r;
}

export async function registrarArquivoMapa(mapaId: number, caminho: string, nome: string, tamanho: number): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.from("mapa_arquivos").insert({ mapa_id: mapaId, caminho, nome, tamanho });
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidar(mapaId);
  return { ok: true };
}

export async function linkArquivoMapa(id: number): Promise<Resultado> {
  const supabase = await createClient();
  const { data: a } = await supabase.from("mapa_arquivos").select("caminho, nome").eq("id", id).maybeSingle();
  if (!a) return { ok: false, erro: "Arquivo não encontrado." };
  const { data, error } = await supabase.storage.from("mapa-arquivos").createSignedUrl(a.caminho, 120, { download: a.nome });
  if (error || !data) return { ok: false, erro: error?.message ?? "Não foi possível gerar o link." };
  return { ok: true, url: data.signedUrl };
}

export async function excluirArquivoMapa(mapaId: number, id: number): Promise<Resultado> {
  const supabase = await createClient();
  const { data: a } = await supabase.from("mapa_arquivos").select("caminho").eq("id", id).maybeSingle();
  if (!a) return { ok: false, erro: "Arquivo não encontrado." };
  const { error } = await supabase.from("mapa_arquivos").delete().eq("id", id);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  await supabase.storage.from("mapa-arquivos").remove([a.caminho]);
  revalidar(mapaId);
  return { ok: true };
}

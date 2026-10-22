"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";

export type Resultado = { ok: true; id?: number } | { ok: false; erro: string; verbaInsuficiente?: boolean };

async function rpc(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  return { data, erro: error ? traduzirErro(error.message) : undefined };
}

function revalidar(id?: number) {
  for (const r of ["/ordens-reembolso", "/verbas", "/", "/financeiro", "/consultas"]) revalidatePath(r);
  if (id) revalidatePath(`/ordens-reembolso/${id}`);
}

// ============================================================
// Ordem de Reembolso no modelo do AstroTools (migração 0014)
// ============================================================

async function chamar(fn: string, args: Record<string, unknown>, id?: number): Promise<Resultado> {
  const { data, erro } = await rpc(fn, args);
  if (erro) return { ok: false, erro };
  for (const r of ["/ordens-reembolso", "/obras", "/notas-cinza", "/notas-azul"]) revalidatePath(r, "layout");
  if (id) revalidatePath(`/ordens-reembolso/${id}`);
  return { ok: true, id: data == null ? undefined : Number(data) };
}

export type DadosReembolso = { obra_id: string; filial_cliente_id: string; fornecedor_id: string; observacao: string; cpf_cnpj: string; banco: string; agencia: string; conta: string };
export type ItemReembolsoEnvio = { descricao: string; apropriacao: string; tipo: string; data: string; valor: number };

export const salvarReembolsoOriginal = async (id: number | null, dados: DadosReembolso, itens: ItemReembolsoEnvio[]) =>
  chamar("salvar_reembolso_original", { p_id: id, p_dados: dados, p_itens: itens }, id ?? undefined);
export const apropriarReembolso = async (id: number, ccId: number, valor: number) => chamar("apropriar_reembolso", { p_id: id, p_cc: ccId, p_valor: valor }, id);
export const excluirApropriacaoReembolso = async (id: number, aproId: number) => chamar("excluir_apropriacao_reembolso", { p_id: aproId }, id);
export const efetivarSolicitacaoReembolso = async (id: number) => chamar("efetivar_solicitacao_reembolso", { p_id: id }, id);
export const excluirReembolso = async (id: number) => chamar("excluir_reembolso", { p_id: id });

export async function registrarArquivoReembolso(id: number, caminho: string, nome: string, tamanho: number): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.from("reembolso_arquivos").insert({ reembolso_id: id, caminho, nome, tamanho });
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath(`/ordens-reembolso/${id}`);
  return { ok: true };
}

export async function excluirArquivoReembolso(id: number, arquivoId: number): Promise<Resultado> {
  const supabase = await createClient();
  const { data } = await supabase.from("reembolso_arquivos").delete().eq("id", arquivoId).select("caminho").maybeSingle();
  if (data?.caminho) await supabase.storage.from("reembolso-arquivos").remove([data.caminho]);
  revalidatePath(`/ordens-reembolso/${id}`);
  return { ok: true };
}

export async function linkArquivoReembolso(arquivoId: number): Promise<{ ok: true; url: string } | { ok: false; erro: string }> {
  const supabase = await createClient();
  const { data } = await supabase.from("reembolso_arquivos").select("caminho").eq("id", arquivoId).maybeSingle();
  if (!data) return { ok: false, erro: "Arquivo não encontrado." };
  const { data: s, error } = await supabase.storage.from("reembolso-arquivos").createSignedUrl(data.caminho, 300);
  if (error || !s) return { ok: false, erro: "Não foi possível abrir o arquivo." };
  return { ok: true, url: s.signedUrl };
}

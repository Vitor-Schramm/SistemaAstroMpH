"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";

export type Resultado = { ok: true; id?: number; url?: string } | { ok: false; erro: string; verbaInsuficiente?: boolean };

const ROTAS_NF = ["/notas", "/notas-cinza", "/notas-azul", "/aprovacao-nf", "/guias-adm", "/verbas", "/"];

async function rpc(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  return { data, erro: error ? traduzirErro(error.message) : undefined };
}

function revalidar(extra: string[] = []) {
  for (const r of [...ROTAS_NF, ...extra]) revalidatePath(r);
}

export async function salvarNota(id: number | null, dados: Record<string, unknown>): Promise<Resultado> {
  if (!dados.ordem_compra_id) return { ok: false, erro: "Selecione a ordem de compra." };
  if (!dados.fase) return { ok: false, erro: "Selecione a fase." };
  const { data, erro } = await rpc("salvar_nf", { p_id: id, p_dados: dados });
  if (erro) return { ok: false, erro };
  revalidar(id ? [`/notas/${id}`] : []);
  return { ok: true, id: Number(data) };
}

export async function registrarAnexo(notaId: number, caminho: string, nome: string, tamanho: number): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.from("nf_anexos").insert({ nota_fiscal_id: notaId, caminho, nome, tamanho });
  if (error) return { ok: false, erro: error.message };
  revalidar([`/notas/${notaId}`]);
  return { ok: true };
}

export async function removerAnexo(anexoId: number, notaId: number): Promise<Resultado> {
  const supabase = await createClient();
  const { data: anexo } = await supabase.from("nf_anexos").select("caminho").eq("id", anexoId).maybeSingle();
  if (!anexo) return { ok: false, erro: "Anexo não encontrado." };
  const { error } = await supabase.from("nf_anexos").delete().eq("id", anexoId);
  if (error) return { ok: false, erro: error.message };
  await supabase.storage.from("nf-anexos").remove([anexo.caminho]);
  revalidar([`/notas/${notaId}`]);
  return { ok: true };
}

export async function linkAnexo(anexoId: number): Promise<Resultado> {
  const supabase = await createClient();
  const { data: anexo } = await supabase.from("nf_anexos").select("caminho, nome").eq("id", anexoId).maybeSingle();
  if (!anexo) return { ok: false, erro: "Anexo não encontrado." };
  const { data, error } = await supabase.storage.from("nf-anexos").createSignedUrl(anexo.caminho, 120, { download: anexo.nome });
  if (error || !data) return { ok: false, erro: error?.message ?? "Não foi possível gerar o link." };
  return { ok: true, url: data.signedUrl };
}

export async function decidirNota(id: number, aprovado: boolean, justificativa: string): Promise<Resultado> {
  const { erro } = await rpc("decidir_nf", { p_id: id, p_aprovado: aprovado, p_justificativa: justificativa });
  if (erro) return { ok: false, erro };
  revalidar([`/notas/${id}`]);
  return { ok: true };
}

export async function pagarNota(id: number, data: string, forcar: boolean): Promise<Resultado> {
  const { erro } = await rpc("efetivar_pagamento", { p_id: id, p_data: data || null, p_forcar: forcar });
  if (erro) {
    if (erro.startsWith("VERBA_INSUFICIENTE")) {
      return { ok: false, verbaInsuficiente: true, erro: erro.replace("VERBA_INSUFICIENTE: ", "Verba insuficiente: ") };
    }
    return { ok: false, erro };
  }
  revalidar([`/notas/${id}`]);
  return { ok: true };
}

export async function estornarPagamento(id: number): Promise<Resultado> {
  const { erro } = await rpc("estornar_pagamento", { p_id: id });
  if (erro) return { ok: false, erro };
  revalidar([`/notas/${id}`]);
  return { ok: true };
}

export async function cancelarNota(id: number): Promise<Resultado> {
  const { erro } = await rpc("cancelar_nf", { p_id: id });
  if (erro) return { ok: false, erro };
  revalidar([`/notas/${id}`]);
  return { ok: true };
}

export async function criarGuia(obraId: number, notas: number[], observacao: string): Promise<Resultado> {
  const { data, erro } = await rpc("criar_guia", { p_obra_id: obraId, p_nf_ids: notas, p_observacao: observacao });
  if (erro) return { ok: false, erro };
  revalidar();
  return { ok: true, id: Number(data) };
}

export async function atualizarGuia(id: number, acao: "enviar" | "pagar" | "cancelar" | "nf_taxa", data?: string, nfTaxa?: boolean): Promise<Resultado> {
  const { erro } = await rpc("atualizar_guia", { p_id: id, p_acao: acao, p_data: data || null, p_nf_taxa: nfTaxa ?? null });
  if (erro) return { ok: false, erro };
  revalidar();
  return { ok: true };
}

export async function lancarAporte(obraId: number, data: string, valor: number, descricao: string): Promise<Resultado> {
  if (!obraId) return { ok: false, erro: "Selecione a obra." };
  if (!valor) return { ok: false, erro: "Informe o valor (negativo para estorno)." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("obra_aportes")
    .insert({ obra_id: obraId, data: data || undefined, valor, descricao: descricao || null });
  if (error) return { ok: false, erro: error.code === "42501" ? "Só o financeiro lança aportes." : error.message };
  revalidar();
  return { ok: true };
}

export async function excluirAporte(id: number): Promise<Resultado> {
  const supabase = await createClient();
  const { error, count } = await supabase.from("obra_aportes").delete({ count: "exact" }).eq("id", id);
  if (error) return { ok: false, erro: error.message };
  if (!count) return { ok: false, erro: "Sem permissão para excluir este aporte." };
  revalidar();
  return { ok: true };
}

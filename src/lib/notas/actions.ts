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

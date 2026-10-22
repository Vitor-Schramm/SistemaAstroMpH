"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";

// Arquivos da obra ("Relatório de Obra" e "Upload Contrato da Obra"). O envio vai direto do navegador
// para o bucket obra-arquivos; aqui só se registra o arquivo e se gera o link de download.

type Resposta = { ok: true; url?: string } | { ok: false; erro: string };

export async function registrarArquivoObra(obraId: number, tipo: "relatorio" | "contrato", caminho: string, nome: string, tamanho: number): Promise<Resposta> {
  const supabase = await createClient();
  const { error } = await supabase.from("obra_arquivos").insert({ obra_id: obraId, tipo, caminho, nome, tamanho });
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath(`/obras/${obraId}`);
  return { ok: true };
}

export async function linkArquivoObra(id: number): Promise<Resposta> {
  const supabase = await createClient();
  const { data: a } = await supabase.from("obra_arquivos").select("caminho, nome").eq("id", id).maybeSingle();
  if (!a) return { ok: false, erro: "Arquivo não encontrado." };
  const { data, error } = await supabase.storage.from("obra-arquivos").createSignedUrl(a.caminho, 120, { download: a.nome });
  if (error || !data) return { ok: false, erro: error?.message ?? "Não foi possível gerar o link." };
  return { ok: true, url: data.signedUrl };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, podeEditarCadastros } from "@/lib/auth";

export type BloqueioState = { ok?: boolean; erro?: string; nonce?: number };

async function exigirPermissao() {
  const perfil = await getPerfil();
  if (!perfil.ativo || !podeEditarCadastros(perfil.papel)) throw new Error("Seu perfil não tem permissão para bloquear fornecedores.");
  return perfil;
}

function revalidar() {
  revalidatePath("/fornecedores-bloqueados");
  revalidatePath("/fornecedores");
}

export async function bloquear(_prev: BloqueioState, formData: FormData): Promise<BloqueioState> {
  try {
    await exigirPermissao();
  } catch (e) {
    return { erro: (e as Error).message };
  }
  const fornecedorId = Number(formData.get("fornecedor_id"));
  const justificativa = String(formData.get("justificativa") ?? "").trim();
  if (!fornecedorId) return { erro: "Selecione o fornecedor." };
  if (justificativa.length < 5) return { erro: "Descreva a justificativa do bloqueio." };

  const supabase = await createClient();
  const { error } = await supabase.from("fornecedor_bloqueios").insert({ fornecedor_id: fornecedorId, justificativa });
  if (error) return { erro: error.code === "23505" ? "Esse fornecedor já está bloqueado." : error.message };

  revalidar();
  return { ok: true, nonce: Date.now() };
}

export async function desbloquear(bloqueioId: number) {
  const perfil = await exigirPermissao();
  const supabase = await createClient();
  const { error } = await supabase
    .from("fornecedor_bloqueios")
    .update({ desbloqueado_em: new Date().toISOString(), desbloqueado_por: perfil.id })
    .eq("id", bloqueioId)
    .is("desbloqueado_em", null);
  if (error) throw new Error(error.message);
  revalidar();
}

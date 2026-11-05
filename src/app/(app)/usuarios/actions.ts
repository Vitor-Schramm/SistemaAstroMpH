"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";
import type { Papel } from "@/lib/auth";

type Resultado = { ok: true } | { ok: false; erro: string };

async function chamar(fn: string, args: Record<string, unknown>): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath("/usuarios");
  return { ok: true };
}

export const criarUsuario = async (d: { email: string; nome: string; papel: Papel; senha: string }) =>
  chamar("criar_usuario", { p_email: d.email, p_nome: d.nome, p_papel: d.papel, p_senha: d.senha });

export const salvarUsuario = async (id: string, d: { nome: string; celular: string; papel: Papel; ativo: boolean }) =>
  chamar("salvar_usuario", { p_id: id, p_nome: d.nome, p_celular: d.celular, p_papel: d.papel, p_ativo: d.ativo });

export const definirSenhaUsuario = async (id: string, senha: string) => chamar("definir_senha_usuario", { p_id: id, p_senha: senha });

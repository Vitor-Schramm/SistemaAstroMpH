"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth";

export type ContaState = { ok?: string; erro?: string; nonce?: number };

export async function salvarPerfil(_prev: ContaState, formData: FormData): Promise<ContaState> {
  const perfil = await getPerfil();
  const nome = String(formData.get("nome") ?? "").trim();
  const celular = String(formData.get("celular") ?? "").trim() || null;
  if (nome.length < 2) return { erro: "Informe seu nome." };

  const supabase = await createClient();
  const { error } = await supabase.from("perfis").update({ nome, celular }).eq("id", perfil.id);
  if (error) return { erro: error.message };
  revalidatePath("/", "layout");
  return { ok: "Perfil atualizado.", nonce: Date.now() };
}

export async function trocarSenha(_prev: ContaState, formData: FormData): Promise<ContaState> {
  const perfil = await getPerfil();
  const atual = String(formData.get("atual") ?? "");
  const nova = String(formData.get("nova") ?? "");
  const confirma = String(formData.get("confirma") ?? "");
  if (nova.length < 8) return { erro: "A nova senha precisa ter pelo menos 8 caracteres." };
  if (nova !== confirma) return { erro: "A confirmação não confere com a nova senha." };

  const supabase = await createClient();
  // Confirma a senha atual antes de trocar.
  const { error: errLogin } = await supabase.auth.signInWithPassword({ email: perfil.email, password: atual });
  if (errLogin) return { erro: "Senha atual incorreta." };

  const { error } = await supabase.auth.updateUser({ password: nova });
  if (error) return { erro: error.message };
  return { ok: "Senha alterada.", nonce: Date.now() };
}

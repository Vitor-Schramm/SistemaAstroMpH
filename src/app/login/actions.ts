"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { erro?: string; email?: string };

const schema = z.object({
  email: z.email("Informe um e-mail válido."),
  senha: z.string().min(1, "Informe a senha."),
  next: z.string().optional(),
});

export async function entrar(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { erro: parsed.error.issues[0].message, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.senha,
  });
  if (error) return { erro: "E-mail ou senha incorretos.", email };

  const destino = parsed.data.next?.startsWith("/") && !parsed.data.next.startsWith("//") ? parsed.data.next : "/";
  redirect(destino);
}

// Acesso rápido de teste: contas teste.<setor>@mph.teste, criadas por supabase/local/contas-teste.sql.
// Só funciona com LOGIN_TESTE_SENHA no ambiente; a senha fica no servidor e nunca vai ao navegador.
const SETORES_TESTE = ["admin", "financeiro", "engenharia", "suprimentos", "usuario"] as const;

export async function entrarComoTeste(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const senha = process.env.LOGIN_TESTE_SENHA;
  const setor = String(formData.get("setor") ?? "");
  if (!senha) return { erro: "Acesso rápido de teste desativado." };
  if (!(SETORES_TESTE as readonly string[]).includes(setor)) return { erro: "Setor inválido." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: `teste.${setor}@mph.teste`, password: senha });
  if (error) return { erro: "Conta de teste não encontrada. Rode supabase/local/contas-teste.sql no Supabase." };
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

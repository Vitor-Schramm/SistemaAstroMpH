import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Papel = "admin" | "financeiro" | "engenharia" | "suprimentos" | "usuario";
export type Perfil = { id: string; nome: string; email: string; celular: string | null; papel: Papel; ativo: boolean };

// Perfil do usuário logado (memoizado por requisição).
export const getPerfil = cache(async (): Promise<Perfil> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) redirect("/login");

  const { data } = await supabase.from("perfis").select("*").eq("id", uid).single();
  if (!data) {
    return { id: uid, nome: String(claims.claims.email ?? ""), email: String(claims.claims.email ?? ""), celular: null, papel: "usuario", ativo: false };
  }
  return data as Perfil;
});

export function podeEditarCadastros(papel: Papel) {
  return papel === "admin" || papel === "financeiro" || papel === "suprimentos";
}

/** Conduz cotações e ordens de compra (espelha public.pode_comprar()). */
export function podeComprar(papel: Papel) {
  return papel === "admin" || papel === "suprimentos";
}

/** Espelham as funções do banco da fase 3. */
export const podeLancarNf = (p: Papel) => p === "admin" || p === "suprimentos" || p === "financeiro";
export const podeAprovarNf = (p: Papel) => p === "admin" || p === "engenharia";
export const podePagar = (p: Papel) => p === "admin" || p === "financeiro";

/** Papéis que aprovam OC (admin aprova por qualquer um). */
export function papeisAprovador(papel: Papel): ("engenharia" | "financeiro")[] {
  if (papel === "admin") return ["engenharia", "financeiro"];
  if (papel === "engenharia" || papel === "financeiro") return [papel];
  return [];
}

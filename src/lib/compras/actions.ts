"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";

export type Resultado = { ok: true; id?: number; ids?: number[] } | { ok: false; erro: string };

type Json = Record<string, unknown>;

async function rpc(fn: string, args: Json): Promise<{ data: unknown; erro?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    const msg = traduzirErro(error.code === "42501" ? error.message || "Sem permissão." : error.message);
    return { data: null, erro: msg };
  }
  return { data };
}

function revalidar(...rotas: string[]) {
  for (const r of rotas) revalidatePath(r);
}

// ---------- Solicitações ----------
export async function salvarSolicitacao(id: number | null, dados: Json, itens: Json[]): Promise<Resultado> {
  if (!dados.obra_id) return { ok: false, erro: "Selecione a obra." };
  if (!String(dados.servico ?? "").trim()) return { ok: false, erro: "Informe o serviço." };
  const { data, erro } = await rpc("salvar_solicitacao", { p_id: id, p_dados: dados, p_itens: itens });
  if (erro) return { ok: false, erro };
  revalidar("/solicitacoes");
  return { ok: true, id: Number(data) };
}

// ---------- Mapas ----------
export async function salvarMapa(id: number | null, dados: Json, itens: Json[]): Promise<Resultado> {
  if (!dados.obra_id) return { ok: false, erro: "Selecione a obra." };
  if (!String(dados.servico ?? "").trim()) return { ok: false, erro: "Informe o serviço." };
  const { data, erro } = await rpc("salvar_mapa", { p_id: id, p_dados: dados, p_itens: itens });
  if (erro) return { ok: false, erro };
  revalidar("/mapas", "/solicitacoes");
  return { ok: true, id: Number(data) };
}

export async function salvarCotacao(mapaId: number, fornecedores: Json[], precos: Json[], vencedores: Json[]): Promise<Resultado> {
  const { erro } = await rpc("salvar_cotacao", {
    p_mapa_id: mapaId,
    p_fornecedores: fornecedores,
    p_precos: precos,
    p_vencedores: vencedores,
  });
  if (erro) return { ok: false, erro };
  revalidar(`/mapas/${mapaId}`);
  return { ok: true };
}

// ---------- Ordens de compra ----------
export async function salvarOc(id: number | null, dados: Json, itens: Json[]): Promise<Resultado> {
  if (!dados.obra_id) return { ok: false, erro: "Selecione a obra." };
  if (!dados.fornecedor_id) return { ok: false, erro: "Selecione o fornecedor." };
  const { data, erro } = await rpc("salvar_oc", { p_id: id, p_dados: dados, p_itens: itens });
  if (erro) return { ok: false, erro };
  revalidar("/ordens-compra", "/aprovacao-oc");
  return { ok: true, id: Number(data) };
}

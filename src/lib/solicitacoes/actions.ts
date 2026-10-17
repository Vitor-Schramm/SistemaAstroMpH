"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";

export type Resultado = { ok: true; id?: number } | { ok: false; erro: string };

export type ItemEnvio = {
  id?: number;
  e_titulo: boolean;
  item_id: number | null;
  codigo: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_medio: number | null;
  excluir?: boolean;
};

async function rpc(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  return { data, erro: error ? traduzirErro(error.message) : undefined };
}

function revalidar(id?: number) {
  revalidatePath("/solicitacoes", "layout");
  if (id) revalidatePath(`/solicitacoes/${id}`);
}

export async function salvarSolicitacao(id: number | null, dados: { obra_id: string; servico: string; observacao: string }, itens: ItemEnvio[]): Promise<Resultado> {
  const { data, erro } = await rpc("salvar_solicitacao_itens", { p_id: id, p_dados: dados, p_itens: itens });
  if (erro) return { ok: false, erro };
  revalidar(Number(data));
  return { ok: true, id: Number(data) };
}

export async function apropriarItem(solicitacaoId: number, itemId: number, ccId: number): Promise<Resultado> {
  if (!ccId) return { ok: false, erro: "Selecione o centro de custo." };
  const { erro } = await rpc("apropriar_item_solicitacao", { p_item_id: itemId, p_cc_id: ccId });
  if (erro) return { ok: false, erro };
  revalidar(solicitacaoId);
  return { ok: true };
}

export async function excluirApropriacao(solicitacaoId: number, apropriacaoId: number): Promise<Resultado> {
  const { erro } = await rpc("excluir_apropriacao_solicitacao", { p_id: apropriacaoId });
  if (erro) return { ok: false, erro };
  revalidar(solicitacaoId);
  return { ok: true };
}

export async function importarItens(destino: number, origem: number): Promise<Resultado> {
  const { erro } = await rpc("importar_itens_solicitacao", { p_destino: destino, p_origem: origem });
  if (erro) return { ok: false, erro };
  revalidar(destino);
  return { ok: true };
}

export async function efetivarSolicitacao(id: number, itens: number[] | null): Promise<Resultado> {
  const { data, erro } = await rpc("efetivar_solicitacao", { p_id: id, p_itens: itens });
  if (erro) return { ok: false, erro };
  revalidar(id);
  revalidatePath("/mapas", "layout");
  return { ok: true, id: Number(data) };
}

export async function excluirSolicitacao(id: number): Promise<Resultado> {
  const { erro } = await rpc("excluir_solicitacao", { p_id: id });
  if (erro) return { ok: false, erro };
  revalidar();
  return { ok: true };
}

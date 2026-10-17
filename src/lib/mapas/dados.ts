import { createClient } from "@/lib/supabase/server";
import { compararCodigo } from "@/lib/obras/tipos";
import type { Apropriacao, CcSaldo } from "@/components/astro/itens";

export type MapaResumo = {
  id: number;
  obra_id: number;
  obra_nome: string;
  obra_regime: string;
  cliente_id: number | null;
  cliente_nome: string | null;
  servico: string;
  apropriacao: string | null;
  observacao: string | null;
  tipo: string;
  data_entrega: string | null;
  prazo_locacao: string | null;
  data_devolucao: string | null;
  status: string;
  numero_cliente: number | null;
  regularizacao_engenharia: boolean;
  solicitacao_id: number | null;
  solicitacao_em: string | null;
  criado_em: string;
  solicitante_nome: string | null;
};

/** null quando a migração 0008 ainda não foi rodada. */
export async function carregarMapas(clienteId?: number): Promise<MapaResumo[] | null> {
  const supabase = await createClient();
  let q = supabase.from("mapas_resumo").select("*").order("id", { ascending: false }).limit(10000);
  if (clienteId) q = q.eq("cliente_id", clienteId);
  const { data, error } = await q;
  if (error) return null;
  return (data ?? []) as MapaResumo[];
}

/** Centros de custo lançáveis das planilhas ativas da obra, com saldo (Orçamento − Fechamento). */
export async function ccsComSaldo(obraId: number): Promise<CcSaldo[]> {
  const supabase = await createClient();
  const [{ data: ccs }, { data: planilhas }] = await Promise.all([
    supabase.from("centros_custo_saldos").select("id, planilha_id, codigo, descricao, nivel, orcamento, fechamento").eq("obra_id", obraId),
    supabase.from("planilhas").select("id").eq("obra_id", obraId).eq("ativo", true),
  ]);
  const ativas = new Set((planilhas ?? []).map((p) => p.id as number));
  return ((ccs ?? []) as { id: number; planilha_id: number; codigo: string; descricao: string; nivel: string; orcamento: number; fechamento: number }[])
    .filter((c) => c.nivel === "CC" && ativas.has(c.planilha_id))
    .sort((a, b) => compararCodigo(a.codigo, b.codigo))
    .map((c) => ({ id: c.id, codigo: c.codigo, descricao: c.descricao, saldo: Number(c.orcamento) - Number(c.fechamento) }));
}

export type ApropriacaoValor = Apropriacao & { valor: number; cc_id: number };

/** Apropriações por item (origem 'solicitacao_item' ou 'mapa_item'). */
export async function apropriacoesPorItem(origem: "solicitacao_item" | "mapa_item", ids: number[]) {
  const mapa = new Map<number, ApropriacaoValor[]>();
  if (!ids.length) return mapa;
  const supabase = await createClient();
  const { data } = await supabase.from("apropriacoes_detalhe").select("id, origem_id, cc_id, cc_codigo, cc_descricao, valor").eq("origem", origem).in("origem_id", ids);
  for (const a of data ?? [])
    mapa.set(a.origem_id, [...(mapa.get(a.origem_id) ?? []), { id: a.id, cc_id: a.cc_id, cc_codigo: a.cc_codigo, cc_descricao: a.cc_descricao, valor: Number(a.valor) }]);
  return mapa;
}

export const TIPOS_SERVICO_MAPA = [
  { valor: "compra", rotulo: "Compra de Materias" },
  { valor: "locacao", rotulo: "Serviço de Locação" },
  { valor: "servico", rotulo: "Serviço" },
];

import { createClient } from "@/lib/supabase/server";

export type SolicitacaoResumo = {
  id: number;
  obra_id: number;
  obra_nome: string;
  obra_codigo: string;
  obra_regime: string;
  cliente_id: number | null;
  cliente_nome: string | null;
  servico: string;
  observacao: string | null;
  status: string;
  criado_em: string;
  solicitante_id: string | null;
  solicitante_nome: string | null;
};

/** null quando a migração 0007 ainda não foi rodada. */
export async function carregarSolicitacoes(filtro?: { clienteId?: number }): Promise<SolicitacaoResumo[] | null> {
  const supabase = await createClient();
  let q = supabase.from("solicitacoes_resumo").select("*").order("id", { ascending: false }).limit(10000);
  if (filtro?.clienteId) q = q.eq("cliente_id", filtro.clienteId);
  const { data, error } = await q;
  if (error) return null;
  return (data ?? []) as SolicitacaoResumo[];
}

export const REGIME_ROTULO: Record<string, string> = { administracao: "Administração", fechado: "Fechado", completo: "Completo" };

/** Obras ativas no formato do select do original: "NOME - Regime". */
export async function obrasSelect() {
  const supabase = await createClient();
  const { data } = await supabase.from("obras").select("id, nome, regime").eq("ativo", true).order("nome");
  return (data ?? []).map((o) => ({ valor: String(o.id), rotulo: `${o.nome} - ${REGIME_ROTULO[o.regime as string] ?? o.regime}` }));
}

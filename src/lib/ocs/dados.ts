import { createClient } from "@/lib/supabase/server";

export type OcResumo = {
  id: number;
  obra_id: number;
  fornecedor_id: number;
  mapa_id: number | null;
  status: string;
  nome: string | null;
  numero_cliente: number | null;
  data_emissao: string;
  regularizacao_engenharia: boolean;
  saldo_zerado: boolean;
  pendencia: string | null;
  criado_em: string;
  obra_nome: string;
  obra_regime: string;
  cliente_id: number | null;
  cliente_nome: string | null;
  fornecedor_nome: string;
  fornecedor_fantasia: string | null;
  valor_total: number;
  total_apropriado: number;
  total_pago: number;
  saldo: number;
  responsaveis: string | null;
};

/** null quando a migração 0009 ainda não foi rodada. */
export async function carregarOcs(filtro?: { clienteId?: number; status?: string }): Promise<OcResumo[] | null> {
  const supabase = await createClient();
  let q = supabase.from("ocs_resumo").select("*").order("id", { ascending: false }).limit(10000);
  if (filtro?.clienteId) q = q.eq("cliente_id", filtro.clienteId);
  if (filtro?.status) q = q.eq("status", filtro.status);
  const { data, error } = await q;
  if (error) return null;
  return (data ?? []) as OcResumo[];
}

/** Rótulo do status da OC no modelo do original (liberação de pendências). */
export const STATUS_OC_ORIGINAL: Record<string, string> = {
  rascunho: "Em digitação",
  aguardando_aprovacao: "Pendente de liberação",
  aprovada: "Liberada",
  reprovada: "Bloqueada",
  cancelada: "Cancelada",
};

import { createClient } from "@/lib/supabase/server";

export type PainelObra = {
  obra_id: number;
  codigo: string;
  nome: string;
  ativo: boolean;
  ano: number | null;
  regime: string;
  status: string;
  tipo_obra: string | null;
  metragem: number | null;
  inicio: string | null;
  termino: string | null;
  entrega_prevista: string | null;
  engenheiro: string | null;
  orcamentista: string | null;
  suprimento: string | null;
  valor_total: number | null;
  taxa_adm_analise_financeira: number | null;
  taxa_adm_analise_orcamento: number | null;
  cliente_nome: string | null;
  aportes: number;
  pago: number;
  a_pagar: number;
  disponivel: number;
  pagamentos_pendentes: number;
  ocs_bloqueadas: number;
  ocs_aprovadas: number;
  azul_pendente_guia: number;
  azul_em_guia: number;
  azul_pago: number;
  adm_prevista: number;
};

/** Retorna null se a visão ainda não existe (SQL 0004 não rodado), para a página avisar em vez de quebrar. */
export async function carregarPainel(apenasAtivas = true): Promise<PainelObra[] | null> {
  const supabase = await createClient();
  let q = supabase.from("painel_obras").select("*").order("codigo");
  if (apenasAtivas) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) {
    console.error("painel_obras:", error.message);
    return null;
  }
  return (data ?? []) as PainelObra[];
}

/** Contagem e soma de pendências do fluxo, para os cartões do Início. */
export async function carregarPendencias() {
  const supabase = await createClient();
  const contar = async (tabela: string, filtro: Record<string, string>) => {
    let q = supabase.from(tabela).select("id", { count: "exact", head: true });
    for (const [k, v] of Object.entries(filtro)) q = q.eq(k, v);
    const { count } = await q;
    return count ?? 0;
  };
  const somar = async (tabela: string, coluna: string, filtro: Record<string, string>) => {
    let q = supabase.from(tabela).select(coluna);
    for (const [k, v] of Object.entries(filtro)) q = q.eq(k, v);
    const { data } = await q.limit(10000);
    return ((data ?? []) as unknown as Record<string, number>[]).reduce((s, r) => s + Number(r[coluna] ?? 0), 0);
  };

  const [
    solicitacoes,
    ocsAprovacao,
    nfsEngenharia,
    reembolsosEngenharia,
    nfsPagar,
    nfsPagarValor,
    reembolsosPagar,
    reembolsosPagarValor,
    azulGuia,
    azulGuiaValor,
  ] = await Promise.all([
    contar("solicitacoes", { status: "pendente" }),
    contar("ordens_compra", { status: "aguardando_aprovacao" }),
    contar("notas_fiscais", { status: "aguardando_engenharia" }),
    contar("ordens_reembolso", { status: "aguardando_aprovacao" }),
    contar("notas_fiscais", { status: "pendente_pagamento" }),
    somar("notas_fiscais", "valor", { status: "pendente_pagamento" }),
    contar("ordens_reembolso", { status: "aprovada" }),
    somar("reembolsos_resumo", "valor_total", { status: "aprovada" }),
    contar("notas_fiscais", { status: "aguardando_guia" }),
    somar("notas_fiscais", "valor", { status: "aguardando_guia" }),
  ]);

  return {
    solicitacoes,
    ocsAprovacao,
    nfsEngenharia,
    reembolsosEngenharia,
    pagar: nfsPagar + reembolsosPagar,
    pagarValor: nfsPagarValor + reembolsosPagarValor,
    azulGuia,
    azulGuiaValor,
  };
}

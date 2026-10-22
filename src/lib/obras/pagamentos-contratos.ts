import { createClient } from "@/lib/supabase/server";

// Dados das telas "Pagamentos" e "Controle de Contratos" do menu de opções da obra no AstroTools.

export type PagamentoObra = {
  id: number;
  numero: string;
  serie: string;
  tipo: string;
  pago_em: string | null;
  usuario: string;
  obra: string;
  pedido: number | null;
  fornecedor: string;
  valor: number;
  cc: string;
};

export type ContratoObra = {
  id: number;
  pedido: number | null;
  servico: string;
  valor_total: number;
  empresa: string;
  forma_pagamento: string;
  valor_pago: number;
  pendente: number;
};

/** Notas pagas da obra (Nota, Série, Tipo, Data Pagamento, Usuário, Obra, Pedido, Fornecedor, Valor, CC). */
export async function pagamentosObra(obraId: number): Promise<PagamentoObra[]> {
  const supabase = await createClient();
  const { data: notas } = await supabase
    .from("notas_lista")
    .select("id, numero, serie, tipo_documento, pago_em, pago_por_nome, obra_nome, pedido, fornecedor_nome, valor")
    .eq("obra_id", obraId)
    .eq("status", "paga")
    .order("pago_em")
    .limit(10000);
  const ids = (notas ?? []).map((n) => n.id);
  // CC de cada nota: rateio da Fase Azul ou pagamento por CC da Fase Cinza.
  const [{ data: rateios }, { data: pagos }] = ids.length
    ? await Promise.all([
        supabase.from("nf_rateios").select("nota_fiscal_id, cc:centros_custo(codigo)").in("nota_fiscal_id", ids),
        supabase.from("pagamentos_cc").select("origem_id, cc:centros_custo(codigo)").eq("origem", "nf").in("origem_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const ccs = new Map<number, Set<string>>();
  const anotar = (id: number, cc: { codigo: string } | null) => cc && (ccs.get(id) ?? ccs.set(id, new Set()).get(id)!).add(cc.codigo);
  for (const r of (rateios ?? []) as unknown as { nota_fiscal_id: number; cc: { codigo: string } | null }[]) anotar(r.nota_fiscal_id, r.cc);
  for (const p of (pagos ?? []) as unknown as { origem_id: number; cc: { codigo: string } | null }[]) anotar(p.origem_id, p.cc);

  return (notas ?? []).map((n) => ({
    id: n.id,
    numero: n.numero,
    serie: n.serie,
    tipo: String(n.tipo_documento ?? "").toUpperCase(),
    pago_em: n.pago_em,
    usuario: n.pago_por_nome ?? "",
    obra: n.obra_nome,
    pedido: n.pedido,
    fornecedor: n.fornecedor_nome,
    valor: Number(n.valor),
    cc: [...(ccs.get(n.id) ?? [])].sort().join("/"),
  }));
}

/** OCs da obra com Valor Total, Valor Pago e Pendente. */
export async function contratosObra(obraId: number): Promise<ContratoObra[]> {
  const supabase = await createClient();
  const [{ data: ocs }, { data: formas }] = await Promise.all([
    supabase.from("ocs_resumo").select("id, numero_cliente, nome, valor_total, total_pago, fornecedor_nome").eq("obra_id", obraId).order("numero_cliente").limit(10000),
    supabase.from("ordens_compra").select("id, condicao_pagamento").eq("obra_id", obraId).limit(10000),
  ]);
  const forma = new Map((formas ?? []).map((f) => [f.id, f.condicao_pagamento ?? ""]));
  return (ocs ?? []).map((o) => {
    const valor_total = Number(o.valor_total);
    const valor_pago = Number(o.total_pago);
    return {
      id: o.id,
      pedido: o.numero_cliente,
      servico: o.nome ?? "",
      valor_total,
      empresa: o.fornecedor_nome,
      forma_pagamento: forma.get(o.id) ?? "",
      valor_pago,
      pendente: Math.round((valor_total - valor_pago) * 100) / 100,
    };
  });
}

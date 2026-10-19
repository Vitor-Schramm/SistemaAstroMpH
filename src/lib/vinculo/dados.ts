import { createClient } from "@/lib/supabase/server";
import type { OcVinculo } from "@/app/(app)/vincular/lista-vinculo";

// Obras da fase: Cinza = Fechado; Azul = Administração (Completo aparece nas duas).
export const REGIMES_FASE = { cinza: ["fechado", "completo"], azul: ["administracao", "completo"] } as const;

/** null quando a migração 0011 ainda não foi rodada. */
export async function ocsParaVinculo(fase: "cinza" | "azul"): Promise<OcVinculo[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ocs_vinculo")
    .select("*")
    .in("obra_regime", [...REGIMES_FASE[fase]])
    .gt("disponivel", 0.005)
    .order("numero_cliente");
  if (error) return null;
  return (data ?? []) as OcVinculo[];
}

export async function obrasDaFase(fase: "cinza" | "azul") {
  const supabase = await createClient();
  const { data } = await supabase.from("obras").select("id, nome, regime").eq("ativo", true).in("regime", [...REGIMES_FASE[fase]]).order("nome");
  const rotulo: Record<string, string> = { administracao: "Administração", fechado: "Fechado", completo: "Completo" };
  return (data ?? []).map((o) => ({ valor: String(o.id), rotulo: `${o.nome} - ${rotulo[o.regime as string] ?? o.regime}` }));
}

type NotaBruta = {
  id: number;
  numero: string;
  serie: string;
  tipo_documento: string | null;
  vencimento: string;
  valor: number;
  status: string;
  fase: string;
  tipo_pagamento: string | null;
  favorecido_cpf_cnpj: string | null;
  favorecido: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  anexos: { id: number; nome: string; criado_em: string }[];
  rateios: { valor: number; cc: { codigo: string } | null }[];
};

/** Dados da tela de vínculo de uma OC. erro: "migracao" | "nao_liberada" | null. */
export async function carregarVinculo(ocId: number, fase: "cinza" | "azul") {
  const supabase = await createClient();
  const { data: oc, error } = await supabase.from("ocs_vinculo").select("*").eq("id", ocId).maybeSingle();
  if (error) return { erro: "migracao" as const };
  if (!oc) return { erro: "nao_liberada" as const };

  const [{ data: notas }, { data: aprops }] = await Promise.all([
    supabase
      .from("notas_fiscais")
      .select(
        "id, numero, serie, tipo_documento, vencimento, valor, status, fase, tipo_pagamento, favorecido_cpf_cnpj, favorecido, banco, agencia, conta, anexos:nf_anexos(id, nome, criado_em), rateios:nf_rateios(valor, cc:centros_custo(codigo))",
      )
      .eq("ordem_compra_id", ocId)
      .neq("status", "cancelada")
      .order("id"),
    supabase.from("apropriacoes").select("cc_id, valor, cc:centros_custo(codigo, descricao)").eq("origem", "oc").eq("origem_id", ocId),
  ]);
  const lista = ((notas ?? []) as unknown as NotaBruta[]).filter((n) => n.fase === fase);
  const todas = (notas ?? []) as unknown as NotaBruta[];

  // Disponível por CC = apontado na OC − rateado em lançamentos ativos.
  const rateado = new Map<string, number>();
  for (const n of todas) for (const r of n.rateios ?? []) if (r.cc) rateado.set(r.cc.codigo, (rateado.get(r.cc.codigo) ?? 0) + Number(r.valor));
  const porCc = new Map<number, { cc_id: number; codigo: string; descricao: string; apropriado: number; disponivel: number }>();
  for (const a of (aprops ?? []) as unknown as { cc_id: number; valor: number; cc: { codigo: string; descricao: string } | null }[]) {
    const x = porCc.get(a.cc_id) ?? { cc_id: a.cc_id, codigo: a.cc?.codigo ?? "", descricao: a.cc?.descricao ?? "", apropriado: 0, disponivel: 0 };
    x.apropriado += Number(a.valor);
    porCc.set(a.cc_id, x);
  }
  const ccs = [...porCc.values()].map((c) => ({ ...c, disponivel: Math.max(0, c.apropriado - (rateado.get(c.codigo) ?? 0)) }));
  const nomeCcs = ccs.map((c) => c.codigo).join(", ");

  return {
    erro: null,
    cab: {
      id: oc.id as number,
      numero_cliente: oc.numero_cliente as number | null,
      servico: (oc.nome as string | null) ?? "",
      cliente: (oc.cliente_nome as string | null) ?? "",
      fornecedor: ((oc.fornecedor_fantasia as string | null) || (oc.fornecedor_nome as string)) ?? "",
      valor_total: Number(oc.valor_total),
      utilizado: Number(oc.utilizado),
      disponivel: Number(oc.disponivel),
    },
    notas: lista.map((n) => ({
      ...n,
      valor: Number(n.valor),
      anexos: n.anexos ?? [],
      ccs: (n.rateios ?? []).length ? (n.rateios ?? []).map((r) => r.cc?.codigo).join(", ") : nomeCcs,
    })),
    ccs,
  };
}

import { createClient } from "@/lib/supabase/server";

// Dashboards do AstroTools: "Financeiro" (cadastro das obras com as Taxas de Administração em R$).

export type ObraFinanceiro = {
  id: number;
  codigo: string;
  nome: string;
  ano: number | null;
  regime: string;
  ativo: boolean;
  status_complementar: string | null;
  tipo_obra: string | null;
  metragem: number | null;
  inicio: string | null;
  termino: string | null;
  entrega_prevista: string | null;
  as_built_em: string | null;
  diretor: string | null;
  coordenador: string | null;
  engenheiro: string | null;
  arquitetura: string | null;
  gerenciadora: string | null;
  orcamentista: string | null;
  suprimento: string | null;
  adm_analise_financeira: number;
  adm_orcamento: number;
};

/** Taxa de Administração em R$ por obra: soma das linhas de Administração (nível ADM) das planilhas ativas. */
export async function administracaoPorObra(obraIds?: number[]) {
  const supabase = await createClient();
  let q = supabase.from("centros_custo_saldos").select("obra_id, nivel, an_financeira, orcamento, planilha_id");
  if (obraIds) q = q.in("obra_id", obraIds);
  const [{ data: ccs }, { data: planilhas }] = await Promise.all([q.eq("nivel", "ADM").limit(50000), supabase.from("planilhas").select("id").eq("ativo", true).limit(50000)]);
  const ativas = new Set((planilhas ?? []).map((p) => p.id));
  const r = new Map<number, { af: number; ao: number }>();
  for (const c of ccs ?? []) {
    if (!ativas.has(c.planilha_id)) continue;
    const t = r.get(c.obra_id) ?? { af: 0, ao: 0 };
    t.af += Number(c.an_financeira);
    t.ao += Number(c.orcamento);
    r.set(c.obra_id, t);
  }
  return r;
}

export async function obrasFinanceiro(): Promise<ObraFinanceiro[]> {
  const supabase = await createClient();
  const [{ data: obras }, adm] = await Promise.all([
    supabase
      .from("obras")
      .select("id, codigo, nome, ano, regime, ativo, status_complementar, tipo_obra, metragem, inicio, termino, entrega_prevista, as_built_em, diretor, coordenador, engenheiro, arquitetura, gerenciadora, orcamentista, suprimento")
      .order("id", { ascending: false })
      .limit(5000),
    administracaoPorObra(),
  ]);
  return ((obras ?? []) as Omit<ObraFinanceiro, "adm_analise_financeira" | "adm_orcamento">[]).map((o) => ({
    ...o,
    adm_analise_financeira: adm.get(o.id)?.af ?? 0,
    adm_orcamento: adm.get(o.id)?.ao ?? 0,
  }));
}

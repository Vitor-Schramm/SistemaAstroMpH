import { createClient } from "@/lib/supabase/server";

export type NotaLista = {
  id: number;
  fase: string;
  status: string;
  numero: string;
  serie: string;
  tipo_documento: string | null;
  vencimento: string;
  valor: number;
  criado_em: string;
  pago_em: string | null;
  guia_id: number | null;
  guia_numero?: number | null;
  ordem_compra_id: number;
  obra_id: number;
  obra_nome: string;
  cliente_nome: string | null;
  pedido: number | null;
  pedido_nome: string | null;
  fornecedor_nome: string;
  pago_por_nome: string | null;
  anexos: { id: number; nome: string; criado_em: string }[];
};

/** null quando a migração 0012 ainda não foi rodada. */
export async function carregarNotas(fase: "cinza" | "azul", status: string[]): Promise<NotaLista[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("notas_lista").select("*").eq("fase", fase).in("status", status).order("vencimento").limit(5000);
  if (error) return null;
  const notas = (data ?? []) as Omit<NotaLista, "anexos">[];
  const ids = notas.map((n) => n.id);
  const anexos = new Map<number, NotaLista["anexos"]>();
  if (ids.length) {
    const { data: a } = await supabase.from("nf_anexos").select("id, nota_fiscal_id, nome, criado_em").in("nota_fiscal_id", ids);
    for (const x of a ?? []) anexos.set(x.nota_fiscal_id, [...(anexos.get(x.nota_fiscal_id) ?? []), { id: x.id, nome: x.nome, criado_em: x.criado_em }]);
  }
  return notas.map((n) => ({ ...n, valor: Number(n.valor), anexos: anexos.get(n.id) ?? [] }));
}

export async function obrasPorRegime(regimes: string[]) {
  const supabase = await createClient();
  const { data } = await supabase.from("obras").select("id, nome, regime").eq("ativo", true).in("regime", regimes).order("nome");
  const rotulo: Record<string, string> = { administracao: "Administração", fechado: "Fechado", completo: "Completo" };
  return (data ?? []).map((o) => ({ valor: String(o.id), rotulo: `${o.nome} - ${rotulo[o.regime as string] ?? o.regime}` }));
}

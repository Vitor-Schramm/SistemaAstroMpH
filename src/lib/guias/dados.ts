import { createClient } from "@/lib/supabase/server";
import type { CalculoAdm, Guia, LinhaGuia } from "./tipos";

// Leituras das telas de Guias. Todas devolvem null quando a migração 0013 ainda não foi rodada.

const numerico = <T extends { valor: number }>(l: T) => ({ ...l, valor: Number(l.valor) });

export async function obraDaGuia(obraId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from("obras").select("id, nome, coordenador").eq("id", obraId).maybeSingle();
  return data as { id: number; nome: string; coordenador: string | null } | null;
}

export async function guiasDaObra(obraId: number, tipo?: "adm"): Promise<Guia[] | null> {
  const supabase = await createClient();
  let q = supabase.from("guias_lista").select("*").eq("obra_id", obraId);
  if (tipo) q = q.eq("tipo", tipo);
  const { data, error } = await q.order("numero");
  if (error) return null;
  return ((data ?? []) as Guia[]).map(numerico);
}

export async function guiaPorId(id: number): Promise<Guia | null | "migracao"> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("guias_lista").select("*").eq("id", id).maybeSingle();
  if (error) return "migracao";
  return data ? numerico(data as Guia) : null;
}

async function comAnexos(linhas: Omit<LinhaGuia, "anexos">[]): Promise<LinhaGuia[]> {
  const supabase = await createClient();
  const ids = [...new Set(linhas.map((l) => l.nota_id))];
  const anexos = new Map<number, LinhaGuia["anexos"]>();
  if (ids.length) {
    const { data } = await supabase.from("nf_anexos").select("id, nota_fiscal_id, nome, criado_em").in("nota_fiscal_id", ids);
    for (const a of data ?? []) anexos.set(a.nota_fiscal_id, [...(anexos.get(a.nota_fiscal_id) ?? []), { id: a.id, nome: a.nome, criado_em: a.criado_em }]);
  }
  return linhas.map((l) => ({ ...numerico(l), anexos: anexos.get(l.nota_id) ?? [] }));
}

/** Itens da guia de envio e linhas pendentes da obra que ainda podem entrar nela. */
export async function linhasGuiaEnvio(guia: Guia) {
  const supabase = await createClient();
  const [{ data: itens }, { data: disponiveis }] = await Promise.all([
    supabase.from("guia_rateios").select("*").eq("guia_id", guia.id).order("item_id"),
    supabase
      .from("guia_rateios")
      .select("*")
      .eq("obra_id", guia.obra_id)
      .is("item_id", null)
      .in("nota_status", ["aguardando_engenharia", "aguardando_guia"])
      .order("vencimento"),
  ]);
  return { itens: await comAnexos((itens ?? []) as LinhaGuia[]), disponiveis: ((disponiveis ?? []) as LinhaGuia[]).map((l) => ({ ...numerico(l), anexos: [] })) };
}

export async function calculoGuiaAdm(admId: number): Promise<CalculoAdm[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("guia_adm_calculo").select("*").eq("guia_adm_id", admId).order("planilha_id");
  return ((data ?? []) as CalculoAdm[]).map((c) => ({
    ...c,
    taxa_adm: Number(c.taxa_adm),
    taxa_imp: Number(c.taxa_imp),
    base: Number(c.base),
    administracao: Number(c.administracao),
    imposto: Number(c.imposto),
  }));
}

export async function todasGuiasAdm(): Promise<Guia[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("guias_lista").select("*").eq("tipo", "adm").order("numero", { ascending: false }).limit(5000);
  if (error) return null;
  return ((data ?? []) as Guia[]).map(numerico);
}

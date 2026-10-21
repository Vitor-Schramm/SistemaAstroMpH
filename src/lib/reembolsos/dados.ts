import { createClient } from "@/lib/supabase/server";
import type { AproReembolso, ArquivoReembolso, Favorecido, FornecedorReembolso, ItemReembolsoOriginal, ReembolsoLista } from "./tipos";

export async function opcoesFavorecidos(): Promise<Favorecido[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fornecedores_status")
    .select("id, nome, cpf_cnpj, banco, agencia, conta, banco_cnpj_favorecido, bloqueio_id")
    .eq("ativo", true)
    .order("nome");
  return (data ?? []).map((f) => ({
    valor: String(f.id),
    rotulo: `${f.nome} — ${f.cpf_cnpj}`,
    bloqueado: Boolean(f.bloqueio_id),
    cpf_cnpj: f.banco_cnpj_favorecido || f.cpf_cnpj,
    banco: f.banco,
    agencia: f.agencia,
    conta: f.conta,
  }));
}

const numerico = (r: ReembolsoLista): ReembolsoLista => ({ ...r, valor_total: Number(r.valor_total), apropriado: Number(r.apropriado) });

/** null quando a migração 0014 ainda não foi rodada. */
export async function carregarReembolsos(filtro?: { clienteId?: number; limite?: number }): Promise<ReembolsoLista[] | null> {
  const supabase = await createClient();
  let q = supabase.from("reembolsos_lista").select("*");
  if (filtro?.clienteId) q = q.eq("cliente_id", filtro.clienteId);
  const { data, error } = await q.order("id", { ascending: false }).limit(filtro?.limite ?? 10000);
  if (error) return null;
  return ((data ?? []) as ReembolsoLista[]).map(numerico);
}

export async function carregarReembolso(id: number) {
  const supabase = await createClient();
  const [{ data: r, error }, { data: itens }, { data: aprops }, { data: arquivos }] = await Promise.all([
    supabase.from("reembolsos_lista").select("*").eq("id", id).maybeSingle(),
    supabase.from("reembolso_itens").select("id, descricao, apropriacao, tipo, data, valor").eq("reembolso_id", id).order("ordem"),
    supabase.from("apropriacoes").select("id, valor, saldo_ref, cc:centros_custo(codigo, descricao)").eq("origem", "reembolso").eq("origem_id", id).order("id"),
    supabase.from("reembolso_arquivos").select("id, nome, enviado_em").eq("reembolso_id", id).order("enviado_em", { ascending: false }),
  ]);
  if (error) return "migracao" as const;
  if (!r) return null;
  return {
    reembolso: numerico(r as ReembolsoLista),
    itens: ((itens ?? []) as ItemReembolsoOriginal[]).map((i) => ({ ...i, valor: Number(i.valor) })),
    aprops: ((aprops ?? []) as unknown as { id: number; valor: number; saldo_ref: number | null; cc: { codigo: string; descricao: string } | null }[]).map(
      (a): AproReembolso => ({ id: a.id, valor: Number(a.valor), saldo_ref: a.saldo_ref == null ? null : Number(a.saldo_ref), cc_codigo: a.cc?.codigo ?? "", cc_descricao: a.cc?.descricao ?? "" }),
    ),
    arquivos: (arquivos ?? []) as ArquivoReembolso[],
  };
}

/** Fornecedores no formato do original ("NOME | FANTASIA"), com os dados bancários do favorecido. */
export async function fornecedoresReembolso(): Promise<FornecedorReembolso[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fornecedores")
    .select("id, nome, nome_fantasia, cpf_cnpj, banco, agencia, conta, banco_cnpj_favorecido")
    .eq("ativo", true)
    .order("nome")
    .limit(10000);
  return (data ?? []).map((f) => ({
    valor: String(f.id),
    rotulo: `${f.nome} | ${f.nome_fantasia ?? ""}`,
    cpf_cnpj: f.banco_cnpj_favorecido || f.cpf_cnpj || "",
    banco: f.banco ?? "",
    agencia: f.agencia ?? "",
    conta: f.conta ?? "",
  }));
}

/** Filiais (clientes) de cada obra, para o campo "Filial". */
export async function filiaisPorObra(): Promise<Record<string, { valor: string; rotulo: string }[]>> {
  const supabase = await createClient();
  const { data } = await supabase.from("obra_filiais").select("obra_id, cliente_id, cliente:clientes!cliente_id(nome), obra:obras(nome)");
  const r: Record<string, { valor: string; rotulo: string }[]> = {};
  for (const f of (data ?? []) as unknown as { obra_id: number; cliente_id: number; cliente: { nome: string } | null; obra: { nome: string } | null }[])
    (r[f.obra_id] ??= []).push({ valor: String(f.cliente_id), rotulo: `${f.obra?.nome ?? ""} | ${f.cliente?.nome ?? ""}` });
  return r;
}

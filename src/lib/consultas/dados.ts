import { createClient } from "@/lib/supabase/server";

// Consultas do AstroTools: Pedidos (Simples / Apropriado x Pago), Pagamentos Efetuados, Fornecedores,
// Mapas Pendentes, Notas Fiscais e Itens — todas com o mesmo filtro.

export type TipoConsulta = "P" | "N" | "F" | "MP" | "NF" | "I";

export type FiltroConsulta = {
  tipo: TipoConsulta;
  obra: string;
  fornecedor: string;
  cliente: string;
  usuario: string;
  classificacao: string;
  inicio: string;
  fim: string;
  modelo: "S" | "P";
  pgtoInicio: string;
  pgtoFim: string;
  situacao: "T" | "A" | "F";
  itens: string[];
};

export type LinhaPedido = {
  id: number;
  oc: number | null;
  nome: string | null;
  fornecedor: string;
  obra: string;
  data: string;
  valor_oc: number;
  valor_aprop: number;
  valor_nf: number;
  valor_guia: number;
  aprop_pago: number;
  responsavel: string;
};
export type LinhaPagamento = { id: number; nota: string; serie: string; data_pagamento: string | null; usuario: string; obra: string; pedido: number | null; fornecedor: string; valor: number };
export type LinhaFornecedor = { chave: string; fornecedor: string; cliente: string; valor: number; pedidos: number; classificacao: string };
export type LinhaMapa = {
  id: number;
  obra: string;
  solicitante: string;
  servico: string;
  numero: number | null;
  origem: string;
  data: string;
  dias: number;
  finalizado: boolean;
  data_finalizado: string | null;
};
export type LinhaNota = {
  id: number;
  numero: string;
  guia: number | null;
  serie: string;
  oc_cliente: number | null;
  valor: number;
  vencimento: string;
  pagamento: string | null;
  tipo: string;
  situacao: string;
  fornecedor: string;
  fase: string;
  obra: string;
};
export type LinhaItem = {
  chave: string;
  codigo: string;
  item: string;
  fornecedor: string;
  quantidade: number;
  unidade: string;
  minimo: number;
  maximo: number;
  medio: number;
  total: number;
  obra: string;
  primeira: string;
  ultima: string;
};

const TIPOS_DOC: Record<string, string> = { NF: "NOTA FISCAL", RECIBO: "RECIBO", BOLETO: "BOLETO", TRANSFERENCIA: "TRANSFERÊNCIA", REEMBOLSO: "REEMBOLSO" };
const num = (v: unknown) => Number(v ?? 0);
const noPeriodo = (d: string | null, ini: string, fim: string) => (!ini || (d ?? "") >= ini) && (!fim || (d ?? "").slice(0, 10) <= fim);

/** Ids das obras que passam pelos filtros Obra e Cliente (null = sem restrição). */
async function obrasFiltradas(f: FiltroConsulta): Promise<number[] | null> {
  if (f.obra) return [Number(f.obra)];
  if (!f.cliente) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("obras").select("id").eq("cliente_id", Number(f.cliente));
  return (data ?? []).map((o) => o.id);
}

async function fornecedoresClassificados(f: FiltroConsulta): Promise<number[] | null> {
  if (!f.classificacao.trim()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("fornecedores").select("id").ilike("classificacao", `%${f.classificacao.trim()}%`);
  return (data ?? []).map((x) => x.id);
}

async function pedidos(f: FiltroConsulta): Promise<LinhaPedido[]> {
  const supabase = await createClient();
  const [obras, forns] = await Promise.all([obrasFiltradas(f), fornecedoresClassificados(f)]);
  let q = supabase.from("ocs_resumo").select("id, numero_cliente, nome, fornecedor_nome, obra_nome, data_emissao, valor_total, total_apropriado, obra_id, fornecedor_id, status").neq("status", "cancelada");
  if (obras) q = q.in("obra_id", obras);
  if (forns) q = q.in("fornecedor_id", forns);
  if (f.fornecedor) q = q.eq("fornecedor_id", Number(f.fornecedor));
  if (f.inicio) q = q.gte("data_emissao", f.inicio);
  if (f.fim) q = q.lte("data_emissao", f.fim);
  const { data: ocs } = await q.order("numero_cliente").limit(5000);
  const ids = (ocs ?? []).map((o) => o.id);
  if (!ids.length) return [];
  const [{ data: criadores }, { data: notas }] = await Promise.all([
    supabase.from("ordens_compra").select("id, criado_por, autor:perfis!criado_por(nome)").in("id", ids),
    supabase.from("notas_fiscais").select("ordem_compra_id, fase, status, valor").in("ordem_compra_id", ids).neq("status", "cancelada"),
  ]);
  const autor = new Map(((criadores ?? []) as unknown as { id: number; criado_por: string | null; autor: { nome: string } | null }[]).map((c) => [c.id, c]));
  const nf = new Map<number, number>();
  const guia = new Map<number, number>();
  for (const n of notas ?? []) {
    if (n.fase === "cinza") nf.set(n.ordem_compra_id, (nf.get(n.ordem_compra_id) ?? 0) + num(n.valor));
    else if (n.status === "paga") guia.set(n.ordem_compra_id, (guia.get(n.ordem_compra_id) ?? 0) + num(n.valor));
  }
  return (ocs ?? [])
    .filter((o) => !f.usuario || autor.get(o.id)?.criado_por === f.usuario)
    .map((o) => {
      const aprop = num(o.total_apropriado);
      return {
        id: o.id,
        oc: o.numero_cliente,
        nome: o.nome,
        fornecedor: o.fornecedor_nome,
        obra: o.obra_nome,
        data: o.data_emissao,
        valor_oc: num(o.valor_total),
        valor_aprop: aprop,
        valor_nf: nf.get(o.id) ?? 0,
        valor_guia: guia.get(o.id) ?? 0,
        aprop_pago: aprop - (nf.get(o.id) ?? 0) - (guia.get(o.id) ?? 0),
        responsavel: autor.get(o.id)?.autor?.nome ?? "",
      };
    });
}

type NotaBruta = {
  id: number;
  fase: string;
  status: string;
  numero: string;
  serie: string;
  tipo_documento: string | null;
  tipo_pagamento: string | null;
  vencimento: string;
  valor: number;
  pago_em: string | null;
  obra_id: number;
  obra_nome: string;
  cliente_nome: string | null;
  pedido: number | null;
  fornecedor_id: number;
  fornecedor_nome: string;
  pago_por_nome: string | null;
  guia_numero: number | null;
};

async function notas(f: FiltroConsulta, somentePagas: boolean): Promise<NotaBruta[]> {
  const supabase = await createClient();
  const [obras, forns] = await Promise.all([obrasFiltradas(f), fornecedoresClassificados(f)]);
  let q = supabase
    .from("notas_lista")
    .select("id, fase, status, numero, serie, tipo_documento, tipo_pagamento, vencimento, valor, pago_em, obra_id, obra_nome, cliente_nome, pedido, fornecedor_id, fornecedor_nome, pago_por_nome, guia_numero")
    .neq("status", "cancelada");
  if (somentePagas) q = q.eq("fase", "cinza").eq("status", "paga");
  if (obras) q = q.in("obra_id", obras);
  if (forns) q = q.in("fornecedor_id", forns);
  if (f.fornecedor) q = q.eq("fornecedor_id", Number(f.fornecedor));
  const { data } = await q.order("vencimento", { ascending: false }).limit(10000);
  let lista = (data ?? []) as NotaBruta[];
  if (f.usuario) {
    const { data: u } = await supabase.from("perfis").select("nome").eq("id", f.usuario).maybeSingle();
    lista = lista.filter((n) => n.pago_por_nome === u?.nome);
  }
  return lista;
}

async function pagamentos(f: FiltroConsulta): Promise<LinhaPagamento[]> {
  return (await notas(f, true))
    .filter((n) => noPeriodo(n.pago_em, f.pgtoInicio || f.inicio, f.pgtoFim || f.fim))
    .map((n) => ({
      id: n.id,
      nota: n.numero,
      serie: n.serie,
      data_pagamento: n.pago_em,
      usuario: n.pago_por_nome ?? "",
      obra: n.cliente_nome ?? n.obra_nome,
      pedido: n.pedido,
      fornecedor: n.fornecedor_nome,
      valor: num(n.valor),
    }));
}

async function notasFiscais(f: FiltroConsulta): Promise<LinhaNota[]> {
  const pago = (n: NotaBruta) => n.status === "paga";
  return (await notas(f, false))
    .filter((n) => f.situacao === "T" || (f.situacao === "F" ? pago(n) : !pago(n)))
    .filter((n) => noPeriodo(n.vencimento, f.inicio, f.fim) && (!(f.pgtoInicio || f.pgtoFim) || noPeriodo(n.pago_em, f.pgtoInicio, f.pgtoFim)))
    .map((n) => ({
      id: n.id,
      numero: n.numero,
      guia: n.guia_numero,
      serie: n.serie?.startsWith("P") ? "" : n.serie,
      oc_cliente: n.pedido,
      valor: num(n.valor),
      vencimento: n.vencimento,
      pagamento: n.pago_em,
      tipo: TIPOS_DOC[n.tipo_documento ?? "NF"] ?? n.tipo_documento ?? "",
      situacao: [pago(n) ? "Pago" : "Pendente", n.fase === "azul" ? n.tipo_pagamento : null].filter(Boolean).join(" / "),
      fornecedor: n.fornecedor_nome,
      fase: n.fase === "azul" ? "NFs - Administração" : "NFs - Contrato Fechado",
      obra: n.obra_nome,
    }));
}

async function fornecedores(f: FiltroConsulta): Promise<LinhaFornecedor[]> {
  const supabase = await createClient();
  const [obras, forns] = await Promise.all([obrasFiltradas(f), fornecedoresClassificados(f)]);
  let q = supabase.from("ocs_resumo").select("fornecedor_id, fornecedor_nome, cliente_nome, obra_nome, valor_total, data_emissao, obra_id").neq("status", "cancelada");
  if (obras) q = q.in("obra_id", obras);
  if (forns) q = q.in("fornecedor_id", forns);
  if (f.fornecedor) q = q.eq("fornecedor_id", Number(f.fornecedor));
  if (f.inicio) q = q.gte("data_emissao", f.inicio);
  if (f.fim) q = q.lte("data_emissao", f.fim);
  const [{ data: ocs }, { data: classes }] = await Promise.all([q.limit(20000), supabase.from("fornecedores").select("id, classificacao").limit(20000)]);
  const classe = new Map((classes ?? []).map((c) => [c.id, c.classificacao ?? ""]));
  const grupos = new Map<string, LinhaFornecedor>();
  for (const o of ocs ?? []) {
    const cliente = o.cliente_nome ?? o.obra_nome;
    const chave = `${o.fornecedor_id}|${cliente}`;
    const g = grupos.get(chave) ?? { chave, fornecedor: o.fornecedor_nome, cliente, valor: 0, pedidos: 0, classificacao: classe.get(o.fornecedor_id) ?? "" };
    g.valor += num(o.valor_total);
    g.pedidos++;
    grupos.set(chave, g);
  }
  return [...grupos.values()].sort((a, b) => a.fornecedor.localeCompare(b.fornecedor, "pt-BR"));
}

async function mapasPendentes(f: FiltroConsulta, hoje: Date): Promise<LinhaMapa[]> {
  const supabase = await createClient();
  const obras = await obrasFiltradas(f);
  let q = supabase
    .from("mapas_resumo")
    .select("id, obra_id, obra_nome, solicitante_nome, servico, numero_cliente, regularizacao_engenharia, criado_em, atualizado_em, status, criado_por")
    .not("status", "eq", "cancelado");
  if (obras) q = q.in("obra_id", obras);
  if (f.inicio) q = q.gte("criado_em", f.inicio);
  if (f.fim) q = q.lte("criado_em", `${f.fim}T23:59:59`);
  const { data: mapas } = await q.order("criado_em").limit(10000);
  const ids = (mapas ?? []).map((m) => m.id);
  const comPedido = new Set<number>();
  if (ids.length) {
    const { data: ocs } = await supabase.from("ordens_compra").select("mapa_id").in("mapa_id", ids).neq("status", "cancelada");
    for (const o of ocs ?? []) if (o.mapa_id) comPedido.add(o.mapa_id);
  }
  return (mapas ?? [])
    .filter((m) => !comPedido.has(m.id) && (!f.usuario || m.criado_por === f.usuario))
    .map((m) => ({
      id: m.id,
      obra: m.obra_nome,
      solicitante: m.solicitante_nome ?? "",
      servico: m.servico,
      numero: m.numero_cliente,
      origem: m.regularizacao_engenharia ? "Regularização" : "Normal",
      data: m.criado_em,
      dias: Math.max(0, Math.floor((hoje.getTime() - new Date(m.criado_em).getTime()) / 86400000)),
      finalizado: m.status === "finalizado",
      data_finalizado: m.status === "finalizado" ? m.atualizado_em : null,
    }));
}

async function itens(f: FiltroConsulta): Promise<LinhaItem[]> {
  if (!f.itens.length) return [];
  const supabase = await createClient();
  const [obras, forns] = await Promise.all([obrasFiltradas(f), fornecedoresClassificados(f)]);
  const { data } = await supabase
    .from("oc_itens")
    .select("item_id, codigo, descricao, quantidade, unidade, valor_unitario, oc:ordens_compra!inner(obra_id, fornecedor_id, data_emissao, status, obra:obras(nome), fornecedor:fornecedores(nome))")
    .in("item_id", f.itens.map(Number))
    .eq("e_titulo", false)
    .limit(20000);
  type Bruto = {
    item_id: number;
    codigo: string;
    descricao: string;
    quantidade: number;
    unidade: string;
    valor_unitario: number;
    oc: { obra_id: number; fornecedor_id: number; data_emissao: string; status: string; obra: { nome: string } | null; fornecedor: { nome: string } | null };
  };
  const grupos = new Map<string, LinhaItem & { soma: number; n: number }>();
  for (const i of (data ?? []) as unknown as Bruto[]) {
    const o = i.oc;
    if (o.status === "cancelada" || (obras && !obras.includes(o.obra_id)) || (forns && !forns.includes(o.fornecedor_id))) continue;
    if (f.fornecedor && o.fornecedor_id !== Number(f.fornecedor)) continue;
    if (!noPeriodo(o.data_emissao, f.inicio, f.fim)) continue;
    const chave = `${i.item_id}|${o.fornecedor_id}|${o.obra_id}`;
    const u = num(i.valor_unitario);
    const g = grupos.get(chave) ?? {
      chave,
      codigo: String(i.item_id),
      item: i.descricao,
      fornecedor: o.fornecedor?.nome ?? "",
      quantidade: 0,
      unidade: i.unidade,
      minimo: u,
      maximo: u,
      medio: 0,
      total: 0,
      obra: o.obra?.nome ?? "",
      primeira: o.data_emissao,
      ultima: o.data_emissao,
      soma: 0,
      n: 0,
    };
    g.quantidade += num(i.quantidade);
    g.total += num(i.quantidade) * u;
    g.minimo = Math.min(g.minimo, u);
    g.maximo = Math.max(g.maximo, u);
    g.soma += u;
    g.n++;
    g.primeira = g.primeira < o.data_emissao ? g.primeira : o.data_emissao;
    g.ultima = g.ultima > o.data_emissao ? g.ultima : o.data_emissao;
    grupos.set(chave, g);
  }
  return [...grupos.values()].map(({ soma, n, ...g }) => ({ ...g, medio: n ? soma / n : 0 }));
}

export type ResultadoConsulta =
  | { tipo: "P"; linhas: LinhaPedido[] }
  | { tipo: "N"; linhas: LinhaPagamento[] }
  | { tipo: "F"; linhas: LinhaFornecedor[] }
  | { tipo: "MP"; linhas: LinhaMapa[] }
  | { tipo: "NF"; linhas: LinhaNota[] }
  | { tipo: "I"; linhas: LinhaItem[] };

export async function executarConsulta(f: FiltroConsulta, hoje: Date): Promise<ResultadoConsulta> {
  switch (f.tipo) {
    case "P":
      return { tipo: "P", linhas: await pedidos(f) };
    case "N":
      return { tipo: "N", linhas: await pagamentos(f) };
    case "F":
      return { tipo: "F", linhas: await fornecedores(f) };
    case "MP":
      return { tipo: "MP", linhas: await mapasPendentes(f, hoje) };
    case "NF":
      return { tipo: "NF", linhas: await notasFiscais(f) };
    case "I":
      return { tipo: "I", linhas: await itens(f) };
  }
}

/** Opções dos selects do filtro, no formato do original. */
export async function opcoesConsulta() {
  const supabase = await createClient();
  const [{ data: obras }, { data: forn }, { data: clientes }, { data: usuarios }, { data: itensCat }] = await Promise.all([
    supabase.from("obras").select("id, nome, regime").eq("ativo", true).order("nome"),
    supabase.from("fornecedores").select("id, nome, nome_fantasia").order("nome").limit(10000),
    supabase.from("clientes").select("id, nome, razao_social").order("nome").limit(5000),
    supabase.from("perfis").select("id, nome").order("nome"),
    supabase.from("itens").select("id, descricao, unidade").eq("ativo", true).order("descricao").limit(20000),
  ]);
  const regime: Record<string, string> = { administracao: "Administração", fechado: "Fechado", completo: "Completo" };
  return {
    obras: (obras ?? []).map((o) => ({ valor: String(o.id), rotulo: `${o.nome} - ${regime[o.regime as string] ?? o.regime}` })),
    fornecedores: (forn ?? []).map((x) => ({ valor: String(x.id), rotulo: `${x.nome} | ${x.nome_fantasia ?? ""}` })),
    clientes: (clientes ?? []).map((c) => ({ valor: String(c.id), rotulo: `${c.razao_social ?? c.nome} | ${c.nome}` })),
    usuarios: (usuarios ?? []).map((u) => ({ valor: String(u.id), rotulo: u.nome })),
    itens: (itensCat ?? []).map((i) => ({ valor: String(i.id), rotulo: `${i.descricao} | ${i.unidade}` })),
  };
}


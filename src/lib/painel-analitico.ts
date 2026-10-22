import { createClient } from "@/lib/supabase/server";

// Dashboard Analítico do AstroTools (Engenharia, Coordenação, Financeiro e Admin), conferido com as obras do original:
// Fase Cinza (obras Fechadas/Completas)
//   Adm. Análise Financeira / Adm. Orçamento = Σ das linhas ADM de todas as planilhas
//   Valor Total Obra  = Análise Financeira da 1ª planilha
//   Verba Alocada     = Σ dos Pagamentos Cliente
//   Verba Disponível  = Σ (Alocado − Val Pago) dos CCs normais (sem ADM e Impostos)
//   Pagamentos Pendentes = notas da Fase Cinza aguardando pagamento; OC's Bloqueadas = OCs com pendência não liberada
// Fase Azul (obras de Administração/Completas)
//   Análise Financeira / Orçamento = totais das planilhas; Valor Fechado = Σ Fechamento dos CCs normais
//   Pendente Guia = Valor Fechado − Σ pago dos CCs normais; Guia Adm Enviada = Σ Guias ADM
//   Total Adm Prevista = Fechamento da linha ADM da 1ª planilha; Administração = Guias ADM pagas

export type LinhaCinza = {
  obra_id: number;
  obra: string;
  adm_af: number;
  adm_orc: number;
  valor_total: number;
  verba_alocada: number;
  verba_disponivel: number;
  pagamentos_pendentes: number;
  ocs_bloqueadas: number;
};
export type LinhaAzul = {
  obra_id: number;
  obra: string;
  analise_financeira: number;
  orcamento: number;
  valor_fechado: number;
  pendente_guia: number;
  guia_adm: number;
  adm_prevista: number;
  administracao: number;
};

type Cc = {
  obra_id: number;
  planilha_id: number;
  planilha_seq: number;
  nivel: string;
  an_financeira: number;
  orcamento: number;
  fechamento: number;
  verba_alocada: number;
  val_pago: number;
  pago_guia: number;
  ordem: number;
};

export async function carregarAnalitico(perfil: { id: string; papel: string }) {
  const supabase = await createClient();
  let qObras = supabase.from("obras").select("id, nome, regime").eq("ativo", true).order("nome");
  // Engenharia vê as obras em que é responsável, como no original.
  if (perfil.papel === "engenharia" || perfil.papel === "usuario") {
    const { data: resp } = await supabase.from("obra_responsaveis").select("obra_id").eq("perfil_id", perfil.id);
    qObras = qObras.in("id", (resp ?? []).map((r) => r.obra_id));
  }
  const { data: obras } = await qObras;
  const ids = (obras ?? []).map((o) => o.id);
  if (!ids.length) return { cinza: [] as LinhaCinza[], azul: [] as LinhaAzul[] };

  const [{ data: ccs }, { data: planilhas }, { data: pagCli }, { data: notas }, { data: ocs }, { data: guias }] = await Promise.all([
    supabase
      .from("centros_custo_saldos")
      .select("obra_id, planilha_id, planilha_seq, nivel, an_financeira, orcamento, fechamento, verba_alocada, val_pago, pago_guia, ordem")
      .in("obra_id", ids)
      .in("nivel", ["CC", "ADM", "I"])
      .limit(100000),
    supabase.from("planilhas").select("id, obra_id, seq, ativo").in("obra_id", ids),
    supabase.from("pagamentos_cliente").select("obra_id, valor").in("obra_id", ids).limit(100000),
    supabase.from("notas_fiscais").select("obra_id, valor").in("obra_id", ids).eq("fase", "cinza").eq("status", "pendente_pagamento").limit(100000),
    supabase.from("ordens_compra").select("obra_id").in("obra_id", ids).in("status", ["aguardando_aprovacao", "reprovada"]).limit(100000),
    supabase.from("guias_lista").select("obra_id, tipo, valor, pago").in("obra_id", ids).eq("tipo", "adm").limit(100000),
  ]);
  const ativas = new Set((planilhas ?? []).filter((p) => p.ativo).map((p) => p.id));
  const porObra = new Map<number, Cc[]>();
  for (const c of (ccs ?? []) as Cc[]) {
    if (!ativas.has(c.planilha_id)) continue;
    porObra.set(c.obra_id, [...(porObra.get(c.obra_id) ?? []), c]);
  }
  const somar = <T>(lista: T[] | null, f: (x: T) => number, obra: (x: T) => number) => {
    const m = new Map<number, number>();
    for (const x of lista ?? []) m.set(obra(x), (m.get(obra(x)) ?? 0) + f(x));
    return m;
  };
  const verba = somar(pagCli, (p) => Number(p.valor), (p) => p.obra_id);
  const pendentes = somar(notas, (n) => Number(n.valor), (n) => n.obra_id);
  const bloqueadas = somar(ocs, () => 1, (o) => o.obra_id);
  const guiaAdm = somar(guias, (g) => Number(g.valor), (g) => g.obra_id);
  const admPaga = somar(guias, (g) => (g.pago ? Number(g.valor) : 0), (g) => g.obra_id);
  const n = (v: unknown) => Number(v ?? 0);

  const cinza: LinhaCinza[] = [];
  const azul: LinhaAzul[] = [];
  for (const o of obras ?? []) {
    const lista = porObra.get(o.id) ?? [];
    const normais = lista.filter((c) => c.nivel === "CC");
    const adm = lista.filter((c) => c.nivel === "ADM");
    const primeiraSeq = Math.min(...lista.map((c) => c.planilha_seq));
    const daPrimeira = lista.filter((c) => c.planilha_seq === primeiraSeq);
    if (o.regime === "fechado" || o.regime === "completo")
      cinza.push({
        obra_id: o.id,
        obra: o.nome,
        adm_af: adm.reduce((s, c) => s + n(c.an_financeira), 0),
        adm_orc: adm.reduce((s, c) => s + n(c.orcamento), 0),
        valor_total: daPrimeira.reduce((s, c) => s + n(c.an_financeira), 0),
        verba_alocada: verba.get(o.id) ?? 0,
        verba_disponivel: normais.reduce((s, c) => s + n(c.verba_alocada) - n(c.val_pago), 0),
        pagamentos_pendentes: pendentes.get(o.id) ?? 0,
        ocs_bloqueadas: bloqueadas.get(o.id) ?? 0,
      });
    if (o.regime === "administracao" || o.regime === "completo") {
      const fechado = normais.reduce((s, c) => s + n(c.fechamento), 0);
      const admPrimeira = daPrimeira.filter((c) => c.nivel === "ADM").sort((a, b) => a.ordem - b.ordem)[0];
      azul.push({
        obra_id: o.id,
        obra: o.nome,
        analise_financeira: lista.reduce((s, c) => s + n(c.an_financeira), 0),
        orcamento: lista.reduce((s, c) => s + n(c.orcamento), 0),
        valor_fechado: fechado,
        pendente_guia: fechado - normais.reduce((s, c) => s + n(c.val_pago) + n(c.pago_guia), 0),
        guia_adm: guiaAdm.get(o.id) ?? 0,
        adm_prevista: admPrimeira ? n(admPrimeira.fechamento) : 0,
        administracao: admPaga.get(o.id) ?? 0,
      });
    }
  }
  return { cinza, azul };
}

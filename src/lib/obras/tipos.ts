// Controle financeiro da obra: planilhas de orçamento e árvore de centros de custo (CC).

export type ModoPlanilha = "verba" | "guia";

export const NIVEIS = ["T0", "T0-I", "T1", "CC", "ADM0", "ADM", "I0", "I"] as const;
export type Nivel = (typeof NIVEIS)[number];

/** Níveis que lançam valores (folhas). Os demais (títulos) mostram a soma dos filhos. */
export const NIVEIS_FOLHA: Nivel[] = ["CC", "ADM", "I"];

export const ROTULO_NIVEL: Record<Nivel, string> = {
  T0: "Item principal",
  "T0-I": "Item principal (sem imposto)",
  T1: "Sub-item",
  CC: "Centro de custo",
  ADM0: "Administração (título)",
  ADM: "Administração",
  I0: "Impostos (título)",
  I: "Imposto",
};

export const MODOS: Record<ModoPlanilha, string> = {
  verba: "Fechado (verba alocada)",
  guia: "Administrado (guias)",
};

export type Planilha = {
  id: number;
  obra_id: number;
  seq: number;
  nome: string;
  modo: ModoPlanilha;
  ativo: boolean;
  verba_alocada: number;
  alocado_ccs: number;
  taxa_adm: number;
  taxa_imp: number;
};

export type CentroCusto = {
  id: number;
  planilha_id: number;
  codigo: string;
  descricao: string;
  nivel: Nivel;
  ordem: number;
  an_financeira: number;
  orcamento: number;
  verba_alocada: number;
  fechamento: number;
  val_pago: number;
  pago_guia: number;
  a_pagar: number;
  meta: number;
};

export type PagamentoCliente = {
  id: number;
  planilha_id: number;
  data: string;
  valor: number;
  data_previsao: string | null;
  data_efetivacao: string | null;
  realizado: boolean | null;
  descricao: string;
};

export type Percentual = { id: number; planilha_id: number; tipo: "adm" | "imp" | "tot"; descricao: string; valor: number };

export type Responsavel = {
  id: number;
  perfil_id: string;
  tipo: "engenheiro" | "coordenador" | "suprimentos";
  limite_aprovacao_oc: number | null;
  qtd_aprovacao_oc: number | null;
  perfil: { nome: string; email: string } | null;
};

export const TIPOS_RESPONSAVEL = { engenheiro: "Engenheiro", coordenador: "Coordenador", suprimentos: "Suprimentos" } as const;

export const COLUNAS_VALOR = ["an_financeira", "orcamento", "fechamento", "verba_alocada", "val_pago", "pago_guia", "a_pagar", "meta"] as const;
export type ColunaValor = (typeof COLUNAS_VALOR)[number];
export type Totais = Record<ColunaValor, number>;

export const zerados = (): Totais => Object.fromEntries(COLUNAS_VALOR.map((c) => [c, 0])) as Totais;

const ehFolha = (c: CentroCusto) => NIVEIS_FOLHA.includes(c.nivel);

/** Soma das folhas de uma lista de CCs. */
export function somarFolhas(ccs: CentroCusto[]): Totais {
  const t = zerados();
  for (const c of ccs) if (ehFolha(c)) for (const k of COLUNAS_VALOR) t[k] += Number(c[k]);
  return t;
}

/** Valores exibidos por linha: folhas mostram os próprios; títulos, a soma das folhas abaixo do código. */
export function valoresArvore(ccs: CentroCusto[]): Map<number, Totais> {
  const mapa = new Map<number, Totais>();
  for (const c of ccs) {
    if (ehFolha(c)) {
      mapa.set(c.id, Object.fromEntries(COLUNAS_VALOR.map((k) => [k, Number(c[k])])) as Totais);
      continue;
    }
    const filhos = ccs.filter((f) => ehFolha(f) && f.codigo.startsWith(`${c.codigo}.`));
    mapa.set(c.id, filhos.length ? somarFolhas(filhos) : (Object.fromEntries(COLUNAS_VALOR.map((k) => [k, Number(c[k])])) as Totais));
  }
  return mapa;
}

/** Nível deduzido do código: "01" → T0, "01.02" → T1, "01.02.03" → CC. */
export function nivelPorCodigo(codigo: string): Nivel {
  const partes = codigo.split(".").length;
  return partes === 1 ? "T0" : partes === 2 ? "T1" : "CC";
}

/** Ordena códigos como "01.02.10" numericamente por segmento. */
export function compararCodigo(a: string, b: string) {
  return a.localeCompare(b, "pt-BR", { numeric: true });
}

export type LinhaImportada = { codigo: string; descricao: string; an_financeira: number; orcamento: number; nivel?: Nivel };

/** Converte "1.234,56", "1234.56" ou "R$ 1.234,56" em número. */
export function numeroBr(v: string): number {
  const s = v.replace(/[R$\s]/g, "");
  if (!s) return 0;
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Lê um texto colado do Excel (separado por tab) ou um CSV (; ou ,).
 * Colunas esperadas: Código | Descrição | An. Financeira | Orçamento | Nível (opcional).
 * Linhas sem código ou com cabeçalho são ignoradas.
 */
export function lerPlanilhaTexto(texto: string): { linhas: LinhaImportada[]; erros: string[] } {
  const brutas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!brutas.length) return { linhas: [], erros: ["Nada para importar."] };
  const sep = brutas[0].includes("\t") ? "\t" : brutas[0].includes(";") ? ";" : ",";
  const linhas: LinhaImportada[] = [];
  const erros: string[] = [];
  brutas.forEach((bruta, i) => {
    const cols = bruta.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const codigo = cols[0] ?? "";
    if (!/^[A-Za-z]?\d+(\.\d+)*$/.test(codigo)) {
      if (i > 0 || !/c[oó]d/i.test(codigo)) erros.push(`Linha ${i + 1}: código "${codigo}" inválido — ignorada.`);
      return;
    }
    const an = numeroBr(cols[2] ?? "");
    const orc = numeroBr(cols[3] ?? "");
    if (Number.isNaN(an) || Number.isNaN(orc)) {
      erros.push(`Linha ${i + 1}: valor inválido — ignorada.`);
      return;
    }
    const nivelTxt = (cols[4] ?? "").toUpperCase() as Nivel;
    linhas.push({
      codigo,
      descricao: cols[1] ?? "",
      an_financeira: an,
      orcamento: orc,
      nivel: NIVEIS.includes(nivelTxt) ? nivelTxt : undefined,
    });
  });
  const vistos = new Set<string>();
  for (const l of linhas) {
    if (vistos.has(l.codigo)) erros.push(`Código ${l.codigo} repetido.`);
    vistos.add(l.codigo);
  }
  return { linhas, erros };
}

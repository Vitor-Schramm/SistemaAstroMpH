"use client";

import { Cartao } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import { data as fmtData } from "@/lib/format";
import type { ObraFinanceiro } from "@/lib/dashboards";

// "Dashboard Financeiro" do AstroTools: uma linha por obra com o cadastro e as Taxas de Administração em R$.

const REGIME: Record<string, string> = { administracao: "Administração", fechado: "Fechado", completo: "Completo" };
const real = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const n2 = (v: number | null) => Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function FinanceiroView({ obras }: { obras: ObraFinanceiro[] }) {
  const t = (s: string | null) => s ?? "";
  const colunas: ColunaTabela<ObraFinanceiro>[] = [
    { chave: "cod", titulo: "Código", valor: (o) => o.id },
    { chave: "obra", titulo: "Obra", valor: (o) => o.nome, className: "font-semibold" },
    { chave: "ano", titulo: "Ano", valor: (o) => o.ano },
    { chave: "regime", titulo: "Regime", valor: (o) => REGIME[o.regime] ?? o.regime },
    { chave: "status", titulo: "Status", valor: (o) => (o.ativo ? "Ativo" : "Inativo") },
    { chave: "stc", titulo: "Status Complementar", valor: (o) => t(o.status_complementar) },
    { chave: "tipo", titulo: "Tipo de Obra", valor: (o) => t(o.tipo_obra) },
    { chave: "met", titulo: "Metragem", valor: (o) => Number(o.metragem ?? 0), render: (o) => n2(o.metragem) },
    { chave: "ini", titulo: "Inicio da Obra", valor: (o) => o.inicio, render: (o) => fmtData(o.inicio) },
    { chave: "ter", titulo: "Termino da Obra", valor: (o) => o.termino, render: (o) => fmtData(o.termino) },
    { chave: "ent", titulo: "Entrega / Previsão da Obra", valor: (o) => o.entrega_prevista, render: (o) => fmtData(o.entrega_prevista) },
    { chave: "asb", titulo: "As Built", valor: (o) => o.as_built_em, render: (o) => fmtData(o.as_built_em) },
    { chave: "leao", titulo: "Leão", valor: (o) => t(o.diretor) },
    { chave: "tigre", titulo: "Tigre", valor: (o) => t(o.coordenador) },
    { chave: "eng", titulo: "Engenheiro", valor: (o) => t(o.engenheiro) },
    { chave: "arq", titulo: "Arquitetura", valor: (o) => t(o.arquitetura) },
    { chave: "ger", titulo: "Gerenciadora", valor: (o) => t(o.gerenciadora) },
    { chave: "orc", titulo: "Orçamentista", valor: (o) => t(o.orcamentista) },
    { chave: "sup", titulo: "Suprimento", valor: (o) => t(o.suprimento) },
    { chave: "taf", titulo: "Taxa de Administração (Analise Financeira)", valor: (o) => o.adm_analise_financeira, render: (o) => real(o.adm_analise_financeira) },
    { chave: "tao", titulo: "Taxa de Administração (Analise Orçamento)", valor: (o) => o.adm_orcamento, render: (o) => real(o.adm_orcamento) },
    { chave: "acoes", titulo: "Ações", valor: () => "", exportar: false, ordenavel: false },
  ];
  return (
    <Cartao>
      <div className="pt-[0.5rem]">
        <TabelaDados colunas={colunas} linhas={obras} chave={(o) => o.id} nomeArquivo="dashboard-financeiro" />
      </div>
    </Cartao>
  );
}

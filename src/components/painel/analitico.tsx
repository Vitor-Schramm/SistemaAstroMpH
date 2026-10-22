"use client";

import { Cartao } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import type { LinhaAzul, LinhaCinza } from "@/lib/painel-analitico";

// Dashboard "Analítico" do AstroTools: tabela da Fase Cinza e tabela da Fase Azul (o nome da obra abre o Controle Financeiro).

const n2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function obra<T extends { obra_id: number; obra: string }>(): ColunaTabela<T> {
  return {
    chave: "obra",
    titulo: "Obra",
    valor: (l) => l.obra,
    className: "font-semibold",
    render: (l) => (
      <a href={`/obras/${l.obra_id}`} target="_blank" rel="noreferrer" className="hover:text-primary">
        {l.obra}
      </a>
    ),
  };
}

const valor = <T,>(chave: string, titulo: string, f: (l: T) => number): ColunaTabela<T> => ({ chave, titulo, valor: f, render: (l) => n2(f(l)), className: "whitespace-nowrap" });

export function PainelAnalitico({ cinza, azul }: { cinza: LinhaCinza[]; azul: LinhaAzul[] }) {
  const colCinza: ColunaTabela<LinhaCinza>[] = [
    obra<LinhaCinza>(),
    valor("af", "Adm. Análise Financeira", (l) => l.adm_af),
    valor("ao", "Adm. Orçamento", (l) => l.adm_orc),
    valor("vt", "Valor Total Obra", (l) => l.valor_total),
    valor("va", "Verba Alocada", (l) => l.verba_alocada),
    valor("vd", "Verba Disponível", (l) => l.verba_disponivel),
    valor("pp", "Pagamentos Pendentes", (l) => l.pagamentos_pendentes),
    { chave: "ob", titulo: "OC's Bloqueadas", valor: (l) => l.ocs_bloqueadas },
  ];
  const colAzul: ColunaTabela<LinhaAzul>[] = [
    obra<LinhaAzul>(),
    valor("af", "Análise Financeira", (l) => l.analise_financeira),
    valor("orc", "Orçamento", (l) => l.orcamento),
    valor("vf", "Valor Fechado", (l) => l.valor_fechado),
    valor("pg", "Pendente Guia", (l) => l.pendente_guia),
    valor("ga", "Guia Adm Enviada", (l) => l.guia_adm),
    valor("ap", "Total Adm Prevista", (l) => l.adm_prevista),
    valor("adm", "Administração", (l) => l.administracao),
  ];
  return (
    <>
      <Cartao>
        <div className="pt-[0.5rem]">
          <TabelaDados colunas={colCinza} linhas={cinza} chave={(l) => l.obra_id} nomeArquivo="dashboard-fase-cinza" />
        </div>
      </Cartao>
      <Cartao>
        <div className="pt-[0.5rem]">
          <TabelaDados colunas={colAzul} linhas={azul} chave={(l) => l.obra_id} nomeArquivo="dashboard-fase-azul" />
        </div>
      </Cartao>
    </>
  );
}

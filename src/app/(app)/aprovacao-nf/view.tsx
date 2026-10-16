"use client";

import { NotasTabela } from "@/components/notas/notas-tabela";
import { DecisaoNota } from "@/components/notas/acoes-nota";
import type { NotaResumo } from "@/lib/notas/tipos";

export function AprovacaoNfView({ notas, podeAprovar }: { notas: NotaResumo[]; podeAprovar: boolean }) {
  return (
    <NotasTabela
      titulo="Aprovação NF"
      descricao={
        podeAprovar
          ? "Notas das fases Cinza e Azul aguardando a validação da engenharia."
          : "Somente a engenharia (ou admin) aprova notas. Você está vendo em modo leitura."
      }
      notas={notas}
      nomeArquivo="aprovacao-nf"
      abas={[
        { chave: "aguardando", rotulo: "Aguardando engenharia", status: ["aguardando_engenharia"] },
        { chave: "reprovadas", rotulo: "Reprovadas", status: ["reprovada"] },
      ]}
      acoes={(n) => (podeAprovar && n.status === "aguardando_engenharia" ? <DecisaoNota nota={n} compacto /> : null)}
    />
  );
}

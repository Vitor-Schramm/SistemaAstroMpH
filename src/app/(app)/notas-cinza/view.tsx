"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotasTabela } from "@/components/notas/notas-tabela";
import { PagarNota } from "@/components/notas/acoes-nota";
import type { NotaResumo } from "@/lib/notas/tipos";

export function NotasCinzaView({ notas, podePagar, podeLancar }: { notas: NotaResumo[]; podePagar: boolean; podeLancar: boolean }) {
  return (
    <NotasTabela
      titulo="Notas Fase Cinza"
      descricao="A MPH paga o fornecedor com a verba da obra."
      notas={notas}
      nomeArquivo="notas-fase-cinza"
      abas={[
        { chave: "pendentes", rotulo: "Pendentes de pagamento", status: ["pendente_pagamento"] },
        { chave: "engenharia", rotulo: "Aguardando engenharia", status: ["aguardando_engenharia"] },
        { chave: "reprovadas", rotulo: "Reprovadas", status: ["reprovada"] },
        { chave: "pagas", rotulo: "Pagas", status: ["paga"] },
      ]}
      topo={
        podeLancar && (
          <Button render={<Link href="/notas/nova?fase=cinza" />}>
            <Plus /> Anexar OC x NF
          </Button>
        )
      }
      acoes={(n) => (podePagar && n.status === "pendente_pagamento" ? <PagarNota nota={n} compacto /> : null)}
    />
  );
}

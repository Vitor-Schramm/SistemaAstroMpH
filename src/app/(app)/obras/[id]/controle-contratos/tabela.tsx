"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { Cartao } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import { moeda } from "@/lib/format";
import type { ContratoObra } from "@/lib/obras/pagamentos-contratos";

export type ModoContratos = "P" | "F" | "U";

const COLUNAS: ColunaTabela<ContratoObra>[] = [
  { chave: "pedido", titulo: "Pedido", valor: (c) => c.pedido },
  {
    chave: "servico",
    titulo: "Serviço",
    valor: (c) => c.servico,
    render: (c) => (
      <div className="font-bold">
        {c.servico}{" "}
        <a href={`/ordens-compra/${c.id}`} target="_blank" title="Vizualizar" className="inline-flex align-middle text-primary">
          <Search className="size-[14px]" />
        </a>
      </div>
    ),
  },
  { chave: "total", titulo: "Valor Total", valor: (c) => c.valor_total, render: (c) => moeda(c.valor_total) },
  { chave: "empresa", titulo: "Empresa", valor: (c) => c.empresa, className: "bg-[rgba(0,255,3,0.24)]" },
  { chave: "forma", titulo: "Forma Pagamento", valor: (c) => c.forma_pagamento },
  { chave: "pago", titulo: "Valor Pago", valor: (c) => c.valor_pago, render: (c) => moeda(c.valor_pago) },
  { chave: "pendente", titulo: "Pendente", valor: (c) => c.pendente, render: (c) => moeda(c.pendente), className: "bg-[rgba(249,113,0,0.39)]" },
];

const BOTOES: { modo: ModoContratos; rotulo: string }[] = [
  { modo: "P", rotulo: "Contratos Pendentes" },
  { modo: "F", rotulo: "Contratos Finalizados" },
  { modo: "U", rotulo: "Todos os Contratos" },
];

const botao = "rounded-[0.358rem] border border-[#82868b] px-[1.2rem] py-[0.6rem] text-[#82868b] hover:bg-[rgba(130,134,139,0.04)]";

export function TabelaContratos({ obraId, modo, titulo, linhas }: { obraId: number; modo: ModoContratos; titulo: string; linhas: ContratoObra[] }) {
  return (
    <Cartao>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe9f1] p-[1.5rem] dark:border-[#3b4253]">
        <h4 className="mb-0 text-[1.285rem] font-medium text-heading">{titulo}</h4>
        <div className="flex flex-wrap gap-[0.5rem]">
          {BOTOES.filter((b) => b.modo !== modo).map((b) => (
            <Link key={b.modo} href={`/obras/${obraId}/controle-contratos?modo=${b.modo}`} className={botao}>
              {b.rotulo}
            </Link>
          ))}
          <Link href={`/obras/${obraId}`} className={botao}>
            Voltar
          </Link>
        </div>
      </div>
      <TabelaDados colunas={COLUNAS} linhas={linhas} chave={(c) => c.id} />
    </Cartao>
  );
}

"use client";

import Link from "next/link";
import { Cartao } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import { data as fmtData, moeda } from "@/lib/format";
import type { PagamentoObra } from "@/lib/obras/pagamentos-contratos";

const COLUNAS: ColunaTabela<PagamentoObra>[] = [
  { chave: "nota", titulo: "Nota", valor: (p) => p.numero },
  { chave: "serie", titulo: "Serie", valor: (p) => p.serie },
  { chave: "tipo", titulo: "Tipo", valor: (p) => p.tipo },
  { chave: "data", titulo: "Data Pagamento", valor: (p) => p.pago_em ?? "", render: (p) => (p.pago_em ? fmtData(p.pago_em) : "") },
  { chave: "usuario", titulo: "Usuário", valor: (p) => p.usuario },
  { chave: "obra", titulo: "Obra", valor: (p) => p.obra },
  { chave: "pedido", titulo: "Pedido", valor: (p) => p.pedido },
  { chave: "fornecedor", titulo: "Fornecedor", valor: (p) => p.fornecedor },
  { chave: "valor", titulo: "Valor", valor: (p) => p.valor, render: (p) => moeda(p.valor) },
  { chave: "cc", titulo: "CC", valor: (p) => p.cc },
];

const total = (linhas: PagamentoObra[]) => ({
  fornecedor: "Total:",
  valor: linhas.reduce((s, p) => s + p.valor, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
});

export function TabelaPagamentos({ linhas, voltar }: { linhas: PagamentoObra[]; voltar: string }) {
  return (
    <Cartao>
      <div className="border-b border-[#ebe9f1] p-[1.5rem] dark:border-[#3b4253]">
        <h4 className="mb-0 text-[1.285rem] font-medium text-heading">Pagamentos</h4>
      </div>
      <div className="flex justify-end px-[1.5rem] pt-[1.5rem]">
        <Link href={voltar} className="rounded-[0.358rem] border border-[#82868b] px-[1.5rem] py-[0.6rem] text-[#82868b] hover:bg-[rgba(130,134,139,0.04)]">
          Voltar
        </Link>
      </div>
      <TabelaDados colunas={COLUNAS} linhas={linhas} chave={(p) => p.id} totais={total} />
    </Cartao>
  );
}

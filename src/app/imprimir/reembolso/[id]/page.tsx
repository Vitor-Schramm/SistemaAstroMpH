import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { carregarReembolso } from "@/lib/reembolsos/dados";
import { BotaoImprimir } from "../../oc/[id]/botao";

export const metadata: Metadata = { title: "Solicitação de Reembolso" };

// PDF "SOLICITAÇÃO DE REEMBOLSO DE DESPESAS" do AstroTools (A4 retrato).

const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const hoje = () => new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

async function Documento({ params }: { params: PageProps<"/imprimir/reembolso/[id]">["params"] }) {
  await connection();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const d = await carregarReembolso(id);
  if (!d || d === "migracao") notFound();
  const { reembolso: r, itens } = d;
  return (
    <article className="mx-auto max-w-[794px] bg-white px-[56px] py-[60px] text-[12px] leading-tight text-black print:max-w-none print:p-0">
      <h1 className="mb-[60px] text-[15px] font-bold">SOLICITAÇÃO DE REEMBOLSO DE DESPESAS</h1>
      <div className="mb-[40px] flex justify-between">
        <p>
          <b>Obra:</b> {r.obra_nome}
        </p>
        <p>
          <b>Data:</b> {hoje()}
        </p>
      </div>
      <table className="mb-[30px] w-full border-collapse">
        <thead>
          <tr className="text-left">
            <th className="w-[6%] py-[4px]">Item</th>
            <th className="py-[4px]">Descrição</th>
            <th className="w-[13%] py-[4px]">Apropriação</th>
            <th className="w-[8%] py-[4px]">Tipo</th>
            <th className="w-[10%] py-[4px]">Data</th>
            <th className="w-[13%] py-[4px]">Valor</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((i, n) => (
            <tr key={i.id} className="align-top">
              <td className="py-[6px] pl-[8px]">{n + 1}</td>
              <td className="py-[6px]">{i.descricao}</td>
              <td className="py-[6px]">{i.apropriacao}</td>
              <td className="py-[6px]">{i.tipo}</td>
              <td className="py-[6px]">{dataBr(i.data)}</td>
              <td className="py-[6px]">{i.valor.toFixed(2)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} />
            <td className="pt-[10px] font-bold">Total</td>
            <td />
            <td className="pt-[10px] font-bold">{r.valor_total.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      <div className="space-y-[6px]">
        <p className="font-bold">Obs:. Favor Depositar Para:</p>
        <p>{r.fornecedor_nome}</p>
        <p>CPF/CNPJ: {r.cpf_cnpj}</p>
        <p>BANCO: {r.banco}</p>
        <p>CONTA: {r.conta}</p>
        <p>AGÊNCIA: {r.agencia}</p>
      </div>
    </article>
  );
}

export default function ReembolsoPdfPage({ params }: PageProps<"/imprimir/reembolso/[id]">) {
  return (
    <div className="min-h-screen bg-[#f3f2f7] p-6 print:bg-white print:p-0">
      <style>{"@page { size: A4 portrait; margin: 15mm; }"}</style>
      <div className="mx-auto mb-4 flex max-w-[794px] justify-end print:hidden">
        <BotaoImprimir />
      </div>
      <Suspense fallback={<p className="text-center">Carregando…</p>}>
        <Documento params={params} />
      </Suspense>
    </div>
  );
}

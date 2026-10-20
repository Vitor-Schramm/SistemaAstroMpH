import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { data as fmtData } from "@/lib/format";
import { guiaPorId, linhasGuiaEnvio, obraDaGuia } from "@/lib/guias/dados";
import { n2, type LinhaGuia } from "@/lib/guias/tipos";
import { BotaoImprimir } from "../../oc/[id]/botao";
import { CabecalhoGuia, cel, celCab, hojeBr } from "../logo";

export const metadata: Metadata = { title: "Guia de Envio" };

// PDF "Guia de envio de documentos" do AstroTools (A4 paisagem): uma linha por nota, com os CCs juntos em "Apropriação".

async function Documento({ params }: { params: PageProps<"/imprimir/guia-envio/[id]">["params"] }) {
  await connection();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const guia = await guiaPorId(id);
  if (!guia || guia === "migracao") notFound();
  const [{ itens }, obra] = await Promise.all([linhasGuiaEnvio(guia), obraDaGuia(guia.obra_id)]);
  const notas = new Map<number, LinhaGuia & { ccs: string[] }>();
  for (const l of itens) {
    const n = notas.get(l.nota_id);
    if (n) {
      n.valor += l.valor;
      n.ccs.push(l.cc_codigo);
    } else notas.set(l.nota_id, { ...l, ccs: [l.cc_codigo] });
  }
  return (
    <article className="mx-auto max-w-[1120px] bg-white p-[14px] text-[10px] leading-tight text-[#212529] print:max-w-none print:p-0">
      <CabecalhoGuia titulo="Guia de envio de documentos" obra={guia.obra_nome} coordenador={obra?.coordenador} hoje={hojeBr()} />
      <div className="mb-[24px] text-right text-[22px]">
        <p className="mb-[14px]">Guia nº {guia.numero}</p>
        <p>Total: {n2(guia.valor)}</p>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["N. Pedido", "Descrição Pedido", "Dados Fornecedor", "Valor", "Tipo", "N.º Nota/Parcela", "Vencimento", "Forma Pagamento", "Apropriação"].map((t) => (
              <th key={t} className={celCab}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...notas.values()].map((n) => (
            <tr key={n.nota_id}>
              <td className={cel}>{n.pedido_cliente}</td>
              <td className={`${cel} w-[21%]`}>{n.pedido_nome}</td>
              <td className={`${cel} w-[23%]`}>
                {n.fornecedor_nome}
                {n.favorecido_cpf_cnpj && <div>CNPJ:{n.favorecido_cpf_cnpj}</div>}
                {n.favorecido && <div>Favorecido: {n.favorecido}</div>}
                {n.banco && <div>Banco: {n.banco}</div>}
                {n.agencia && <div>AG:{n.agencia}</div>}
                {n.conta && <div>CC:{n.conta}</div>}
              </td>
              <td className={cel}>{n2(n.valor)}</td>
              <td className={cel}>{n.tipo_documento}</td>
              <td className={cel}>{n.numero}</td>
              <td className={cel}>{fmtData(n.vencimento)}</td>
              <td className={`${cel} text-center`}>{n.tipo_pagamento}</td>
              <td className={cel}>{n.ccs.join("/")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

export default function GuiaEnvioPdfPage({ params }: PageProps<"/imprimir/guia-envio/[id]">) {
  return (
    <div className="min-h-screen bg-[#f3f2f7] p-6 print:bg-white print:p-0">
      <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>
      <div className="mx-auto mb-4 flex max-w-[1120px] justify-end print:hidden">
        <BotaoImprimir />
      </div>
      <Suspense fallback={<p className="text-center">Carregando…</p>}>
        <Documento params={params} />
      </Suspense>
    </div>
  );
}

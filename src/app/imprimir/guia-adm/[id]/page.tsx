import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { data as fmtData } from "@/lib/format";
import { calculoGuiaAdm, guiaPorId, guiasDaObra, obraDaGuia } from "@/lib/guias/dados";
import { n2, real } from "@/lib/guias/tipos";
import { BotaoImprimir } from "../../oc/[id]/botao";
import { CabecalhoGuia, cel, celCab, hojeBr } from "../../guia-envio/logo";

export const metadata: Metadata = { title: "Guia de Adm" };

// PDFs da Guia ADM do AstroTools: "PDF-Guia" (guia de envio de documentos da cobrança da MPH)
// e "PDF-Calculo" (?calculo=1, "Cálculo Administração de Obra").

// Conta de faturamento "MPH ENGENHARIA LTDA", como sai no PDF do original.
const MPH = { nome: "MPH ENGENHARIA LTDA", cnpj: "17.549.685/0001-22", banco: "Banco Itaú", agencia: "8462", conta: "08347-1" };
const pct = (v: number) => `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

async function Documento({ params, searchParams }: Pick<PageProps<"/imprimir/guia-adm/[id]">, "params" | "searchParams">) {
  await connection();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const calculo = (await searchParams).calculo === "1";
  const guia = await guiaPorId(id);
  if (!guia || guia === "migracao" || guia.tipo !== "adm") notFound();
  const [calc, todas, obra] = await Promise.all([calculoGuiaAdm(id), guiasDaObra(guia.obra_id), obraDaGuia(guia.obra_id)]);

  if (calculo) {
    const incluidas = (todas ?? []).filter((g) => g.guia_adm_id === id).sort((a, b) => b.numero - a.numero);
    const taxas = [...new Set(calc.map((c) => pct(c.taxa_adm).replace("%", " %")))].join(" / ");
    const varias = calc.length > 1;
    const linhas: [string, number][] = [
      ...incluidas.map((g): [string, number] => [`Guia de Envio ${g.numero}`, g.valor]),
      ...calc.flatMap((c): [string, number][] => [
        [varias ? `Administração - ${c.planilha_nome}` : "Administração", c.administracao],
        [varias ? `Imposto - ${c.planilha_nome}` : "Imposto", c.imposto],
      ]),
    ];
    return (
      <article className="mx-auto max-w-[1120px] bg-white p-[14px] text-[10px] leading-tight text-[#212529] print:max-w-none print:p-0">
        <CabecalhoGuia titulo="Cálculo Administração de Obra" />
        <p className="mb-[30px] text-right text-[22px]">Guia nº {guia.numero}</p>
        <table className="w-full border-separate border-spacing-y-[2px]">
          <thead>
            <tr>
              <th className={`${celCab} w-[15%] py-[5px]`}>Guia de Envio</th>
              <th className={`${celCab} py-[5px]`}>{taxas || "0 %"}</th>
              <th className={`${celCab} w-[12%] py-[5px]`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(([rotulo, valor]) => (
              <tr key={rotulo}>
                <td className={`${cel} bg-[#e7e6e6] py-[5px]`}>{rotulo}</td>
                <td className={`${cel} bg-[#e7e6e6] py-[5px]`}>{real(valor)}</td>
                <td className={`${cel} bg-[#e7e6e6] py-[5px]`}>{real(valor)}</td>
              </tr>
            ))}
            <tr>
              <td className={cel} />
              <td className={cel} />
              <td className={`${cel} py-[5px]`}>{real(guia.valor)}</td>
            </tr>
          </tbody>
        </table>
      </article>
    );
  }

  const linhas = calc.flatMap((c) => [
    { desc: `Administração de Obra - ${pct(c.taxa_adm)}`, valor: c.administracao, cc: c.cc_adm },
    { desc: "Impostos", valor: c.imposto, cc: c.cc_imp },
  ]);
  const n = linhas.length;
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
            {["N. Guia", "Descrição Pedido", "Dados Fornecedor", "Valor", "Tipo", "N.º Parcela", "Vencimento", "Forma Pagamento", "Apropriação"].map((t) => (
              <th key={t} className={celCab}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i}>
              {i === 0 && (
                <td rowSpan={n} className={`${cel} text-center align-middle`}>
                  {guia.numero}
                </td>
              )}
              <td className={cel}>{l.desc}</td>
              {i === 0 && (
                <td rowSpan={n} className={cel}>
                  {MPH.nome}
                  <div>CNPJ:{MPH.cnpj}</div>
                  <div>Banco: {MPH.banco}</div>
                  <div>AG:{MPH.agencia}</div>
                  <div>CC:{MPH.conta}</div>
                </td>
              )}
              <td className={`${cel} text-right`}>{n2(l.valor)}</td>
              {i === 0 && (
                <>
                  <td rowSpan={n} className={`${cel} align-middle`}>
                    {guia.tipo_documento}
                  </td>
                  <td rowSpan={n} className={`${cel} align-middle`}>
                    {guia.controle_parcela}
                  </td>
                  <td rowSpan={n} className={`${cel} align-middle`}>
                    {fmtData(guia.vencimento)}
                  </td>
                  <td rowSpan={n} className={`${cel} text-center align-middle`}>
                    {guia.tipo_pagamento}
                  </td>
                </>
              )}
              <td className={`${cel} text-center`}>{l.cc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

export default function GuiaAdmPdfPage({ params, searchParams }: PageProps<"/imprimir/guia-adm/[id]">) {
  return (
    <div className="min-h-screen bg-[#f3f2f7] p-6 print:bg-white print:p-0">
      <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>
      <div className="mx-auto mb-4 flex max-w-[1120px] justify-end print:hidden">
        <BotaoImprimir />
      </div>
      <Suspense fallback={<p className="text-center">Carregando…</p>}>
        <Documento params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

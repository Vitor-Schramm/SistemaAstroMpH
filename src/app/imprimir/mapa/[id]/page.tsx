import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { data as fmtData } from "@/lib/format";
import { apropriacoesPorItem, type MapaResumo } from "@/lib/mapas/dados";
import { BotaoImprimir } from "../../oc/[id]/botao";

export const metadata: Metadata = { title: "Mapa de Concorrência" };

// PDF "Mapa de Concorrência" do AstroTools (A4 paisagem), gerado pelo navegador ("Salvar como PDF").

const real = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.replace("R$ -", "R$-");
const CINZA = "bg-[#6b717d] text-white font-bold";
const CLARO = "bg-[#d5d6da]";
const cel = "border border-[#9a9ea6] px-[4px] py-[2px]";

type Forn = {
  fornecedor_id: number;
  frete: number;
  impostos: number;
  desconto: number;
  condicao_pagamento: string | null;
  prazo_entrega: string | null;
  observacao: string | null;
  fornecedor: { nome: string; nome_fantasia_mapa: string | null; cpf_cnpj: string; contato1_nome: string | null; contato1_fone: string | null; contato1_email: string | null } | null;
};

async function Documento({ params }: { params: PageProps<"/imprimir/mapa/[id]">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const supabase = await createClient();
  const [{ data: m }, { data: itensRaw }, { data: fornRaw }] = await Promise.all([
    supabase.from("mapas_resumo").select("*").eq("id", id).maybeSingle(),
    supabase.from("mapa_itens").select("*").eq("mapa_id", id).order("ordem"),
    supabase.from("mapa_fornecedores").select("*, fornecedor:fornecedores(nome, nome_fantasia_mapa, cpf_cnpj, contato1_nome, contato1_fone, contato1_email)").eq("mapa_id", id).order("id"),
  ]);
  if (!m) notFound();
  const mapa = m as MapaResumo;
  const itens = (itensRaw ?? []) as { id: number; e_titulo: boolean; descricao: string; quantidade: number; unidade: string }[];
  const forn = (fornRaw ?? []) as unknown as Forn[];
  const ids = itens.map((i) => i.id);
  const [aprops, { data: precosRaw }] = await Promise.all([
    apropriacoesPorItem("mapa_item", ids),
    ids.length ? supabase.from("mapa_precos").select("mapa_item_id, fornecedor_id, valor_unitario").in("mapa_item_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const preco = new Map(((precosRaw ?? []) as { mapa_item_id: number; fornecedor_id: number; valor_unitario: number }[]).map((p) => [`${p.mapa_item_id}-${p.fornecedor_id}`, Number(p.valor_unitario)]));
  const unit = (i: number, f: number) => preco.get(`${i}-${f}`) ?? 0;

  // Numeração "0.1, 0.2…" e títulos "1, 2…", como no original.
  const numerados = numerar(itens);
  const cotaveis = itens.filter((i) => !i.e_titulo);
  const subtotal = (f: number) => cotaveis.reduce((s, i) => s + Number(i.quantidade) * unit(i.id, f), 0);
  const total = (f: Forn) => subtotal(f.fornecedor_id) + Number(f.frete) + Number(f.impostos ?? 0) - Number(f.desconto ?? 0);
  const totaisValidos = forn.map(total).filter((t) => t > 0);
  const melhor = totaisValidos.length ? Math.min(...totaisValidos) : 0;
  const orcadoTotal = cotaveis.reduce((s, i) => s + (aprops.get(i.id) ?? []).reduce((x, a) => x + a.valor, 0), 0);
  const fase = mapa.obra_regime === "fechado" ? "Fase Fechada" : "Fase Administrada";
  const nomeF = (f: Forn) => (f.fornecedor?.nome_fantasia_mapa || f.fornecedor?.nome || "").slice(0, 20);
  const dataSol = mapa.solicitacao_em ?? mapa.criado_em;

  const linhaCab = (rotulo: string, valor: string, rotuloF: string, valorF: (f: Forn) => React.ReactNode) => (
    <tr>
      <td className={`${cel} ${CINZA} w-[11%]`}>{rotulo}</td>
      <td className={`${cel} ${CINZA}`} colSpan={2}>
        {valor}
      </td>
      <td className={`${cel} ${CINZA} w-[12%]`}>{rotuloF}</td>
      {forn.map((f) => (
        <td key={f.fornecedor_id} className={`${cel} ${CLARO} text-center`}>
          {valorF(f)}
        </td>
      ))}
    </tr>
  );

  return (
    <article className="mx-auto max-w-[1180px] border border-[#9a9ea6] bg-white p-[14px] text-[10.5px] leading-tight text-black print:max-w-none print:border-0 print:p-0">
      <header className="mb-[12px] flex items-center justify-between">
        <div className="rounded-[6px] bg-[#e5e5e5] px-[10px] py-[4px] text-[18px] tracking-tight">
          <span className="font-semibold text-[#1f3d7a]">MpH</span>
          <span className="mx-[2px] font-bold text-[#c00000]">|</span>
          <span className="text-[#555]">engenharia</span>
        </div>
        <h1 className="text-[22px] font-bold">Mapa de Concorrência</h1>
        <div className="text-[15px] font-bold">N° {mapa.numero_cliente ?? mapa.id}</div>
      </header>

      <table className="mb-[10px] w-full border-collapse">
        <tbody>
          {linhaCab("Obra:", mapa.obra_nome, "Fornec:", (f) => nomeF(f))}
          {linhaCab("Serviço:", mapa.servico, "Contato:", (f) => f.fornecedor?.contato1_nome ?? "")}
          {linhaCab("Apropriação:", mapa.apropriacao ?? "", "Telefone:", (f) => f.fornecedor?.contato1_fone ?? "")}
          {linhaCab("Data Solicitação", fmtData(dataSol), "CPF/CNPF:", (f) => f.fornecedor?.cpf_cnpj ?? "")}
          {linhaCab(fase, "", "E-mail:", (f) => <span className="text-[9px] text-[#1a0dab]">{f.fornecedor?.contato1_email ?? ""}</span>)}
        </tbody>
      </table>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${cel} ${CINZA} text-left`} rowSpan={2}>
              Item
            </th>
            <th className={`${cel} ${CINZA}`} rowSpan={2}>
              Descrição
            </th>
            <th className={`${cel} ${CINZA}`} colSpan={3}>
              ORÇADO
            </th>
            <th className={`${cel} ${CINZA}`} rowSpan={2}>
              Qtd
            </th>
            <th className={`${cel} ${CINZA}`} rowSpan={2}>
              Unid
            </th>
            {forn.map((f) => (
              <th key={f.fornecedor_id} className={`${cel} ${CINZA}`} colSpan={2} rowSpan={1}>
                {nomeF(f)}
              </th>
            ))}
          </tr>
          <tr>
            <th className={`${cel} ${CINZA} text-left`}>Aprop.</th>
            <th className={`${cel} ${CINZA}`}>Descrição</th>
            <th className={`${cel} ${CINZA} text-left`}>Orçado</th>
            {forn.map((f) => (
              <FragmentoCab key={f.fornecedor_id} />
            ))}
          </tr>
        </thead>
        <tbody>
          {numerados.map((i) => {
            const ap = aprops.get(i.id) ?? [];
            return (
              <tr key={i.id} className={i.e_titulo ? "font-bold" : undefined}>
                <td className={cel}>{i.numero}</td>
                <td className={cel}>{i.descricao}</td>
                <td className={`${cel} ${CLARO}`}>{ap.map((a) => a.cc_codigo).join(", ")}</td>
                <td className={`${cel} ${CLARO}`}>{ap.map((a) => a.cc_descricao).join(", ")}</td>
                <td className={`${cel} ${CLARO}`}>{ap.length ? real(ap.reduce((s, a) => s + a.valor, 0)) : ""}</td>
                <td className={cel}>{i.e_titulo ? "" : Number(i.quantidade).toFixed(2)}</td>
                <td className={cel}>{i.e_titulo ? "" : i.unidade}</td>
                {forn.map((f) => (
                  <FragmentoPreco key={f.fornecedor_id} titulo={i.e_titulo} unit={unit(i.id, f.fornecedor_id)} qtd={Number(i.quantidade)} />
                ))}
              </tr>
            );
          })}
          {(
            [
              ["Observações Gerais:", "Valor Total Orçado:", real(orcadoTotal), "Subtotal:", (f: Forn) => real(subtotal(f.fornecedor_id))],
              ["", "Saldo Remanescente:", real(orcadoTotal), "Frete:", (f: Forn) => real(Number(f.frete))],
              ["", "Melhor Cotação:", real(melhor), "Impostos:", (f: Forn) => real(Number(f.impostos ?? 0))],
              ["", "Saldo Total:", real(orcadoTotal - melhor), "Desconto:", (f: Forn) => real(Number(f.desconto ?? 0))],
              ["", "", "", "Total Individual:", (f: Forn) => real(total(f))],
              ["", "", "", "Cond Pagto:", (f: Forn) => f.condicao_pagamento ?? ""],
              ["", "", "", "Prazo Entrega:", (f: Forn) => f.prazo_entrega ?? ""],
              ["", "", "", "Observações:", (f: Forn) => f.observacao ?? ""],
            ] as [string, string, string, string, (f: Forn) => string][]
          ).map(([obs, rot, val, rotF, valF], k) => (
            <tr key={k}>
              {k === 0 && (
                <td className={`${cel} align-top`} colSpan={2} rowSpan={8}>
                  {obs}
                  <div className="mt-[4px] whitespace-pre-wrap">{mapa.observacao ?? ""}</div>
                </td>
              )}
              <td className={`${cel} ${rot ? CLARO : ""} text-right font-bold`} colSpan={2}>
                {rot}
              </td>
              <td className={`${cel} ${rot ? CLARO : ""} font-bold ${rot === "Saldo Total:" && orcadoTotal - melhor < 0 ? "text-[#ff0000]" : ""}`}>{val}</td>
              <td className={`${cel} text-right font-bold`} colSpan={2}>
                {rotF}
              </td>
              {forn.map((f) => (
                <td key={f.fornecedor_id} className={cel} colSpan={2}>
                  {valF(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function numerar<T extends { e_titulo: boolean }>(itens: T[]): (T & { numero: string })[] {
  const out: (T & { numero: string })[] = [];
  let titulo = 0;
  let sub = 0;
  for (const i of itens) {
    if (i.e_titulo) {
      titulo++;
      sub = 0;
      out.push({ ...i, numero: String(titulo) });
    } else {
      sub++;
      out.push({ ...i, numero: `${titulo}.${sub}` });
    }
  }
  return out;
}

function FragmentoCab() {
  return (
    <>
      <th className={`${cel} ${CINZA}`}>P.Unit</th>
      <th className={`${cel} ${CINZA}`}>P.Total</th>
    </>
  );
}

function FragmentoPreco({ titulo, unit, qtd }: { titulo: boolean; unit: number; qtd: number }) {
  if (titulo)
    return (
      <>
        <td className={cel} />
        <td className={cel} />
      </>
    );
  return (
    <>
      <td className={cel}>{real(unit)}</td>
      <td className={`${cel} font-bold`}>{real(unit * qtd)}</td>
    </>
  );
}

export default function MapaPdfPage({ params }: PageProps<"/imprimir/mapa/[id]">) {
  return (
    <div className="min-h-screen bg-[#f3f2f7] p-6 print:bg-white print:p-0">
      <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>
      <div className="mx-auto mb-4 flex max-w-[1180px] justify-end print:hidden">
        <BotaoImprimir />
      </div>
      <Suspense fallback={<p className="text-center">Carregando…</p>}>
        <Documento params={params} />
      </Suspense>
    </div>
  );
}

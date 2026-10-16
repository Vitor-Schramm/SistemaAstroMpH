import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { data as fmtData, moeda } from "@/lib/format";
import { numeroOC, STATUS_OC } from "@/lib/compras/tipos";
import { BotaoImprimir } from "./botao";

export const metadata: Metadata = { title: "Ordem de compra" };

type Item = { id: number; ordem: number; codigo: string | null; descricao: string; quantidade: number; unidade: string; valor_unitario: number };
type Aprov = { papel: string; aprovado: boolean; decidido_em: string; usuario: { nome: string } | null };

async function Documento({ params }: { params: PageProps<"/imprimir/oc/[id]">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const supabase = await createClient();
  const [{ data: oc }, { data: det }] = await Promise.all([
    supabase.from("ordens_compra_resumo").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("ordens_compra")
      .select("itens:oc_itens(*), aprovacoes:oc_aprovacoes(papel, aprovado, decidido_em, usuario:perfis(nome)), fornecedor:fornecedores(*)")
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!oc || !det) notFound();

  const itens = [...((det.itens ?? []) as Item[])].sort((a, b) => a.ordem - b.ordem);
  const f = det.fornecedor as unknown as Record<string, string | null>;
  const aprovacoes = (det.aprovacoes ?? []) as unknown as Aprov[];
  const subtotal = itens.reduce((s, i) => s + Number(i.quantidade) * Number(i.valor_unitario), 0);

  return (
    <article className="mx-auto max-w-4xl bg-white p-8 text-[13px] text-black print:p-0">
      <header className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <div className="text-lg font-bold">MPH Engenharia</div>
          <div className="text-xs">Ordem de compra</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold">{numeroOC(id)}</div>
          <div>Emissão: {fmtData(oc.data_emissao)}</div>
          <div>Situação: {STATUS_OC[oc.status]?.rotulo ?? oc.status}</div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6 border-b py-3">
        <div>
          <h2 className="mb-1 font-bold uppercase">Fornecedor</h2>
          <div>{f?.nome}</div>
          <div>CPF/CNPJ: {f?.cpf_cnpj}</div>
          {f?.endereco && (
            <div>
              {f.endereco}
              {f.numero ? `, ${f.numero}` : ""} {f.bairro ? `— ${f.bairro}` : ""} {f.cidade ? `— ${f.cidade}/${f.uf ?? ""}` : ""}
            </div>
          )}
          {f?.contato1_nome && (
            <div>
              Contato: {f.contato1_nome} {f.contato1_fone} {f.contato1_email}
            </div>
          )}
        </div>
        <div>
          <h2 className="mb-1 font-bold uppercase">Obra</h2>
          <div>
            {oc.obra_codigo} — {oc.obra_nome}
          </div>
          {oc.cliente_nome && <div>Cliente: {oc.cliente_nome}</div>}
          {oc.engenheiro_responsavel && <div>Eng. responsável: {oc.engenheiro_responsavel}</div>}
          {oc.data_entrega && <div>Entrega: {fmtData(oc.data_entrega)}</div>}
        </div>
      </section>

      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">Código</th>
            <th className="py-1 pr-2">Descrição</th>
            <th className="py-1 pr-2 text-right">Qtde</th>
            <th className="py-1 pr-2">Unid.</th>
            <th className="py-1 pr-2 text-right">Vl. unit.</th>
            <th className="py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((i, n) => (
            <tr key={i.id} className="border-b border-gray-300">
              <td className="py-1 pr-2">{n + 1}</td>
              <td className="py-1 pr-2">{i.codigo}</td>
              <td className="py-1 pr-2">{i.descricao}</td>
              <td className="py-1 pr-2 text-right">{String(i.quantidade).replace(".", ",")}</td>
              <td className="py-1 pr-2">{i.unidade}</td>
              <td className="py-1 pr-2 text-right">{moeda(Number(i.valor_unitario))}</td>
              <td className="py-1 text-right">{moeda(Number(i.quantidade) * Number(i.valor_unitario))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} className="pt-2 text-right">
              Subtotal
            </td>
            <td className="pt-2 text-right">{moeda(subtotal)}</td>
          </tr>
          <tr>
            <td colSpan={6} className="text-right">
              Frete
            </td>
            <td className="text-right">{moeda(Number(oc.frete))}</td>
          </tr>
          <tr className="font-bold">
            <td colSpan={6} className="text-right">
              Total
            </td>
            <td className="text-right">{moeda(Number(oc.valor_total))}</td>
          </tr>
        </tfoot>
      </table>

      <section className="mt-4 grid grid-cols-2 gap-6">
        <div>
          <div>
            <b>Condição de pagamento:</b> {oc.condicao_pagamento ?? "—"}
          </div>
          <div>
            <b>Prazo de entrega:</b> {oc.prazo_entrega ?? "—"}
          </div>
          {oc.observacao && (
            <div className="mt-2 whitespace-pre-wrap">
              <b>Observação:</b> {oc.observacao}
            </div>
          )}
        </div>
        <div>
          <b>Dados bancários do fornecedor</b>
          <div>
            {f?.banco ? `Banco ${f.banco} · Ag. ${f.agencia ?? "—"} · Conta ${f.conta ?? "—"}` : "—"}
          </div>
          {f?.banco_favorecido && <div>Favorecido: {f.banco_favorecido}</div>}
        </div>
      </section>

      <section className="mt-8 grid grid-cols-2 gap-10">
        {(["engenharia", "financeiro"] as const).map((p) => {
          const a = aprovacoes.find((x) => x.papel === p);
          return (
            <div key={p} className="border-t border-black pt-1 text-center">
              <div className="font-bold capitalize">{p}</div>
              <div className="text-xs">
                {a ? `${a.aprovado ? "Aprovado" : "Reprovado"} por ${a.usuario?.nome ?? "—"} em ${fmtData(a.decidido_em)}` : "Pendente"}
              </div>
            </div>
          );
        })}
      </section>
    </article>
  );
}

export default function ImprimirOcPage({ params }: PageProps<"/imprimir/oc/[id]">) {
  return (
    <main className="min-h-svh bg-muted py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-4xl justify-end print:hidden">
        <BotaoImprimir />
      </div>
      <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Carregando…</p>}>
        <Documento params={params} />
      </Suspense>
    </main>
  );
}

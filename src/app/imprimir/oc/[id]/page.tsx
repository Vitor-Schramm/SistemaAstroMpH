import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoMphHorizontal } from "@/components/marca/logo-mph";
import { BotaoImprimir } from "./botao";

export const metadata: Metadata = { title: "Ordem de Compra" };

// PDF "gerar-pdf-ordem-compra" do AstroTools (A4 retrato, borda na página): logo e dados da MpH no topo,
// faixas cinza "Dados P/ Faturamento", "Dados Cobrança", "Dados Fornecedor", itens, "Condições de Fornecimento"
// com os totais, "Local de Entrega (Obra)", "Observações Importantes" e a assinatura de quem emitiu a OC.

type Item = { id: number; ordem: number; e_titulo: boolean; descricao: string; quantidade: number; unidade: string; valor_unitario: number; valor_impostos: number | null };
type Registro = Record<string, string | number | null>;

const CINZA = "bg-[#e7e6e6]";
const n2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rs = (v: number) => `R$ ${n2(v)}`;
const dataBr = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");
const t = (v: unknown) => (v == null ? "" : String(v));
const junta = (...partes: unknown[]) => partes.map(t).filter(Boolean).join(" ");

const PERFIS: Record<string, string> = { admin: "Administrador", financeiro: "Financeiro", engenharia: "Engenheiro", suprimentos: "Suprimentos", usuario: "Usuário" };

// Dados de cobrança fixos da MpH, como aparecem no PDF do original.
const MPH = {
  razao: "MpH Engenharia Ltda",
  cnpj: "17.549.685/0001-22",
  endereco: "Alameda Lorena, 800 - 3º Andar - Cj.309 - Jd.Paulista",
  cep: "01424-004 - São Paulo- SP",
  fone: "11 4561-4734",
  contato: "Gisele Franco",
  email: "gisele@mphengenharia.com.br",
};

function Faixa({ titulo, id, data }: { titulo: string; id?: string | number; data?: string }) {
  return (
    <div className={`${CINZA} mt-[14px] grid grid-cols-[1fr_1fr_1fr] px-[3px] py-[3px] font-bold`}>
      <span>{titulo}</span>
      <span>{id != null && id !== "" ? `ID: ${id}` : ""}</span>
      <span className="text-right">{data ? <>Data: <span className="ml-[20px] font-normal">{data}</span></> : ""}</span>
    </div>
  );
}

/** Linha de campos "Rótulo: valor"; `l` é a largura (%) de cada par. */
function Linha({ campos }: { campos: [rotulo: string, valor: unknown, l: number][] }) {
  return (
    <div className="flex px-[3px] pt-[6px]">
      {campos.map(([r, v, l]) => (
        <div key={r} className="flex gap-[6px]" style={{ width: `${l}%` }}>
          <b className="shrink-0">{r}</b>
          <span className="break-words">{t(v)}</span>
        </div>
      ))}
    </div>
  );
}

async function Documento({ params }: { params: PageProps<"/imprimir/oc/[id]">["params"] }) {
  await connection();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const supabase = await createClient();
  const [{ data: oc }, { data: res }, { data: itensDb }, { data: aprops }] = await Promise.all([
    supabase
      .from("ordens_compra")
      .select("*, fornecedor:fornecedores(*), obra:obras(id, nome, cliente:clientes!obras_cliente_id_fkey(*)), filial:clientes!filial_cliente_id(*), emissor:perfis!criado_por(nome, papel)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("ocs_resumo").select("valor_total").eq("id", id).maybeSingle(),
    supabase.from("oc_itens").select("id, ordem, e_titulo, descricao, quantidade, unidade, valor_unitario, valor_impostos").eq("ordem_compra_id", id).order("ordem"),
    supabase.from("apropriacoes").select("cc:centros_custo(codigo)").eq("origem", "oc").eq("origem_id", id).order("id"),
  ]);
  if (!oc) notFound();

  const f = (oc.fornecedor ?? {}) as Registro;
  const obra = (oc.obra ?? {}) as { id?: number; nome?: string; cliente?: Registro | null };
  const c = ((oc.filial as Registro | null) ?? obra.cliente ?? {}) as Registro;
  const emissor = oc.emissor as { nome: string; papel: string } | null;
  const itens = (itensDb ?? []) as Item[];
  const normais = itens.filter((i) => !i.e_titulo);
  const subtotal = normais.reduce((s, i) => s + Number(i.quantidade) * Number(i.valor_unitario), 0);
  const impostos = normais.reduce((s, i) => s + Number(i.valor_impostos ?? 0), 0);
  const frete = Number(oc.frete ?? 0);
  const desconto = Number(oc.desconto ?? 0);
  const total = res ? Number(res.valor_total) : subtotal + impostos + frete - desconto;
  const apropriacao = [...new Set(((aprops ?? []) as unknown as { cc: { codigo: string } | null }[]).map((a) => a.cc?.codigo).filter(Boolean))].join(", ");
  const data = dataBr(oc.data_emissao);
  const e = (k: string, alt: string) => t(oc[k as keyof typeof oc]) || t(c[alt]);
  let numero = 0;

  return (
    <article className="mx-auto min-h-[1123px] max-w-[794px] border border-black bg-white px-[6px] py-[10px] font-[Helvetica,Arial,sans-serif] text-[12px] leading-[1.15] text-[#212529] print:min-h-0 print:max-w-none">
      <header className="relative h-[186px]">
        <LogoMphHorizontal className="absolute top-[34px] left-[40px] h-[46px] w-auto" />
        <p className="absolute top-[88px] right-[100px] text-[14.5px] font-bold">Ordem N°.{oc.numero_cliente ?? id}</p>
        <div className="absolute top-[106px] right-0 left-0 text-center text-[10px] leading-[1.5]">
          <p>{MPH.razao}</p>
          <p>CNPJ: {MPH.cnpj}</p>
          <p>{MPH.endereco}</p>
          <p>CEP: {MPH.cep}</p>
          <p>Fone: {MPH.fone}</p>
        </div>
      </header>

      <div>
        <Faixa titulo="Dados P/ Faturamento" id={obra.id} data={data} />
        <Linha campos={[["Cliente:", c.razao_social || c.nome, 34], ["Nome Obra:", obra.nome, 66]]} />
        <Linha campos={[["Endereço:", c.endereco, 34], ["Complemento:", junta(c.numero && `Nº ${c.numero}`, c.complemento), 20], ["Bairro:", c.bairro, 46]]} />
        <Linha campos={[["Cidade:", c.cidade, 24], ["UF:", c.uf, 34], ["CEP:", c.cep, 42]]} />
        <Linha campos={[["CNPJ/CPF:", c.cnpj, 24], ["I.EST./RG:", c.ie, 76]]} />
        <Linha campos={[["Fone:", c.telefone || c.celular, 24], ["Contato:", c.responsavel, 24], ["E-mail:", c.email, 52]]} />

        <Faixa titulo="Dados Cobrança" />
        <Linha campos={[["Endereço:", "Alameda Lorena, 800", 28], ["Bairro:", "Jd.Paulista", 45], ["Complemento:", "3º Andar - Cj.309", 27]]} />
        <Linha campos={[["Cidade:", "São Paulo", 28], ["UF:", "SP", 21], ["CEP:", "01424-004", 51]]} />
        <Linha campos={[["Fone:", MPH.fone, 20], ["Contato:", MPH.contato, 22], ["E-mail:", MPH.email, 58]]} />

        <Faixa titulo="Dados Fornecedor" id={oc.fornecedor_id} data={data} />
        <Linha campos={[["Fornecedor:", f.nome_fantasia || f.nome, 36], ["Nome:", f.nome, 64]]} />
        <Linha campos={[["Endereço:", f.endereco, 36], ["Complemento:", junta(f.numero, f.complemento), 44], ["Bairro:", f.bairro, 20]]} />
        <Linha campos={[["Cidade:", f.cidade, 27], ["UF:", f.uf, 30], ["CEP:", f.cep, 43]]} />
        <Linha campos={[["CNPJ/CPF:", f.cpf_cnpj, 27], ["I.EST./RG:", f.inscricao_estadual, 73]]} />
        <Linha campos={[["Fone:", f.contato1_fone, 27], ["Contato:", f.contato1_nome, 21], ["E-mail:", f.contato1_email, 52]]} />

        <table className="mt-[14px] w-full border-collapse">
          <thead>
            <tr className={`${CINZA} text-left [&_th]:px-[3px] [&_th]:py-[3px] [&_th]:font-bold`}>
              <th className="w-[4%]">Item</th>
              <th>Descrição</th>
              <th className="w-[5%]">Qtde.</th>
              <th className="w-[5%]">Unid.</th>
              <th className="w-[8.5%]">Vl.Unitário</th>
              <th className="w-[7.5%]">Vl. Total</th>
              <th className="w-[7.5%]">Impostos</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) =>
              i.e_titulo ? (
                <tr key={i.id}>
                  <td colSpan={7} className="px-[3px] pt-[6px] font-bold">
                    {i.descricao}
                  </td>
                </tr>
              ) : (
                <tr key={i.id} className="align-top [&_td]:px-[3px] [&_td]:pt-[6px]">
                  <td>{++numero}</td>
                  <td>{i.descricao}</td>
                  <td>{n2(Number(i.quantidade))}</td>
                  <td>{i.unidade}</td>
                  <td>{n2(Number(i.valor_unitario))}</td>
                  <td>{n2(Number(i.quantidade) * Number(i.valor_unitario))}</td>
                  <td>{n2(Number(i.valor_impostos ?? 0))}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>

        <div className={`${CINZA} mt-[14px] px-[3px] py-[3px] font-bold`}>Observações</div>
        {oc.observacao && <p className="px-[3px] pt-[6px] whitespace-pre-wrap">{oc.observacao}</p>}

        <div className="mt-[10px] grid grid-cols-[55%_45%]">
          <div>
            <div className={`${CINZA} mr-[2px] px-[3px] py-[3px] font-bold`}>Condições de Fornecimento</div>
            <Linha campos={[["Forma de Pagamento:", oc.condicao_pagamento, 100]]} />
            <Linha campos={[["Prazo de Entrega:", oc.prazo_entrega, 100]]} />
            <Linha campos={[["Apropriação:", apropriacao, 100]]} />
            <Linha campos={[["Dados Pagamento:", ` Banco:${t(f.banco) || " -"} Agencia:${t(f.agencia) || " -"} Conta:${t(f.conta)}`, 100]]} />
          </div>
          <table className="w-full border-collapse self-start">
            <tbody className="[&_td]:px-[3px] [&_td]:py-[2.5px] [&_th]:px-[3px] [&_th]:py-[2.5px]">
              {(
                [
                  ["Subtotal", rs(subtotal), true],
                  ["Imposto", impostos ? rs(impostos) : "Incluso", false],
                  ["Descontos", rs(desconto), false],
                  ["Fretes", rs(frete), false],
                  ["Valor Total", rs(total), true],
                ] as const
              ).map(([r, v, negrito]) => (
                <tr key={r} className="border-b-[2px] border-white">
                  <th className={`${CINZA} w-[38%] text-left font-normal`}>{r}</th>
                  <td className={negrito ? "font-bold" : ""}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={`${CINZA} mt-[12px] px-[3px] py-[3px] font-bold`}>Local de Entrega (Obra)</div>
        <Linha
          campos={[
            ["Endereço:", junta(e("entrega_endereco", "endereco_entrega"), e("entrega_numero", "numero_entrega") && `, ${e("entrega_numero", "numero_entrega")}`).replace(" ,", ","), 39],
            ["Bairro:", e("entrega_bairro", "bairro_entrega"), 39],
            ["Complemento:", e("entrega_complemento", "complemento_entrega"), 22],
          ]}
        />
        <Linha campos={[["Cidade:", e("entrega_cidade", "cidade_entrega"), 39], ["UF:", e("entrega_uf", "uf_entrega"), 20], ["CEP:", e("entrega_cep", "cep_entrega"), 41]]} />
        <Linha campos={[["Fone Responsável:", oc.entrega_telefone, 20], ["Contato Responsável:", oc.entrega_responsavel, 80]]} />
        <Linha campos={[["Fone Mestre:", e("entrega_telefone_mestre", "telefone_mestre"), 20], ["Contato Mestre:", e("entrega_contato_mestre", "contato_mestre"), 80]]} />

        <div className={`${CINZA} mt-[18px] px-[3px] py-[3px] font-bold`}>Observações Importantes</div>
        <ol className="px-[3px] pt-[6px] leading-[1.6]">
          <li>1. A MpH Engenharia Ltda não se responsabiliza pelo extravio ou não recebimento do boleto, desta forma se isenta de multa, juros e custas de Cartório</li>
          <li>2. Materiais entregues fora das Normas da ABNT, danificados ou diferente das características apresentadas acima citadas</li>
          <li>3. A MpH Engenharia Ltda não autoriza desconto de Títulos em Instituições Financeiras (Bancos ou Factoring) em nenhuma hipótese</li>
          <li>4. Os materiais e serviços serão inspecionados de acordo com as especificações e caso sejam reprovados serão devolvidos ou descontados do total contratado</li>
          <li>5. Esta OC formaliza a aprovação da Concorrência n° concedia p/Cliente onde estão inclusos todos os Impostos e Despesas c/Equipe</li>
        </ol>

        <div className="mt-[44px] text-center text-[14.5px] leading-[1.5] break-inside-avoid">
          <p>__________________________________________________</p>
          <p>{emissor?.nome?.toUpperCase() ?? ""}</p>
          <p className="text-[14px]">{emissor ? (PERFIS[emissor.papel] ?? emissor.papel) : ""}</p>
        </div>
      </div>
    </article>
  );
}

export default function ImprimirOcPage({ params }: PageProps<"/imprimir/oc/[id]">) {
  return (
    <main className="min-h-svh bg-[#f3f2f7] py-6 print:bg-white print:py-0">
      <style>{"@page { size: A4 portrait; margin: 5mm; }"}</style>
      <div className="mx-auto mb-4 flex max-w-[794px] justify-end print:hidden">
        <BotaoImprimir />
      </div>
      <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Carregando…</p>}>
        <Documento params={params} />
      </Suspense>
    </main>
  );
}

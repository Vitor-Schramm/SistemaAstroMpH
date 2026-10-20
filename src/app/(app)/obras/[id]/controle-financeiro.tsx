"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Cartao } from "@/components/astro/basicos";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { cn } from "@/lib/utils";
import { data as fmtData } from "@/lib/format";
import { salvarAlocacao } from "@/lib/obras/actions";
import { compararCodigo, numeroBr, type CentroCusto, type PagamentoCliente, type Percentual, type Planilha, type Responsavel } from "@/lib/obras/tipos";
import {
  AdicionarCc,
  CadernoNotas,
  DetalheCc,
  EditarPlanilha,
  Filiais,
  ImportarPlanilha,
  ModalVazio,
  PagamentosCliente,
  Percentuais,
  Responsaveis,
  UploadArquivos,
} from "./dialogos";

// "Controle Financeiro" (obras/view) do AstroTools.

export type ObraDados = {
  id: number;
  codigo: string;
  nome: string;
  regime: string;
  ativo: boolean;
  ano: number | null;
  tipo_obra: string | null;
  metragem: number | null;
  inicio: string | null;
  termino: string | null;
  entrega_prevista: string | null;
  validade_seguro: string | null;
  ultimo_envio_relatorio: string | null;
  as_built_em?: string | null;
  status_complementar: string | null;
  diretor: string | null;
  coordenador: string | null;
  engenheiro: string | null;
  arquitetura: string | null;
  gerenciadora: string | null;
  orcamentista: string | null;
  suprimento: string | null;
};

type Opcao = { valor: string; rotulo: string };

const REGIME_ROTULO: Record<string, string> = { administracao: "Administração", fechado: "Fechado", completo: "Completo" };
const NIVEIS_TITULO = ["T0", "T0-I", "T1"];
const NIVEIS_ADM = ["ADM0", "ADM", "I0", "I"];

const n2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const reais = (v: number) => `R$ ${n2(v)}`;

// Cores medidas no original.
const COR = {
  alocadoCab: "bg-[#28c76f]",
  alocado: "bg-[#c2ffc3] dark:bg-[#1f5130]",
  valPagoCab: "bg-[#fbaa66]",
  valPago: "bg-[#fdc89c] dark:bg-[#5c3f22]",
  tituloFechado: "bg-[#adaaaa] dark:bg-[#4d4b4b]",
  tituloAdm: "bg-[#95b3d7] dark:bg-[#34506f]",
};

type Valores = { an: number; orc: number; fech: number; aloc: number; pago: number; aPagar: number; meta: number };
const zero = (): Valores => ({ an: 0, orc: 0, fech: 0, aloc: 0, pago: 0, aPagar: 0, meta: 0 });

/** Valores de uma linha. Na planilha administrada, Val Pago inclui o pago via guia. */
function valoresCc(c: CentroCusto, guia: boolean): Valores {
  const pago = Number(c.val_pago) + (guia ? Number(c.pago_guia) : 0);
  const fech = Number(c.fechamento);
  return { an: Number(c.an_financeira), orc: Number(c.orcamento), fech, aloc: Number(c.verba_alocada), pago, aPagar: fech - pago, meta: Number(c.orcamento) - fech };
}
function somar(lista: Valores[]): Valores {
  const t = zero();
  for (const v of lista) for (const k of Object.keys(t) as (keyof Valores)[]) t[k] += v[k];
  return t;
}

function Destaque({ valor }: { valor: string | null }) {
  return valor ? <>{valor}</> : <mark className="bg-[#ffff00] px-0 text-inherit">Pendente</mark>;
}

function Info({ obra, planilha }: { obra: ObraDados; planilha: Planilha }) {
  const verba = planilha.modo === "verba";
  const linha = "mb-[0.15rem]";
  return (
    <div className="grid gap-x-[2rem] px-[1rem] pb-[1.5rem] text-[1.07rem] font-medium text-heading md:grid-cols-3">
      <div>
        <p className={linha}>Ano: {obra.ano ?? ""}</p>
        <p className={linha}>Tipo de Obra: {obra.tipo_obra ?? ""}</p>
        <p className={linha}>Metragem: {obra.metragem != null ? n2(Number(obra.metragem)) : ""}</p>
        <p className={linha}>Regime: {REGIME_ROTULO[obra.regime] ?? obra.regime}</p>
        <p className={linha}>Status: {obra.ativo ? "Ativo" : "Inativo"}</p>
        <p className={linha}>Início da Obra: {fmtData(obra.inicio)}</p>
        <p className={linha}>Término da Obra: {fmtData(obra.termino)}</p>
        <p className={linha}>Entrega / Previsão da Obra: {fmtData(obra.entrega_prevista)}</p>
      </div>
      <div>
        <p className={linha}>
          Ultimo Envio Relatório: <Destaque valor={obra.ultimo_envio_relatorio ? fmtData(obra.ultimo_envio_relatorio) : null} />
        </p>
        <p className={linha}>
          Validade Seguro: <Destaque valor={obra.validade_seguro ? fmtData(obra.validade_seguro) : null} />
        </p>
        <p className={linha}>Verba Alocada: {verba ? reais(Number(planilha.verba_alocada)) : "Não se Aplica"}</p>
        <p className={linha}>Falta Alocar: {verba ? reais(Number(planilha.verba_alocada) - Number(planilha.alocado_ccs)) : "Não se Aplica"}</p>
        <p className={linha}>As Built: {fmtData(obra.as_built_em ?? null)}</p>
        <p className={linha}>Status Complementar: {obra.status_complementar ?? ""}</p>
      </div>
      <div>
        <p className={linha}>Diretor: {obra.diretor ?? ""}</p>
        <p className={linha}>Coordenador: {obra.coordenador ?? ""}</p>
        <p className={linha}>Engenheiro: {obra.engenheiro ?? ""}</p>
        <p className={linha}>Arquitetura: {obra.arquitetura ?? ""}</p>
        <p className={linha}>Gerenciadora: {obra.gerenciadora ?? ""}</p>
        <p className={linha}>Orçamentista: {obra.orcamentista ?? ""}</p>
        <p className={linha}>Suprimento: {obra.suprimento ?? ""}</p>
      </div>
    </div>
  );
}

const th = "px-[1.5rem] py-[0.72rem] text-left align-top text-[0.857rem] font-bold tracking-[0.5px] text-[#22292f] uppercase dark:text-heading";
const td = "px-[1.5rem] py-[0.72rem] align-middle";

function TabelaPlanilha({
  obraId,
  planilha,
  ccs,
  podeAlocar,
  podeEstrutura,
  onAdicionar,
  onDetalhar,
}: {
  obraId: number;
  planilha: Planilha;
  ccs: CentroCusto[];
  podeAlocar: boolean;
  podeEstrutura: boolean;
  onAdicionar: (pai: CentroCusto) => void;
  onDetalhar: (cc: CentroCusto) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const verba = planilha.modo === "verba";
  const guia = !verba;
  const folhas = ccs.filter((c) => !NIVEIS_TITULO.includes(c.nivel));
  const [alocado, setAlocado] = useState<Record<number, string>>(() => Object.fromEntries(folhas.map((c) => [c.id, n2(Number(c.verba_alocada))])));

  const valorLinha = (c: CentroCusto): Valores => {
    const v = valoresCc(c, guia);
    if (podeAlocar && verba) v.aloc = numeroBr(alocado[c.id] ?? "0") || 0;
    return v;
  };
  const totalT0 = (t0: CentroCusto) => somar(folhas.filter((f) => f.codigo.startsWith(`${t0.codigo}.`)).map(valorLinha));
  const total = somar(folhas.map(valorLinha));

  const atualizar = () => {
    const lista = folhas.map((c) => ({ cc_id: c.id, valor: numeroBr(alocado[c.id] || "0") }));
    if (lista.some((a) => Number.isNaN(a.valor))) return void toast.error("Valor inválido.");
    startTransition(async () => {
      const r = await salvarAlocacao(obraId, planilha.id, lista);
      if (!r.ok) return void toast.error(r.erro);
      toast.success("Alocação atualizada.");
      router.refresh();
    });
  };

  const celulas = (v: Valores) => (
    <>
      <td className={td}>{n2(v.an)}</td>
      <td className={td}>{n2(v.orc)}</td>
      <td className={td}>{n2(v.fech)}</td>
      {verba && <td className={cn(td, COR.alocado)}>{n2(v.aloc)}</td>}
      <td className={cn(td, COR.valPago)}>{n2(v.pago)}</td>
      <td className={td}>{n2(v.aPagar)}</td>
      <td className={td}>{n2(v.meta)}</td>
    </>
  );

  return (
    <div className="overflow-x-auto px-[1rem]">
      <table className="w-full text-[1rem]">
        <thead className="bg-muted">
          <tr>
            <th className={th}>Item</th>
            <th className={th}>Serviço</th>
            <th className={th}>An. Financeira</th>
            <th className={th}>Orçamento</th>
            <th className={th}>Fechamento</th>
            {verba && <th className={cn(th, COR.alocadoCab)}>Alocado</th>}
            <th className={cn(th, COR.valPagoCab)}>Val Pago</th>
            <th className={th}>A Pagar</th>
            <th className={th}>Meta</th>
          </tr>
        </thead>
        <tbody>
          {ccs.map((c) => {
            if (c.nivel === "T0" || c.nivel === "T0-I") {
              return (
                <tr key={c.id} className={cn("border-b border-border font-semibold", verba ? COR.tituloFechado : COR.tituloAdm)}>
                  <td className={cn(td, "whitespace-nowrap")}>
                    {c.codigo}
                    {podeEstrutura && (
                      <button type="button" onClick={() => onAdicionar(c)} className="ml-[0.4rem] align-middle text-[#1fa28f]" title="Adicionar">
                        <Plus className="inline size-[14px]" />
                      </button>
                    )}
                  </td>
                  <td className={td}>{c.descricao}</td>
                  {celulas(totalT0(c))}
                </tr>
              );
            }
            if (c.nivel === "T1") {
              return (
                <tr key={c.id} className="border-b border-border font-semibold">
                  <td className={td}>{c.codigo}</td>
                  <td className={td}>{c.descricao}</td>
                  <td className={td} />
                  <td className={td} />
                  <td className={td} />
                  {verba && <td className={cn(td, COR.alocado)} />}
                  <td className={cn(td, COR.valPago)} />
                  <td className={td} />
                  <td className={td} />
                </tr>
              );
            }
            const v = valorLinha(c);
            return (
              <tr key={c.id} className="border-b border-border">
                <td className={cn(td, "whitespace-nowrap")}>
                  {c.codigo}
                  <button type="button" onClick={() => onDetalhar(c)} className="ml-[0.4rem] align-middle text-primary" title="Detalhar">
                    <Search className="inline size-[14px]" />
                  </button>
                </td>
                <td className={td}>{c.descricao}</td>
                <td className={td}>{n2(v.an)}</td>
                <td className={td}>{n2(v.orc)}</td>
                <td className={td}>{n2(v.fech)}</td>
                {verba && (
                  <td className={cn(td, COR.alocado)}>
                    {podeAlocar ? (
                      <input
                        aria-label={`Alocado ${c.codigo}`}
                        value={alocado[c.id] ?? ""}
                        onChange={(e) => setAlocado({ ...alocado, [c.id]: e.target.value })}
                        className="w-[7.5rem] bg-transparent outline-none focus:border-b focus:border-primary"
                      />
                    ) : (
                      n2(v.aloc)
                    )}
                  </td>
                )}
                <td className={cn(td, COR.valPago)}>{n2(v.pago)}</td>
                <td className={td}>{n2(v.aPagar)}</td>
                <td className={td}>{n2(v.meta)}</td>
              </tr>
            );
          })}
          {ccs.length === 0 && (
            <tr>
              <td colSpan={verba ? 9 : 8} className={cn(td, "text-center")}>
                Nenhum registro encontrado
              </td>
            </tr>
          )}
          <tr className={cn("font-semibold", COR.tituloFechado)}>
            <td className={td} />
            <td className={cn(td, "text-center")}>Totais</td>
            <td className={td}>{n2(total.an)}</td>
            <td className={td}>{n2(total.orc)}</td>
            <td className={td}>{n2(total.fech)}</td>
            {verba && <td className={td}>{n2(total.aloc)}</td>}
            <td className={td}>{n2(total.pago)}</td>
            <td className={td}>{n2(total.aPagar)}</td>
            <td className={td}>{n2(total.meta)}</td>
          </tr>
          {verba && (
            <tr>
              <td className={cn(td, "py-[0.5rem]")} colSpan={5}>
                {podeAlocar && (
                  <Button onClick={atualizar} disabled={pending}>
                    {pending ? "Atualizando…" : "Atualizar"}
                  </Button>
                )}
              </td>
              <td colSpan={2} className={cn(td, "text-center font-medium", COR.tituloFechado)} title="Alocado − Val Pago">
                {n2(total.aloc - total.pago)}
              </td>
              <td colSpan={2} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

type Modal =
  | { tipo: "pagamentos" }
  | { tipo: "filiais" }
  | { tipo: "responsaveis" }
  | { tipo: "percentuais" }
  | { tipo: "importar" }
  | { tipo: "caderno" }
  | { tipo: "relatorio" }
  | { tipo: "contrato" }
  | { tipo: "alertas" }
  | { tipo: "semana" }
  | { tipo: "editar"; planilha: Planilha }
  | { tipo: "addcc"; planilha: Planilha; pai: CentroCusto }
  | { tipo: "detalhe"; cc: CentroCusto };

const TITULOS: Record<Modal["tipo"], string> = {
  pagamentos: "Pagamentos Cliente",
  filiais: "Filiais",
  responsaveis: "Responsaveis",
  percentuais: "Percentuais Obra",
  importar: "Importar Planilha",
  caderno: "Caderno de Notas",
  relatorio: "Relatório de Obras",
  contrato: "Contratos da Obra",
  alertas: "Alertas de Pagamento",
  semana: "Pagamentos da Semana",
  editar: "Editar Planilha",
  addcc: "Adicionar Centro de Custo",
  detalhe: "Detalhamento Lançamentos Efetuados",
};

export function ControleFinanceiro({
  obra,
  planilhas,
  ccs,
  pagamentos,
  percentuais,
  responsaveis,
  filiais,
  perfis,
  clientes,
  podeEstrutura,
  podeFinanceiro,
  ehAdmin,
}: {
  obra: ObraDados;
  planilhas: Planilha[];
  ccs: CentroCusto[];
  pagamentos: PagamentoCliente[];
  percentuais: Percentual[];
  responsaveis: Responsavel[];
  filiais: { id: number; nome: string }[];
  perfis: Opcao[];
  clientes: Opcao[];
  podeEstrutura: boolean;
  podeFinanceiro: boolean;
  ehAdmin: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal | null>(null);
  const fechar = () => setModal(null);
  const ativas = planilhas.filter((p) => p.ativo);

  const ccsPlanilha = useMemo(() => {
    const m = new Map<number, CentroCusto[]>();
    for (const c of ccs) if (!NIVEIS_ADM.includes(c.nivel)) m.set(c.planilha_id, [...(m.get(c.planilha_id) ?? []), c]);
    return m;
  }, [ccs]);
  const resumoAdm = ccs.filter((c) => c.nivel === "ADM" || c.nivel === "I").sort((a, b) => compararCodigo(a.codigo, b.codigo));

  const totalPlanilha = (p: Planilha) => {
    const guia = p.modo === "guia";
    const v = somar((ccsPlanilha.get(p.id) ?? []).filter((c) => !NIVEIS_TITULO.includes(c.nivel)).map((c) => valoresCc(c, guia)));
    // Valor total ("TOT") informado nos percentuais substitui An. Financeira, Orçamento e Fechamento, como no original.
    const tot = percentuais.filter((x) => x.planilha_id === p.id && x.tipo === "tot").reduce((s, x) => s + Number(x.valor), 0);
    return tot ? { ...v, an: tot, orc: tot, fech: tot } : v;
  };
  const totaisGerais = ativas.map((p) => ({ p, v: totalPlanilha(p) }));
  const geral = somar(totaisGerais.map((t) => t.v));

  const exportarExcel = () => {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const linhas = ativas.flatMap((p) => [
      `<tr><td colspan="10"><b>${esc(p.nome)}</b></td></tr>`,
      ...(ccsPlanilha.get(p.id) ?? []).map((c) => {
        const v = valoresCc(c, p.modo === "guia");
        const t = NIVEIS_TITULO.includes(c.nivel);
        return `<tr${t ? ' style="font-weight:bold"' : ""}><td>${esc(c.codigo)}</td><td>${esc(c.descricao)}</td>${(t ? ["", "", "", "", "", "", "", ""] : [v.an, v.orc, v.fech, v.aloc, Number(c.val_pago), Number(c.pago_guia), v.aPagar, v.meta].map(n2))
          .map((x) => `<td>${x}</td>`)
          .join("")}</tr>`;
      }),
    ]);
    const html = `<table border="1"><thead><tr><th>Item</th><th>Serviço</th><th>An. Financeira</th><th>Orçamento</th><th>Fechamento</th><th>Alocado</th><th>Val Pago</th><th>Pago Guia</th><th>A Pagar</th><th>Meta</th></tr></thead><tbody>${linhas.join("")}</tbody></table>`;
    const url = URL.createObjectURL(new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: "controle_financeiro.xls" }).click();
    URL.revokeObjectURL(url);
  };

  const emBreve = (o: string) => toast.info(`${o}: disponível quando notas e pagamentos forem migrados para o novo modelo.`);

  return (
    <>
      <CabecalhoPagina titulo="Controle Financeiro" migalhas={[{ titulo: "Obras", href: "/obras" }, { titulo: "Controle Financeiro" }]} />

      <Cartao className="pb-[1.5rem]">
        <div className="flex justify-end gap-[0.3rem] px-[1rem] pt-[1rem]">
          <Button variant="outline" onClick={exportarExcel}>
            Excel
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex size-[38px] items-center justify-center rounded-[0.358rem] bg-primary text-white" aria-label="Opções">
              <LayoutGrid className="size-[14px]" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[13rem]">
              <DropdownMenuItem onClick={() => setModal({ tipo: "pagamentos" })}>Pagamentos Cliente</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setModal({ tipo: "filiais" })}>Filiais</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setModal({ tipo: "alertas" })}>Alertas Pagamentos</DropdownMenuItem>
              <DropdownMenuItem onClick={() => emBreve("Pagamentos")}>Pagamentos</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setModal({ tipo: "semana" })}>Pagamentos da Semana</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/guias-envio/obra/${obra.id}`)}>Guias Envio</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/guias-adm/obra/${obra.id}`)}>Guias Adm</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setModal({ tipo: "relatorio" })}>Relatório de Obra</DropdownMenuItem>
              <DropdownMenuItem onClick={() => emBreve("Controle Contratos")}>Controle Contratos</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setModal({ tipo: "caderno" })}>Caderno de Notas</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setModal({ tipo: "contrato" })}>Upload Contrato da Obra</DropdownMenuItem>
              {(podeEstrutura || ehAdmin) && <DropdownMenuSeparator />}
              {ehAdmin && <DropdownMenuItem onClick={() => setModal({ tipo: "responsaveis" })}>Responsáveis</DropdownMenuItem>}
              {podeEstrutura && <DropdownMenuItem onClick={() => setModal({ tipo: "percentuais" })}>Percentuais</DropdownMenuItem>}
              {podeEstrutura && <DropdownMenuItem onClick={() => setModal({ tipo: "importar" })}>Importar Planilha</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => router.push("/obras")}>
            Voltar
          </Button>
        </div>

        {ativas.length === 0 && (
          <div className="px-[1rem] py-[3rem] text-center">
            <h1 className="mb-[0.5rem] text-[2.6rem] font-semibold uppercase">{obra.nome}</h1>
            <p>Nenhuma planilha importada para esta obra.{podeEstrutura && " Use Opções → Importar Planilha."}</p>
          </div>
        )}

        {ativas.map((p) => {
          const pcts = percentuais.filter((x) => x.planilha_id === p.id);
          const taxa = (t: "adm" | "imp") => pcts.filter((x) => x.tipo === t).reduce((s, x) => s + Number(x.valor), 0);
          return (
            <Fragment key={p.id}>
              <div className="px-[1rem] pt-[1.5rem] pb-[1.5rem] text-center">
                <h1 className="mb-[1rem] text-[2.6rem] leading-tight font-semibold uppercase">{p.nome}</h1>
                {pcts.some((x) => x.tipo !== "tot") && (
                  <p className="mb-[0.5rem] text-[1rem] font-medium text-heading">
                    Taxa ADM: {n2(taxa("adm"))}&nbsp;&nbsp;Taxa IMP: {n2(taxa("imp"))}
                  </p>
                )}
                {podeEstrutura ? (
                  <button type="button" className="text-[1.07rem] font-medium text-heading" onClick={() => setModal({ tipo: "editar", planilha: p })}>
                    Editar
                  </button>
                ) : (
                  <span className="text-[1.07rem] font-medium text-heading">Editar</span>
                )}
              </div>
              <Info obra={obra} planilha={p} />
              <TabelaPlanilha
                key={`${p.id}-${(ccsPlanilha.get(p.id) ?? []).map((c) => c.verba_alocada).join(",")}`}
                obraId={obra.id}
                planilha={p}
                ccs={ccsPlanilha.get(p.id) ?? []}
                podeAlocar={podeFinanceiro}
                podeEstrutura={podeEstrutura}
                onAdicionar={(pai) => setModal({ tipo: "addcc", planilha: p, pai })}
                onDetalhar={(cc) => setModal({ tipo: "detalhe", cc })}
              />
            </Fragment>
          );
        })}

        {ativas.length > 0 && (
          <>
            <h4 className="mt-[3rem] mb-[1.5rem] text-center text-[1.285rem] font-medium">Total Geral</h4>
            <div className="overflow-x-auto px-[1rem]">
              <table className="w-full text-[1rem]">
                <thead className="bg-muted">
                  <tr>
                    <th className={th}>Planilha</th>
                    <th className={th}>An. Financeira</th>
                    <th className={th}>Orçamento</th>
                    <th className={th}>Fechamento</th>
                    <th className={cn(th, COR.valPagoCab, "text-white")}>Val Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {totaisGerais.map(({ p, v }) => (
                    <tr key={p.id} className="border-b border-border">
                      <td className={cn(td, "uppercase")}>{p.nome}</td>
                      <td className={td}>{n2(v.an)}</td>
                      <td className={td}>{n2(v.orc)}</td>
                      <td className={td}>{n2(v.fech)}</td>
                      <td className={td}>{n2(v.pago)}</td>
                    </tr>
                  ))}
                  <tr className={cn("font-semibold", COR.tituloFechado)}>
                    <td className={td}>Total</td>
                    <td className={td}>{n2(geral.an)}</td>
                    <td className={td}>{n2(geral.orc)}</td>
                    <td className={td}>{n2(geral.fech)}</td>
                    <td className={td}>{n2(geral.pago)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        {resumoAdm.length > 0 && (
          <>
            <h4 className="mt-[1.5rem] mb-[1.5rem] text-center text-[1.285rem] font-medium">Resumo Administração</h4>
            <div className="overflow-x-auto px-[1rem]">
              <table className="w-full text-[1rem]">
                <thead className="bg-muted">
                  <tr>
                    <th className={th}>Item</th>
                    <th className={th}>Serviço</th>
                    <th className={th}>Orçamento</th>
                    <th className={th}>Fechamento</th>
                    <th className={cn(th, COR.valPagoCab, "text-white")}>Val Pago</th>
                    <th className={th}>A Pagar</th>
                    <th className={th}>Meta</th>
                  </tr>
                </thead>
                <tbody>
                  {resumoAdm.map((c) => {
                    const v = valoresCc(c, true);
                    return (
                      <tr key={c.id} className={cn("border-b border-white font-semibold", COR.tituloAdm)}>
                        <td className={td}>{c.codigo}</td>
                        <td className={td}>{c.descricao}</td>
                        <td className={td}>{n2(v.orc)}</td>
                        <td className={td}>{n2(v.fech)}</td>
                        <td className={td}>{n2(v.pago)}</td>
                        <td className={td}>{n2(v.aPagar)}</td>
                        <td className={td}>{n2(v.meta)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Cartao>

      <Dialog open={modal !== null} onOpenChange={(o) => !o && fechar()}>
        <DialogContent className={cn(modal && ["pagamentos", "semana", "importar", "responsaveis", "percentuais", "editar"].includes(modal.tipo) ? "sm:max-w-5xl" : "sm:max-w-2xl")}>
          {modal && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[1.285rem] font-medium text-heading">{TITULOS[modal.tipo]}</DialogTitle>
              </DialogHeader>
              {modal.tipo === "pagamentos" && <PagamentosCliente obraId={obra.id} planilhas={planilhas} pagamentos={pagamentos} podeLancar={podeFinanceiro} onFechar={fechar} />}
              {modal.tipo === "filiais" && <Filiais obraId={obra.id} filiais={filiais} clientes={clientes} podeEditar={podeEstrutura} onFechar={fechar} />}
              {modal.tipo === "responsaveis" && <Responsaveis obraId={obra.id} responsaveis={responsaveis} perfis={perfis} podeEditar={ehAdmin} onFechar={fechar} />}
              {modal.tipo === "percentuais" && <Percentuais obraId={obra.id} planilhas={planilhas} percentuais={percentuais} podeEditar={podeEstrutura} onFechar={fechar} />}
              {modal.tipo === "importar" && <ImportarPlanilha obraId={obra.id} regime={obra.regime} onFechar={fechar} />}
              {modal.tipo === "caderno" && <CadernoNotas onFechar={fechar} />}
              {modal.tipo === "relatorio" && <UploadArquivos rotulo="Arquivos:" colunas={["Arquivo", "Data Envio", ""]} onFechar={fechar} />}
              {modal.tipo === "contrato" && <UploadArquivos colunas={["Arquivo", "Data", ""]} onFechar={fechar} />}
              {modal.tipo === "alertas" && <ModalVazio colunas={["Nota", "Serie", "CC", "Descricao", "Valor Lançamento"]} />}
              {modal.tipo === "semana" && <ModalVazio colunas={["Nota", "Serie", "Data Pagamento", "Usuário", "Obra", "Pedido", "Fornecedor", "Valor", "CC"]} rodape="Total: 0,00" />}
              {modal.tipo === "editar" && <EditarPlanilha obra={obra} planilha={modal.planilha} onFechar={fechar} />}
              {modal.tipo === "addcc" && <AdicionarCc obraId={obra.id} planilhaId={modal.planilha.id} pai={modal.pai} onFechar={fechar} />}
              {modal.tipo === "detalhe" && <DetalheCc cc={modal.cc} />}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

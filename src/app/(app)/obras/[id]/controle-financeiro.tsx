"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Coins, FileUp, Landmark, MoreHorizontal, Pencil, Percent, Plus, Trash2, Users, Building } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { data as fmtData, moeda } from "@/lib/format";
import { REGIMES, STATUS_OBRA } from "@/lib/cadastros/config";
import { excluirCc, excluirPlanilha, salvarAlocacao } from "@/lib/obras/actions";
import {
  MODOS,
  NIVEIS_FOLHA,
  numeroBr,
  somarFolhas,
  valoresArvore,
  type CentroCusto,
  type ColunaValor,
  type PagamentoCliente,
  type Percentual,
  type Planilha,
  type Responsavel,
  type Totais,
} from "@/lib/obras/tipos";
import { EditarPlanilha, Filiais, FormCc, ImportarPlanilha, PagamentosCliente, Percentuais, Responsaveis } from "./dialogos";

export type ObraCabecalho = {
  id: number;
  codigo: string;
  nome: string;
  cliente: string | null;
  regime: string;
  status: string;
  diretor: string | null;
  coordenador: string | null;
  engenheiro: string | null;
  arquitetura: string | null;
  gerenciadora: string | null;
  orcamentista: string | null;
  suprimento: string | null;
  inicio: string | null;
  termino: string | null;
  possui_seguro: boolean;
  validade_seguro: string | null;
  ultimo_envio_relatorio: string | null;
};

type Opcao = { valor: string; rotulo: string };

const COLUNAS: { chave: ColunaValor; rotulo: string; dica: string }[] = [
  { chave: "an_financeira", rotulo: "An. Financeira", dica: "Valor da análise financeira (custo previsto)" },
  { chave: "orcamento", rotulo: "Orçamento", dica: "Valor orçado para o cliente" },
  { chave: "fechamento", rotulo: "Fechamento", dica: "Σ apropriado em OCs e reembolsos" },
  { chave: "verba_alocada", rotulo: "Alocado", dica: "Verba do cliente alocada no CC (obra fechada)" },
  { chave: "val_pago", rotulo: "Val Pago", dica: "Σ notas pagas rateadas no CC" },
  { chave: "pago_guia", rotulo: "Pago Guia", dica: "Σ pago pelo cliente via guias de envio" },
  { chave: "a_pagar", rotulo: "A Pagar", dica: "Fechamento − Val Pago" },
  { chave: "meta", rotulo: "Meta", dica: "Orçamento − Fechamento" },
];

const recuo: Record<string, string> = { T0: "", "T0-I": "", ADM0: "", I0: "", T1: "pl-4", CC: "pl-8", ADM: "pl-8", I: "pl-8" };

type Modal =
  | { tipo: "importar" }
  | { tipo: "editar"; planilha: Planilha }
  | { tipo: "cc"; planilha: Planilha; cc: CentroCusto | null }
  | { tipo: "pagamentos"; planilha: number | null }
  | { tipo: "percentuais"; planilha: Planilha }
  | { tipo: "responsaveis" }
  | { tipo: "filiais" };

function Info({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      <div className="truncate text-sm font-medium">{valor || "—"}</div>
    </div>
  );
}

function Indicador({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: "ok" | "erro" }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      <div className={cn("font-semibold tabular-nums", destaque === "erro" && "text-destructive", destaque === "ok" && "text-emerald-700 dark:text-emerald-400")}>{moeda(valor)}</div>
    </div>
  );
}

function TabelaPlanilha({
  planilha,
  ccs,
  podeEstrutura,
  podeAlocar,
  onEditarCc,
  obraId,
}: {
  planilha: Planilha;
  ccs: CentroCusto[];
  podeEstrutura: boolean;
  podeAlocar: boolean;
  onEditarCc: (cc: CentroCusto) => void;
  obraId: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [alocando, setAlocando] = useState<Record<number, string> | null>(null);
  const valores = useMemo(() => valoresArvore(ccs), [ccs]);
  const total = useMemo(() => somarFolhas(ccs), [ccs]);
  const fechado = planilha.modo === "verba";

  const alocadoEditado = alocando
    ? ccs.filter((c) => NIVEIS_FOLHA.includes(c.nivel)).reduce((s, c) => s + (numeroBr(alocando[c.id] ?? "0") || 0), 0)
    : Number(planilha.alocado_ccs);
  const faltaAlocar = Number(planilha.verba_alocada) - alocadoEditado;

  const salvar = () => {
    if (!alocando) return;
    const lista = Object.entries(alocando).map(([id, v]) => ({ cc_id: Number(id), valor: numeroBr(v || "0") }));
    if (lista.some((a) => Number.isNaN(a.valor))) return void toast.error("Valor inválido.");
    startTransition(async () => {
      const r = await salvarAlocacao(obraId, planilha.id, lista);
      if (!r.ok) return void toast.error(r.erro);
      toast.success("Verba alocada.");
      setAlocando(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      {fechado && (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="grid grid-cols-3 gap-2">
            <Indicador rotulo="Verba alocada (pagamentos)" valor={Number(planilha.verba_alocada)} />
            <Indicador rotulo="Alocado nos CCs" valor={alocadoEditado} />
            <Indicador rotulo="Falta alocar" valor={faltaAlocar} destaque={faltaAlocar < -0.005 ? "erro" : undefined} />
          </div>
          {podeAlocar &&
            ccs.length > 0 &&
            (alocando ? (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setAlocando(null)} disabled={pending}>
                  Cancelar
                </Button>
                <Button onClick={salvar} disabled={pending || faltaAlocar < -0.005}>
                  {pending ? "Salvando…" : "Salvar alocação"}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setAlocando(Object.fromEntries(ccs.filter((c) => NIVEIS_FOLHA.includes(c.nivel)).map((c) => [c.id, String(Number(c.verba_alocada) || "")])))}
              >
                <Coins /> Alocar verba
              </Button>
            ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[64rem] text-sm">
          <thead className="bg-muted text-xs">
            <tr>
              <th className="p-2 text-left">Código</th>
              <th className="p-2 text-left">Descrição</th>
              {COLUNAS.map((c) => (
                <th key={c.chave} className="p-2 text-right whitespace-nowrap" title={c.dica}>
                  {c.rotulo}
                </th>
              ))}
              {podeEstrutura && <th className="w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {ccs.length === 0 && (
              <tr>
                <td colSpan={COLUNAS.length + 3} className="p-6 text-center text-muted-foreground">
                  Planilha sem centros de custo.
                </td>
              </tr>
            )}
            {ccs.map((c) => {
              const folha = NIVEIS_FOLHA.includes(c.nivel);
              const v = valores.get(c.id) as Totais;
              return (
                <tr key={c.id} className={cn(!folha && "bg-muted/40 font-semibold", c.nivel === "T0" && "bg-muted/70")}>
                  <td className={cn("p-2 whitespace-nowrap tabular-nums", recuo[c.nivel])}>{c.codigo}</td>
                  <td className="max-w-80 truncate p-2" title={c.descricao}>
                    {c.descricao}
                  </td>
                  {COLUNAS.map((col) =>
                    col.chave === "verba_alocada" && alocando && folha ? (
                      <td key={col.chave} className="p-1">
                        <Input
                          inputMode="decimal"
                          aria-label={`Alocado em ${c.codigo}`}
                          value={alocando[c.id] ?? ""}
                          onChange={(e) => setAlocando({ ...alocando, [c.id]: e.target.value })}
                          className="h-7 w-28 text-right tabular-nums"
                        />
                      </td>
                    ) : (
                      <td
                        key={col.chave}
                        className={cn(
                          "p-2 text-right whitespace-nowrap tabular-nums",
                          (col.chave === "meta" || col.chave === "a_pagar") && v[col.chave] < -0.005 && "text-destructive",
                          col.chave === "verba_alocada" && !fechado && "text-muted-foreground",
                        )}
                      >
                        {col.chave === "verba_alocada" && !fechado ? "—" : moeda(v[col.chave])}
                      </td>
                    ),
                  )}
                  {podeEstrutura && (
                    <td className="p-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7" aria-label={`Ações do CC ${c.codigo}`} />}>
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEditarCc(c)}>
                            <Pencil /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => {
                              if (!confirm(`Excluir o CC ${c.codigo}?`)) return;
                              startTransition(async () => {
                                const r = await excluirCc(obraId, c.id);
                                if (!r.ok) return void toast.error(r.erro);
                                toast.success("CC excluído.");
                                router.refresh();
                              });
                            }}
                          >
                            <Trash2 /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          {ccs.length > 0 && (
            <tfoot className="border-t-2 bg-muted/60 font-semibold">
              <tr>
                <td className="p-2" colSpan={2}>
                  Total da planilha
                </td>
                {COLUNAS.map((col) => (
                  <td key={col.chave} className="p-2 text-right whitespace-nowrap tabular-nums">
                    {col.chave === "verba_alocada" && !fechado ? "—" : moeda(total[col.chave])}
                  </td>
                ))}
                {podeEstrutura && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export function ControleFinanceiro({
  voltar,
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
  voltar: React.ReactNode;
  obra: ObraCabecalho;
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
  const [fechadas, setFechadas] = useState<Set<number>>(new Set());
  const [soAtivas, setSoAtivas] = useState(true);
  const [, startTransition] = useTransition();
  const fechar = () => setModal(null);

  const visiveis = planilhas.filter((p) => !soAtivas || p.ativo);
  const ccsDe = (id: number) => ccs.filter((c) => c.planilha_id === id);
  const totalGeral = somarFolhas(ccs.filter((c) => visiveis.some((p) => p.id === c.planilha_id)));
  const verbaTotal = visiveis.filter((p) => p.modo === "verba").reduce((s, p) => s + Number(p.verba_alocada), 0);
  const alocadoTotal = visiveis.filter((p) => p.modo === "verba").reduce((s, p) => s + Number(p.alocado_ccs), 0);
  const rotulo = (lista: Opcao[], v: string) => lista.find((o) => o.valor === v)?.rotulo ?? v;
  const resp = (tipo: Responsavel["tipo"]) =>
    responsaveis
      .filter((r) => r.tipo === tipo)
      .map((r) => r.perfil?.nome)
      .join(", ");

  const alternar = (id: number) =>
    setFechadas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const titulos: Record<Modal["tipo"], [string, string]> = {
    importar: ["Importar planilha de orçamento", "Cria uma planilha nova com a árvore de centros de custo."],
    editar: ["Editar planilha", "Nome, modo e situação da planilha."],
    cc: ["Centro de custo", "Linhas de título (T0/T1) mostram a soma dos centros de custo abaixo delas."],
    pagamentos: ["Pagamentos do cliente", "Valores pagos pelo cliente à MPH, por planilha."],
    percentuais: ["Percentuais da planilha", "Taxa de administração e impostos cobrados sobre a planilha."],
    responsaveis: ["Responsáveis da obra", "Engenheiro (com limite de aprovação de OC), coordenador e suprimentos."],
    filiais: ["Filiais", "Outros clientes ligados a esta obra."],
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {voltar}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {obra.codigo} — {obra.nome}
            </h1>
            <p className="text-sm text-muted-foreground">
              Controle financeiro · {obra.cliente ?? "Sem cliente"} · {rotulo(REGIMES, obra.regime)} · {rotulo(STATUS_OBRA, obra.status)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setModal({ tipo: "pagamentos", planilha: null })}>
            <Landmark /> Pagamentos do cliente
          </Button>
          <Button variant="outline" onClick={() => setModal({ tipo: "responsaveis" })}>
            <Users /> Responsáveis
          </Button>
          <Button variant="outline" onClick={() => setModal({ tipo: "filiais" })}>
            <Building /> Filiais
          </Button>
          {podeEstrutura && (
            <Button onClick={() => setModal({ tipo: "importar" })}>
              <FileUp /> Importar planilha
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-3 rounded-md border p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Info rotulo="Diretor" valor={obra.diretor} />
        <Info rotulo="Coordenador" valor={resp("coordenador") || obra.coordenador} />
        <Info rotulo="Engenheiro" valor={resp("engenheiro") || obra.engenheiro} />
        <Info rotulo="Suprimento" valor={resp("suprimentos") || obra.suprimento} />
        <Info rotulo="Arquitetura" valor={obra.arquitetura} />
        <Info rotulo="Gerenciadora" valor={obra.gerenciadora} />
        <Info rotulo="Orçamentista" valor={obra.orcamentista} />
        <Info rotulo="Início" valor={fmtData(obra.inicio)} />
        <Info rotulo="Término" valor={fmtData(obra.termino)} />
        <Info rotulo="Seguro" valor={obra.possui_seguro ? `Sim${obra.validade_seguro ? ` · até ${fmtData(obra.validade_seguro)}` : ""}` : "Não"} />
        <Info rotulo="Último relatório" valor={fmtData(obra.ultimo_envio_relatorio)} />
        <Info rotulo="Filiais" valor={filiais.map((f) => f.nome).join(", ")} />
      </div>

      <div className="space-y-2 rounded-md border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Totalizador da obra</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={soAtivas} onChange={(e) => setSoAtivas(e.target.checked)} className="size-4 accent-primary" />
            Só planilhas ativas
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {COLUNAS.map((c) => (
            <Indicador key={c.chave} rotulo={c.rotulo} valor={totalGeral[c.chave]} destaque={(c.chave === "meta" || c.chave === "a_pagar") && totalGeral[c.chave] < -0.005 ? "erro" : undefined} />
          ))}
        </div>
        {visiveis.some((p) => p.modo === "verba") && (
          <div className="grid grid-cols-3 gap-2 sm:max-w-xl">
            <Indicador rotulo="Verba alocada" valor={verbaTotal} />
            <Indicador rotulo="Alocado nos CCs" valor={alocadoTotal} />
            <Indicador rotulo="Falta alocar" valor={verbaTotal - alocadoTotal} destaque={verbaTotal - alocadoTotal < -0.005 ? "erro" : undefined} />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Fechamento, Val Pago e Pago Guia passam a ser alimentados quando as OCs, notas e guias forem apropriadas nos centros de custo (próximas fases).
        </p>
      </div>

      {visiveis.length === 0 && (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nenhuma planilha de orçamento. {podeEstrutura ? "Use “Importar planilha” para criar a primeira." : ""}
        </div>
      )}

      {visiveis.map((p) => {
        const aberta = !fechadas.has(p.id);
        const lista = ccsDe(p.id);
        const pcts = percentuais.filter((x) => x.planilha_id === p.id);
        return (
          <section key={p.id} className={cn("space-y-3 rounded-md border p-4", !p.ativo && "opacity-70")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => alternar(p.id)} className="flex items-center gap-2 text-left">
                {aberta ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                <span className="font-semibold">
                  {p.seq}. {p.nome}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    p.modo === "verba" ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" : "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300",
                  )}
                >
                  {MODOS[p.modo]}
                </span>
                {!p.ativo && <span className="text-xs text-muted-foreground">(inativa)</span>}
                {pcts.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    · Adm {Number(p.taxa_adm).toLocaleString("pt-BR")}% · Imp {Number(p.taxa_imp).toLocaleString("pt-BR")}%
                  </span>
                )}
              </button>
              <div className="flex flex-wrap gap-2">
                {podeEstrutura && (
                  <Button size="sm" variant="outline" onClick={() => setModal({ tipo: "cc", planilha: p, cc: null })}>
                    <Plus /> Adicionar CC
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setModal({ tipo: "pagamentos", planilha: p.id })}>
                  <Landmark /> Pagamentos
                </Button>
                <Button size="sm" variant="outline" onClick={() => setModal({ tipo: "percentuais", planilha: p })}>
                  <Percent /> Percentuais
                </Button>
                {podeEstrutura && (
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button size="icon" variant="ghost" className="size-8" aria-label="Ações da planilha" />}>
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setModal({ tipo: "editar", planilha: p })}>
                        <Pencil /> Editar planilha
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          if (!confirm(`Excluir a planilha "${p.nome}" e todos os seus centros de custo?`)) return;
                          startTransition(async () => {
                            const r = await excluirPlanilha(obra.id, p.id);
                            if (!r.ok) return void toast.error(r.erro);
                            toast.success("Planilha excluída.");
                            router.refresh();
                          });
                        }}
                      >
                        <Trash2 /> Excluir planilha
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
            {aberta && (
              <TabelaPlanilha
                planilha={p}
                ccs={lista}
                obraId={obra.id}
                podeEstrutura={podeEstrutura}
                podeAlocar={podeFinanceiro && p.modo === "verba"}
                onEditarCc={(cc) => setModal({ tipo: "cc", planilha: p, cc })}
              />
            )}
          </section>
        );
      })}

      <Dialog open={modal !== null} onOpenChange={(o) => !o && fechar()}>
        <DialogContent className={cn(modal && ["pagamentos", "importar"].includes(modal.tipo) ? "sm:max-w-4xl" : "sm:max-w-2xl")}>
          {modal && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {titulos[modal.tipo][0]}
                  {(modal.tipo === "percentuais" || modal.tipo === "editar") && ` — ${modal.planilha.nome}`}
                </DialogTitle>
                <DialogDescription>{titulos[modal.tipo][1]}</DialogDescription>
              </DialogHeader>
              {modal.tipo === "importar" && <ImportarPlanilha obraId={obra.id} regime={obra.regime} onFechar={fechar} />}
              {modal.tipo === "editar" && <EditarPlanilha obraId={obra.id} planilha={modal.planilha} onFechar={fechar} />}
              {modal.tipo === "cc" && <FormCc key={modal.cc?.id ?? "novo"} obraId={obra.id} planilhaId={modal.planilha.id} cc={modal.cc} onFechar={fechar} />}
              {modal.tipo === "pagamentos" && (
                <PagamentosCliente obraId={obra.id} planilhas={planilhas} pagamentos={pagamentos} planilhaInicial={modal.planilha} podeLancar={podeFinanceiro} />
              )}
              {modal.tipo === "percentuais" && <Percentuais obraId={obra.id} planilha={modal.planilha} percentuais={percentuais} podeEditar={podeEstrutura} />}
              {modal.tipo === "responsaveis" && <Responsaveis obraId={obra.id} responsaveis={responsaveis} perfis={perfis} podeEditar={ehAdmin} />}
              {modal.tipo === "filiais" && <Filiais obraId={obra.id} filiais={filiais} clientes={clientes} podeEditar={podeEstrutura} />}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

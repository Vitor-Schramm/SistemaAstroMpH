"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { selectClass } from "@/components/cadastros/registro-form";
import { cn } from "@/lib/utils";
import { data as fmtData, moeda } from "@/lib/format";
import {
  adicionarFilial,
  adicionarPercentual,
  adicionarResponsavel,
  editarPlanilha,
  excluirPagamentoCliente,
  excluirPercentual,
  importarPlanilha,
  removerFilial,
  removerResponsavel,
  salvarCc,
  salvarPagamentoCliente,
  type Resultado,
} from "@/lib/obras/actions";
import {
  lerPlanilhaTexto,
  MODOS,
  nivelPorCodigo,
  NIVEIS,
  numeroBr,
  ROTULO_NIVEL,
  TIPOS_RESPONSAVEL,
  type CentroCusto,
  type ModoPlanilha,
  type Nivel,
  type PagamentoCliente,
  type Percentual,
  type Planilha,
  type Responsavel,
} from "@/lib/obras/tipos";

type Opcao = { valor: string; rotulo: string };

const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

function useAcao() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const rodar = (fn: () => Promise<Resultado>, ok: string, depois?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.erro);
      toast.success(ok);
      depois?.();
      router.refresh();
    });
  return { pending, rodar };
}

function Campo({ id, rotulo, obrigatorio, children, className }: { id: string; rotulo: string; obrigatorio?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>
        {rotulo}
        {obrigatorio && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- Importar planilha

export function ImportarPlanilha({ obraId, regime, onFechar }: { obraId: number; regime: string; onFechar: () => void }) {
  const [nome, setNome] = useState("");
  const [modo, setModo] = useState<ModoPlanilha>(regime === "administracao" ? "guia" : "verba");
  const [texto, setTexto] = useState("");
  const { pending, rodar } = useAcao();
  const { linhas, erros } = texto.trim() ? lerPlanilhaTexto(texto) : { linhas: [], erros: [] };

  async function lerArquivo(f: File) {
    const buf = await f.arrayBuffer();
    // CSV exportado pelo Excel costuma vir em Windows-1252; tenta UTF-8 primeiro.
    let t = new TextDecoder("utf-8").decode(buf);
    if (t.includes("�")) t = new TextDecoder("windows-1252").decode(buf);
    setTexto(t);
    if (!nome) setNome(f.name.replace(/\.[^.]+$/, ""));
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="pl-nome" rotulo="Nome da planilha" obrigatorio>
          <Input id="pl-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: FASE CINZA, EQUIPE TÉCNICA, ADICIONAIS 01" />
        </Campo>
        <Campo id="pl-modo" rotulo="Modo">
          <select id="pl-modo" value={modo} onChange={(e) => setModo(e.target.value as ModoPlanilha)} className={selectClass}>
            {Object.entries(MODOS).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </Campo>
        <div className="grid gap-1.5 sm:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="pl-texto">Linhas da planilha</Label>
            <label className="inline-flex cursor-pointer items-center gap-1 text-sm text-primary hover:underline">
              <FileUp className="size-4" /> Abrir CSV
              <input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && lerArquivo(e.target.files[0])} />
            </label>
          </div>
          <Textarea
            id="pl-texto"
            rows={10}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="font-mono text-xs"
            placeholder={"Copie do Excel e cole aqui (ou abra um CSV).\nColunas: Código | Descrição | An. Financeira | Orçamento | Nível (opcional)\n01\tFUNDAÇÃO\t0\t0\n01.01\tESTACAS\t0\t0\n01.01.01\tMÃO DE OBRA\t12000\t13500"}
          />
          <span className="text-xs text-muted-foreground">
            O nível sai do código (01 = item, 01.01 = sub-item, 01.01.01 = centro de custo) ou da 5ª coluna: {NIVEIS.join(", ")}.
          </span>
        </div>
      </div>
      {texto.trim() && (
        <div className="space-y-1 rounded-md border p-3 text-sm">
          <div>
            <b>{linhas.length}</b> linhas válidas · {linhas.filter((l) => (l.nivel ?? nivelPorCodigo(l.codigo)) === "CC").length} centros de custo · Orçamento{" "}
            {moeda(linhas.reduce((s, l) => s + ((l.nivel ?? nivelPorCodigo(l.codigo)) === "CC" ? l.orcamento : 0), 0))}
          </div>
          {erros.slice(0, 6).map((e) => (
            <div key={e} className="text-amber-700 dark:text-amber-400">
              {e}
            </div>
          ))}
          {erros.length > 6 && <div className="text-muted-foreground">… e mais {erros.length - 6} avisos.</div>}
        </div>
      )}
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
        <Button disabled={pending || !linhas.length} onClick={() => rodar(() => importarPlanilha(obraId, nome, modo, linhas), "Planilha importada.", onFechar)}>
          {pending ? "Importando…" : `Importar ${linhas.length} linhas`}
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------- Editar planilha

export function EditarPlanilha({ obraId, planilha, onFechar }: { obraId: number; planilha: Planilha; onFechar: () => void }) {
  const [nome, setNome] = useState(planilha.nome);
  const [modo, setModo] = useState(planilha.modo);
  const [ativo, setAtivo] = useState(planilha.ativo);
  const { pending, rodar } = useAcao();
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="ep-nome" rotulo="Nome" obrigatorio>
          <Input id="ep-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <Campo id="ep-modo" rotulo="Modo">
          <select id="ep-modo" value={modo} onChange={(e) => setModo(e.target.value as ModoPlanilha)} className={selectClass}>
            {Object.entries(MODOS).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </Campo>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="size-4 accent-primary" />
          Planilha ativa
        </label>
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
        <Button disabled={pending} onClick={() => rodar(() => editarPlanilha(obraId, planilha.id, { nome, modo, ativo }), "Planilha atualizada.", onFechar)}>
          Salvar
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------- Centro de custo

export function FormCc({ obraId, planilhaId, cc, onFechar }: { obraId: number; planilhaId: number; cc: CentroCusto | null; onFechar: () => void }) {
  const [codigo, setCodigo] = useState(cc?.codigo ?? "");
  const [descricao, setDescricao] = useState(cc?.descricao ?? "");
  const [nivel, setNivel] = useState<Nivel | "">(cc?.nivel ?? "");
  const [an, setAn] = useState(cc ? String(cc.an_financeira) : "");
  const [orc, setOrc] = useState(cc ? String(cc.orcamento) : "");
  const { pending, rodar } = useAcao();
  const nivelFinal = nivel || nivelPorCodigo(codigo.trim());
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo id="cc-cod" rotulo="Código" obrigatorio>
          <Input id="cc-cod" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="01.02.03" />
        </Campo>
        <Campo id="cc-desc" rotulo="Descrição" className="sm:col-span-2">
          <Input id="cc-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </Campo>
        <Campo id="cc-nivel" rotulo="Nível">
          <select id="cc-nivel" value={nivel} onChange={(e) => setNivel(e.target.value as Nivel)} className={selectClass}>
            <option value="">Pelo código ({nivelPorCodigo(codigo.trim())})</option>
            {NIVEIS.map((n) => (
              <option key={n} value={n}>
                {n} — {ROTULO_NIVEL[n]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="cc-an" rotulo="An. Financeira (R$)">
          <Input id="cc-an" inputMode="decimal" value={an} onChange={(e) => setAn(e.target.value)} />
        </Campo>
        <Campo id="cc-orc" rotulo="Orçamento (R$)">
          <Input id="cc-orc" inputMode="decimal" value={orc} onChange={(e) => setOrc(e.target.value)} />
        </Campo>
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
        <Button
          disabled={pending}
          onClick={() => {
            const a = numeroBr(an);
            const o = numeroBr(orc);
            if (Number.isNaN(a) || Number.isNaN(o)) return void toast.error("Valor inválido.");
            rodar(
              () => salvarCc(obraId, planilhaId, cc?.id ?? null, { codigo, descricao, nivel: nivelFinal, an_financeira: a, orcamento: o }),
              cc ? "CC atualizado." : "CC adicionado.",
              onFechar,
            );
          }}
        >
          Salvar
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------- Pagamentos do cliente

export function PagamentosCliente({
  obraId,
  planilhas,
  pagamentos,
  planilhaInicial,
  podeLancar,
}: {
  obraId: number;
  planilhas: Planilha[];
  pagamentos: PagamentoCliente[];
  planilhaInicial: number | null;
  podeLancar: boolean;
}) {
  const [filtro, setFiltro] = useState<string>(planilhaInicial ? String(planilhaInicial) : "");
  const [editando, setEditando] = useState<PagamentoCliente | null>(null);
  const vazio = { planilha: filtro, data: hoje(), valor: "", previsao: "", efetivacao: "", realizado: "", descricao: "" };
  const [f, setF] = useState(vazio);
  const { pending, rodar } = useAcao();
  const lista = pagamentos.filter((p) => !filtro || String(p.planilha_id) === filtro);
  const nomePl = (id: number) => planilhas.find((p) => p.id === id)?.nome ?? "";

  const editar = (p: PagamentoCliente) => {
    setEditando(p);
    setF({
      planilha: String(p.planilha_id),
      data: p.data,
      valor: String(p.valor),
      previsao: p.data_previsao ?? "",
      efetivacao: p.data_efetivacao ?? "",
      realizado: p.realizado == null ? "" : p.realizado ? "S" : "N",
      descricao: p.descricao,
    });
  };
  const limpar = () => {
    setEditando(null);
    setF({ ...vazio, planilha: filtro });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label htmlFor="pg-filtro" className="shrink-0">
          Planilha
        </Label>
        <select id="pg-filtro" value={filtro} onChange={(e) => setFiltro(e.target.value)} className={selectClass}>
          <option value="">Todas</option>
          {planilhas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.seq} — {p.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="max-h-64 overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs">
            <tr>
              <th className="p-2">Data</th>
              <th className="p-2">Planilha</th>
              <th className="p-2">Descrição</th>
              <th className="p-2">Previsão</th>
              <th className="p-2">Efetivação</th>
              <th className="p-2">Realizado</th>
              <th className="p-2 text-right">Valor</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {lista.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-muted-foreground">
                  Nenhum pagamento lançado.
                </td>
              </tr>
            )}
            {lista.map((p) => (
              <tr key={p.id} className={cn(editando?.id === p.id && "bg-primary/5")}>
                <td className="p-2">{fmtData(p.data)}</td>
                <td className="p-2">{nomePl(p.planilha_id)}</td>
                <td className="p-2">{p.descricao}</td>
                <td className="p-2">{fmtData(p.data_previsao)}</td>
                <td className="p-2">{fmtData(p.data_efetivacao)}</td>
                <td className="p-2">{p.realizado == null ? "" : p.realizado ? "Sim" : "Não"}</td>
                <td className={cn("p-2 text-right tabular-nums", Number(p.valor) < 0 && "text-destructive")}>{moeda(Number(p.valor))}</td>
                <td className="p-2 text-right whitespace-nowrap">
                  {podeLancar && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => editar(p)}>
                        Editar
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Excluir pagamento"
                        disabled={pending}
                        onClick={() => confirm("Excluir este pagamento do cliente?") && rodar(() => excluirPagamentoCliente(obraId, p.id), "Pagamento excluído.", limpar)}
                      >
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {lista.length > 0 && (
            <tfoot className="border-t bg-muted/50 font-medium">
              <tr>
                <td className="p-2" colSpan={6}>
                  Total
                </td>
                <td className="p-2 text-right tabular-nums">{moeda(lista.reduce((s, p) => s + Number(p.valor), 0))}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {podeLancar && (
        <div className="space-y-3 rounded-md border p-3">
          <div className="text-sm font-medium">{editando ? "Editar pagamento" : "Novo pagamento do cliente"}</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo id="pg-pl" rotulo="Planilha" obrigatorio>
              <select id="pg-pl" value={f.planilha} onChange={(e) => setF({ ...f, planilha: e.target.value })} className={selectClass}>
                <option value="">Selecione…</option>
                {planilhas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.seq} — {p.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="pg-data" rotulo="Data" obrigatorio>
              <Input id="pg-data" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
            </Campo>
            <Campo id="pg-valor" rotulo="Valor (R$)" obrigatorio>
              <Input id="pg-valor" inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />
            </Campo>
            <Campo id="pg-prev" rotulo="Data previsão">
              <Input id="pg-prev" type="date" value={f.previsao} onChange={(e) => setF({ ...f, previsao: e.target.value })} />
            </Campo>
            <Campo id="pg-efet" rotulo="Data efetivação">
              <Input id="pg-efet" type="date" value={f.efetivacao} onChange={(e) => setF({ ...f, efetivacao: e.target.value })} />
            </Campo>
            <Campo id="pg-real" rotulo="Realizado">
              <select id="pg-real" value={f.realizado} onChange={(e) => setF({ ...f, realizado: e.target.value })} className={selectClass}>
                <option value="">—</option>
                <option value="S">Sim</option>
                <option value="N">Não</option>
              </select>
            </Campo>
            <Campo id="pg-desc" rotulo="Descrição" obrigatorio className="sm:col-span-3">
              <Input id="pg-desc" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder="Ex.: Parcela 03 / TED do cliente" />
            </Campo>
          </div>
          <div className="flex justify-end gap-2">
            {editando && (
              <Button variant="outline" onClick={limpar}>
                Cancelar edição
              </Button>
            )}
            <Button
              disabled={pending}
              onClick={() => {
                const valor = numeroBr(f.valor);
                if (!f.planilha) return void toast.error("Selecione a planilha.");
                if (Number.isNaN(valor)) return void toast.error("Valor inválido.");
                rodar(
                  () =>
                    salvarPagamentoCliente(obraId, editando?.id ?? null, {
                      planilha_id: Number(f.planilha),
                      data: f.data,
                      valor,
                      data_previsao: f.previsao || null,
                      data_efetivacao: f.efetivacao || null,
                      realizado: f.realizado === "" ? null : f.realizado === "S",
                      descricao: f.descricao,
                    }),
                  editando ? "Pagamento atualizado." : "Pagamento lançado.",
                  limpar,
                );
              }}
            >
              {editando ? "Salvar alterações" : "Lançar pagamento"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Nas planilhas de obra fechada, a soma dos pagamentos é a verba que o financeiro pode alocar nos CCs. Use valor negativo para estornar.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Percentuais

export function Percentuais({ obraId, planilha, percentuais, podeEditar }: { obraId: number; planilha: Planilha; percentuais: Percentual[]; podeEditar: boolean }) {
  const [tipo, setTipo] = useState<"adm" | "imp">("adm");
  const [desc, setDesc] = useState("");
  const [valor, setValor] = useState("");
  const { pending, rodar } = useAcao();
  const lista = percentuais.filter((p) => p.planilha_id === planilha.id);
  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-md border text-sm">
        {lista.length === 0 && <li className="p-3 text-center text-muted-foreground">Nenhum percentual cadastrado.</li>}
        {lista.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 p-2">
            <span>
              <b>{p.tipo === "adm" ? "Administração" : "Imposto"}</b> · {p.descricao}
            </span>
            <span className="flex items-center gap-2">
              <span className="tabular-nums">{Number(p.valor).toLocaleString("pt-BR")}%</span>
              {podeEditar && (
                <Button size="icon" variant="ghost" aria-label="Excluir percentual" disabled={pending} onClick={() => rodar(() => excluirPercentual(obraId, p.id), "Percentual excluído.")}>
                  <Trash2 />
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {podeEditar && (
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr_6rem_auto] sm:items-end">
          <Campo id="pc-tipo" rotulo="Tipo">
            <select id="pc-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as "adm" | "imp")} className={selectClass}>
              <option value="adm">Administração</option>
              <option value="imp">Imposto</option>
            </select>
          </Campo>
          <Campo id="pc-desc" rotulo="Descrição">
            <Input id="pc-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: Taxa de administração" />
          </Campo>
          <Campo id="pc-valor" rotulo="%">
            <Input id="pc-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
          </Campo>
          <Button
            disabled={pending}
            onClick={() =>
              rodar(() => adicionarPercentual(obraId, planilha.id, tipo, desc, numeroBr(valor)), "Percentual adicionado.", () => {
                setDesc("");
                setValor("");
              })
            }
          >
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Responsáveis

export function Responsaveis({ obraId, responsaveis, perfis, podeEditar }: { obraId: number; responsaveis: Responsavel[]; perfis: Opcao[]; podeEditar: boolean }) {
  const [perfil, setPerfil] = useState("");
  const [tipo, setTipo] = useState<keyof typeof TIPOS_RESPONSAVEL>("engenheiro");
  const [limite, setLimite] = useState("");
  const [qtd, setQtd] = useState("");
  const { pending, rodar } = useAcao();
  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-md border text-sm">
        {responsaveis.length === 0 && <li className="p-3 text-center text-muted-foreground">Nenhum responsável definido.</li>}
        {responsaveis.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 p-2">
            <span>
              <b>{TIPOS_RESPONSAVEL[r.tipo]}</b> · {r.perfil?.nome}
              {r.tipo === "engenheiro" && (r.limite_aprovacao_oc != null || r.qtd_aprovacao_oc != null) && (
                <span className="text-muted-foreground">
                  {" "}
                  · aprova OC até {r.limite_aprovacao_oc != null ? moeda(Number(r.limite_aprovacao_oc)) : "—"}
                  {r.qtd_aprovacao_oc != null && `, ${r.qtd_aprovacao_oc} aprovação(ões)`}
                </span>
              )}
            </span>
            {podeEditar && (
              <Button size="icon" variant="ghost" aria-label="Remover responsável" disabled={pending} onClick={() => rodar(() => removerResponsavel(obraId, r.id), "Responsável removido.")}>
                <Trash2 />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {podeEditar ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="rs-tipo" rotulo="Tipo">
            <select id="rs-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as keyof typeof TIPOS_RESPONSAVEL)} className={selectClass}>
              {Object.entries(TIPOS_RESPONSAVEL).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="rs-perfil" rotulo="Usuário">
            <select id="rs-perfil" value={perfil} onChange={(e) => setPerfil(e.target.value)} className={selectClass}>
              <option value="">Selecione…</option>
              {perfis.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          {tipo === "engenheiro" && (
            <>
              <Campo id="rs-lim" rotulo="Limite de aprovação de OC (R$)">
                <Input id="rs-lim" inputMode="decimal" value={limite} onChange={(e) => setLimite(e.target.value)} />
              </Campo>
              <Campo id="rs-qtd" rotulo="Quantidade de aprovações de OC">
                <Input id="rs-qtd" type="number" min={0} value={qtd} onChange={(e) => setQtd(e.target.value)} />
              </Campo>
            </>
          )}
          <div className="flex justify-end sm:col-span-2">
            <Button
              disabled={pending}
              onClick={() =>
                rodar(
                  () =>
                    adicionarResponsavel(obraId, {
                      perfil_id: perfil,
                      tipo,
                      limite_aprovacao_oc: tipo === "engenheiro" && limite ? numeroBr(limite) : null,
                      qtd_aprovacao_oc: tipo === "engenheiro" && qtd ? Number(qtd) : null,
                    }),
                  "Responsável adicionado.",
                  () => {
                    setPerfil("");
                    setLimite("");
                    setQtd("");
                  },
                )
              }
            >
              Adicionar responsável
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Só o administrador altera os responsáveis da obra.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Filiais

export function Filiais({ obraId, filiais, clientes, podeEditar }: { obraId: number; filiais: { id: number; nome: string }[]; clientes: Opcao[]; podeEditar: boolean }) {
  const [cliente, setCliente] = useState("");
  const { pending, rodar } = useAcao();
  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-md border text-sm">
        {filiais.length === 0 && <li className="p-3 text-center text-muted-foreground">Nenhuma filial ligada.</li>}
        {filiais.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2 p-2">
            {f.nome}
            {podeEditar && (
              <Button size="icon" variant="ghost" aria-label="Remover filial" disabled={pending} onClick={() => rodar(() => removerFilial(obraId, f.id), "Filial removida.")}>
                <Trash2 />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {podeEditar && (
        <div className="flex gap-2">
          <select value={cliente} onChange={(e) => setCliente(e.target.value)} className={selectClass} aria-label="Cliente">
            <option value="">Selecione o cliente…</option>
            {clientes
              .filter((c) => !filiais.some((f) => String(f.id) === c.valor))
              .map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.rotulo}
                </option>
              ))}
          </select>
          <Button disabled={pending} onClick={() => rodar(() => adicionarFilial(obraId, Number(cliente)), "Filial adicionada.", () => setCliente(""))}>
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}

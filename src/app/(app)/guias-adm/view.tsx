"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, ChevronDown, ChevronRight, CircleDollarSign, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FiltroLista, normalizar } from "@/components/compras/filtro-lista";
import { StatusBadge } from "@/components/compras/status-badge";
import { data as fmtData, dataHora, moeda } from "@/lib/format";
import { atualizarGuia } from "@/lib/notas/actions";
import { numeroGuia, STATUS_GUIA, STATUS_NF } from "@/lib/notas/tipos";

export type Guia = {
  id: number;
  obra_id: number;
  obra_codigo: string;
  obra_nome: string;
  cliente_nome: string | null;
  status: string;
  observacao: string | null;
  enviada_em: string | null;
  paga_em: string | null;
  nf_taxa_gerada: boolean;
  criado_em: string;
  qtd_notas: number;
  valor_total: number;
};
export type NotaGuia = { id: number; guia_id: number; numero: string; serie: string; vencimento: string; valor: number; fornecedor_nome: string; status: string };

const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

function AcaoComData({ guia, acao }: { guia: Guia; acao: "enviar" | "pagar" }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(hoje);
  const [pending, startTransition] = useTransition();
  const textos = {
    enviar: { botao: "Enviar", titulo: "Marcar guia como enviada ao cliente", campo: "Data do envio", ok: "Guia marcada como enviada." },
    pagar: { botao: "Paga", titulo: "Confirmar pagamento pelo cliente", campo: "Data do pagamento", ok: "Guia e notas baixadas como pagas." },
  }[acao];

  return (
    <>
      <Button size="sm" variant={acao === "pagar" ? "default" : "outline"} onClick={() => setAberto(true)}>
        {acao === "pagar" ? <CircleDollarSign /> : <Send />} {textos.botao}
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{textos.titulo}</DialogTitle>
            <DialogDescription>
              {numeroGuia(guia.id)} · {guia.obra_codigo} · {guia.qtd_notas} nota(s) · {moeda(Number(guia.valor_total))}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={`d-${acao}-${guia.id}`}>{textos.campo}</Label>
            <Input id={`d-${acao}-${guia.id}`} type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await atualizarGuia(guia.id, acao, data);
                  if (!r.ok) return void toast.error(r.erro);
                  toast.success(textos.ok);
                  setAberto(false);
                  router.refresh();
                })
              }
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function GuiasView({ guias, notas, podeEditar }: { guias: Guia[]; notas: NotaGuia[]; podeEditar: boolean }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [nfTaxa, setNfTaxa] = useState("");
  const [aberta, setAberta] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const filtradas = useMemo(() => {
    const q = normalizar(busca.trim());
    return guias.filter((g) => {
      if (status && g.status !== status) return false;
      if (nfTaxa && String(g.nf_taxa_gerada) !== nfTaxa) return false;
      return !q || normalizar([numeroGuia(g.id), g.obra_codigo, g.obra_nome, g.cliente_nome].join(" ")).includes(q);
    });
  }, [guias, busca, status, nfTaxa]);

  const executar = (fn: () => Promise<{ ok: boolean; erro?: string }>, ok: string) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.erro);
      toast.success(ok);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Guias Adm</h1>
          <p className="text-sm text-muted-foreground">
            Lotes de notas da Fase Azul enviados ao cliente para pagamento direto. Para montar uma guia, selecione as notas em{" "}
            <Link href="/notas-azul" className="underline">
              Notas Fase Azul
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex-1">
          <FiltroLista busca={busca} onBusca={setBusca} status={status} onStatus={setStatus} opcoesStatus={STATUS_GUIA} placeholder="Buscar guia, obra, cliente…" />
        </div>
        <select value={nfTaxa} onChange={(e) => setNfTaxa(e.target.value)} className="h-9 rounded-md border bg-transparent px-3 text-sm" aria-label="NF gerada">
          <option value="">NF da taxa: todas</option>
          <option value="true">NF gerada</option>
          <option value="false">NF não gerada</option>
        </select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Guia</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead className="text-right">Notas</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Envio</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>NF da taxa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                  Nenhuma guia encontrada.
                </TableCell>
              </TableRow>
            )}
            {filtradas.map((g) => (
              <Fragment key={g.id}>
                <TableRow className={pending ? "opacity-60" : undefined}>
                  <TableCell>
                    <button type="button" onClick={() => setAberta(aberta === g.id ? null : g.id)} aria-label="Ver notas da guia">
                      {aberta === g.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </button>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {numeroGuia(g.id)}
                    <div className="font-sans text-muted-foreground">{dataHora(g.criado_em)}</div>
                  </TableCell>
                  <TableCell>
                    {g.obra_codigo} — {g.obra_nome}
                    {g.cliente_nome && <div className="text-xs text-muted-foreground">{g.cliente_nome}</div>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{g.qtd_notas}</TableCell>
                  <TableCell className="text-right tabular-nums">{moeda(Number(g.valor_total))}</TableCell>
                  <TableCell>{fmtData(g.enviada_em) || "—"}</TableCell>
                  <TableCell>{fmtData(g.paga_em) || "—"}</TableCell>
                  <TableCell>
                    <label className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={g.nf_taxa_gerada}
                        disabled={!podeEditar || pending || g.status === "cancelada"}
                        onChange={(e) =>
                          executar(() => atualizarGuia(g.id, "nf_taxa", undefined, e.target.checked), e.target.checked ? "NF da taxa marcada como gerada." : "NF da taxa desmarcada.")
                        }
                        className="size-4 accent-primary"
                      />
                      {g.nf_taxa_gerada ? "Gerada" : "Não"}
                    </label>
                  </TableCell>
                  <TableCell>
                    <StatusBadge mapa={STATUS_GUIA} valor={g.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {podeEditar && (
                      <div className="inline-flex gap-1">
                        {g.status === "aberta" && <AcaoComData guia={g} acao="enviar" />}
                        {(g.status === "aberta" || g.status === "enviada") && (
                          <>
                            <AcaoComData guia={g} acao="pagar" />
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label="Cancelar guia"
                              onClick={() => {
                                if (confirm(`Cancelar ${numeroGuia(g.id)}? As notas voltam para "Aguardando guia".`))
                                  executar(() => atualizarGuia(g.id, "cancelar"), "Guia cancelada.");
                              }}
                            >
                              <Ban />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
                {aberta === g.id && (
                  <TableRow className="bg-muted/30">
                    <TableCell />
                    <TableCell colSpan={9}>
                      {g.observacao && <p className="mb-2 text-sm">{g.observacao}</p>}
                      <ul className="divide-y rounded-md border bg-background text-sm">
                        {notas
                          .filter((n) => n.guia_id === g.id)
                          .map((n) => (
                            <li key={n.id} className="flex items-center justify-between gap-3 p-2">
                              <Link href={`/notas/${n.id}`} className="hover:underline">
                                NF {n.numero}/{n.serie} · {n.fornecedor_nome}
                              </Link>
                              <span className="flex items-center gap-3">
                                <span className="text-muted-foreground">venc. {fmtData(n.vencimento)}</span>
                                <span className="tabular-nums">{moeda(Number(n.valor))}</span>
                                <StatusBadge mapa={STATUS_NF} valor={n.status} />
                              </span>
                            </li>
                          ))}
                        {g.status === "cancelada" && <li className="p-2 text-muted-foreground">As notas desta guia foram devolvidas para “Aguardando guia”.</li>}
                      </ul>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

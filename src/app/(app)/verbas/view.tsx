"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Search, Trash2 } from "lucide-react";
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
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { selectClass } from "@/components/cadastros/registro-form";
import { normalizar } from "@/components/compras/filtro-lista";
import { cn } from "@/lib/utils";
import { data as fmtData, moeda } from "@/lib/format";
import { excluirAporte, lancarAporte } from "@/lib/notas/actions";

export type VerbaObra = {
  obra_id: number;
  codigo: string;
  nome: string;
  ativo: boolean;
  cliente_nome: string | null;
  aportes: number;
  pago: number;
  a_pagar: number;
  disponivel: number;
};
export type Aporte = { id: number; obra_id: number; data: string; valor: number; descricao: string | null; lancado: { nome: string } | null };

const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

function NovoAporte({ obras, obraInicial, onFechar }: { obras: VerbaObra[]; obraInicial: string; onFechar: () => void }) {
  const router = useRouter();
  const [obra, setObra] = useState(obraInicial);
  const [data, setData] = useState(hoje);
  const [valor, setValor] = useState("");
  const [desc, setDesc] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="ap-obra">
            Obra<span className="text-destructive">*</span>
          </Label>
          <select id="ap-obra" value={obra} onChange={(e) => setObra(e.target.value)} className={selectClass}>
            <option value="">Selecione…</option>
            {obras
              .filter((o) => o.ativo)
              .map((o) => (
                <option key={o.obra_id} value={o.obra_id}>
                  {o.codigo} — {o.nome}
                </option>
              ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ap-data">Data</Label>
          <Input id="ap-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ap-valor">
            Valor (R$)<span className="text-destructive">*</span>
          </Label>
          <Input id="ap-valor" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
          <span className="text-xs text-muted-foreground">Use valor negativo para estornar um aporte.</span>
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="ap-desc">Descrição</Label>
          <Input id="ap-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: Aporte mensal / TED do cliente" />
        </div>
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await lancarAporte(Number(obra), data, Number(valor), desc);
              if (!r.ok) return void toast.error(r.erro);
              toast.success("Aporte lançado.");
              onFechar();
              router.refresh();
            })
          }
        >
          {pending ? "Lançando…" : "Lançar aporte"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function VerbasView({ verbas, aportes, podeLancar }: { verbas: VerbaObra[]; aportes: Aporte[]; podeLancar: boolean }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [soAtivas, setSoAtivas] = useState(true);
  const [aberta, setAberta] = useState<number | null>(null);
  const [novo, setNovo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtradas = useMemo(() => {
    const q = normalizar(busca.trim());
    return verbas.filter((v) => (!soAtivas || v.ativo) && (!q || normalizar(`${v.codigo} ${v.nome} ${v.cliente_nome ?? ""}`).includes(q)));
  }, [verbas, busca, soAtivas]);

  const soma = (k: keyof VerbaObra) => filtradas.reduce((s, v) => s + Number(v[k]), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Verbas das obras</h1>
          <p className="text-sm text-muted-foreground">Verba disponível = aportes do cliente − notas da Fase Cinza pagas.</p>
        </div>
        {podeLancar && (
          <Button onClick={() => setNovo("")}>
            <Plus /> Lançar aporte
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar obra ou cliente…" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={soAtivas} onChange={(e) => setSoAtivas(e.target.checked)} className="size-4 accent-primary" />
          Só obras ativas
        </label>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Obra</TableHead>
              <TableHead className="text-right">Aportes</TableHead>
              <TableHead className="text-right">Pago</TableHead>
              <TableHead className="text-right">Disponível</TableHead>
              <TableHead className="text-right">A pagar (em aberto)</TableHead>
              <TableHead className="text-right">Saldo projetado</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Nenhuma obra encontrada.
                </TableCell>
              </TableRow>
            )}
            {filtradas.map((v) => {
              const projetado = Number(v.disponivel) - Number(v.a_pagar);
              const lista = aportes.filter((a) => a.obra_id === v.obra_id);
              return (
                <Fragment key={v.obra_id}>
                  <TableRow className={pending ? "opacity-60" : undefined}>
                    <TableCell>
                      <button type="button" onClick={() => setAberta(aberta === v.obra_id ? null : v.obra_id)} aria-label="Ver aportes">
                        {aberta === v.obra_id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </button>
                    </TableCell>
                    <TableCell>
                      {v.codigo} — {v.nome}
                      {v.cliente_nome && <div className="text-xs text-muted-foreground">{v.cliente_nome}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{moeda(Number(v.aportes))}</TableCell>
                    <TableCell className="text-right tabular-nums">{moeda(Number(v.pago))}</TableCell>
                    <TableCell className={cn("text-right font-medium tabular-nums", Number(v.disponivel) < 0 && "text-destructive")}>
                      {moeda(Number(v.disponivel))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{moeda(Number(v.a_pagar))}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", projetado < 0 && "text-destructive")}>{moeda(projetado)}</TableCell>
                    <TableCell className="text-right">
                      {podeLancar && v.ativo && (
                        <Button size="sm" variant="outline" onClick={() => setNovo(String(v.obra_id))}>
                          <Plus /> Aporte
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {aberta === v.obra_id && (
                    <TableRow className="bg-muted/30">
                      <TableCell />
                      <TableCell colSpan={7}>
                        {lista.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhum aporte lançado.</p>
                        ) : (
                          <ul className="divide-y rounded-md border bg-background text-sm">
                            {lista.map((a) => (
                              <li key={a.id} className="flex items-center justify-between gap-3 p-2">
                                <span>
                                  {fmtData(a.data)} · {a.descricao || "Aporte"}
                                  {a.lancado?.nome && <span className="text-muted-foreground"> · {a.lancado.nome}</span>}
                                </span>
                                <span className="flex items-center gap-2">
                                  <span className={cn("tabular-nums", Number(a.valor) < 0 && "text-destructive")}>{moeda(Number(a.valor))}</span>
                                  {podeLancar && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      aria-label="Excluir aporte"
                                      onClick={() => {
                                        if (!confirm("Excluir este aporte?")) return;
                                        startTransition(async () => {
                                          const r = await excluirAporte(a.id);
                                          if (!r.ok) return void toast.error(r.erro);
                                          toast.success("Aporte excluído.");
                                          router.refresh();
                                        });
                                      }}
                                    >
                                      <Trash2 />
                                    </Button>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
          {filtradas.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell />
                <TableCell className="font-medium">Total</TableCell>
                <TableCell className="text-right tabular-nums">{moeda(soma("aportes"))}</TableCell>
                <TableCell className="text-right tabular-nums">{moeda(soma("pago"))}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{moeda(soma("disponivel"))}</TableCell>
                <TableCell className="text-right tabular-nums">{moeda(soma("a_pagar"))}</TableCell>
                <TableCell className="text-right tabular-nums">{moeda(soma("disponivel") - soma("a_pagar"))}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <Dialog open={novo !== null} onOpenChange={(o) => !o && setNovo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lançar aporte</DialogTitle>
            <DialogDescription>Valor repassado pelo cliente para pagar as compras da obra (Fase Cinza).</DialogDescription>
          </DialogHeader>
          {novo !== null && <NovoAporte obras={verbas} obraInicial={novo} onFechar={() => setNovo(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

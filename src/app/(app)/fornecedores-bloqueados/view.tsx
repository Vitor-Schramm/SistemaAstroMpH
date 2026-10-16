"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Ban, Download, Eye, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { selectClass } from "@/components/cadastros/registro-form";
import { dataHora } from "@/lib/format";
import { bloquear, desbloquear, type BloqueioState } from "./actions";

export type Bloqueado = {
  id: number;
  cpf_cnpj: string;
  nome: string;
  nome_fantasia: string | null;
  bloqueio_id: number;
  bloqueio_justificativa: string;
  bloqueado_em: string;
  bloqueado_por_nome: string | null;
};

function FormBloqueio({ disponiveis, onFeito }: { disponiveis: { valor: string; rotulo: string }[]; onFeito: () => void }) {
  const [state, action, pending] = useActionState<BloqueioState, FormData>(bloquear, {});
  useEffect(() => {
    if (state.ok) {
      toast.success("Fornecedor bloqueado.");
      onFeito();
    } else if (state.erro) toast.error(state.erro);
  }, [state, onFeito]);

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="fornecedor_id">
          Fornecedor<span className="text-destructive">*</span>
        </Label>
        <select id="fornecedor_id" name="fornecedor_id" required className={selectClass} defaultValue="">
          <option value="">Selecione…</option>
          {disponiveis.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="justificativa">
          Justificativa do bloqueio<span className="text-destructive">*</span>
        </Label>
        <Textarea id="justificativa" name="justificativa" required minLength={5} rows={4} />
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Bloqueando…" : "Bloquear"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function BloqueadosView({
  bloqueados,
  disponiveis,
  podeEditar,
}: {
  bloqueados: Bloqueado[];
  disponiveis: { valor: string; rotulo: string }[];
  podeEditar: boolean;
}) {
  const [novo, setNovo] = useState(false);
  const [detalhe, setDetalhe] = useState<Bloqueado | null>(null);
  const [pending, startTransition] = useTransition();

  const exportar = () => {
    const esc = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
    const csv = [
      ["CNPJ", "Nome", "Fantasia", "Data bloqueio", "Usuário", "Justificativa"].map(esc).join(";"),
      ...bloqueados.map((b) =>
        [b.cpf_cnpj, b.nome, b.nome_fantasia ?? "", dataHora(b.bloqueado_em), b.bloqueado_por_nome ?? "", b.bloqueio_justificativa]
          .map(esc)
          .join(";"),
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: "fornecedores-bloqueados.csv" }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fornecedores Bloqueados</h1>
          <p className="text-sm text-muted-foreground">{bloqueados.length} fornecedor(es) bloqueado(s) no momento</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportar}>
            <Download /> Exportar
          </Button>
          {podeEditar && (
            <Button variant="destructive" onClick={() => setNovo(true)}>
              <Ban /> Bloquear fornecedor
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>CNPJ</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Fantasia</TableHead>
              <TableHead>Data bloqueio</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bloqueados.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Nenhum fornecedor bloqueado.
                </TableCell>
              </TableRow>
            )}
            {bloqueados.map((b) => (
              <TableRow key={b.bloqueio_id} className={pending ? "opacity-60" : undefined}>
                <TableCell>{b.cpf_cnpj}</TableCell>
                <TableCell>{b.nome}</TableCell>
                <TableCell>{b.nome_fantasia}</TableCell>
                <TableCell>{dataHora(b.bloqueado_em)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" aria-label="Detalhes" onClick={() => setDetalhe(b)}>
                    <Eye />
                  </Button>
                  {podeEditar && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Desbloquear"
                      onClick={() => {
                        if (!confirm(`Desbloquear ${b.nome}?`)) return;
                        startTransition(async () => {
                          try {
                            await desbloquear(b.bloqueio_id);
                            toast.success("Fornecedor desbloqueado.");
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        });
                      }}
                    >
                      <Unlock />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear fornecedor</DialogTitle>
            <DialogDescription>Fornecedores bloqueados ficam marcados no cadastro e no histórico.</DialogDescription>
          </DialogHeader>
          {novo && <FormBloqueio disponiveis={disponiveis} onFeito={() => setNovo(false)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={detalhe !== null} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do bloqueio</DialogTitle>
            <DialogDescription>{detalhe?.nome}</DialogDescription>
          </DialogHeader>
          {detalhe && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Usuário</dt>
              <dd>{detalhe.bloqueado_por_nome ?? "—"}</dd>
              <dt className="text-muted-foreground">Data</dt>
              <dd>{dataHora(detalhe.bloqueado_em)}</dd>
              <dt className="text-muted-foreground">Justificativa</dt>
              <dd className="whitespace-pre-wrap">{detalhe.bloqueio_justificativa}</dd>
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

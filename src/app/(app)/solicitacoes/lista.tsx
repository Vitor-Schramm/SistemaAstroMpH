"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, FileStack, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FiltroLista, normalizar } from "@/components/compras/filtro-lista";
import { StatusBadge } from "@/components/compras/status-badge";
import { dataHora } from "@/lib/format";
import { numeroSolicitacao, STATUS_SOLICITACAO } from "@/lib/compras/tipos";
import { cancelarSolicitacao } from "@/lib/compras/actions";

export type LinhaSolicitacao = {
  id: number;
  servico: string;
  status: string;
  criado_em: string;
  solicitante_id: string | null;
  obra: { codigo: string; nome: string; cliente: { nome: string } | null } | null;
  solicitante: { nome: string } | null;
  itens: { count: number }[];
};

export function ListaSolicitacoes({
  linhas,
  podeComprar,
  usuarioId,
}: {
  linhas: LinhaSolicitacao[];
  podeComprar: boolean;
  usuarioId: string;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("pendente");
  const [pending, startTransition] = useTransition();

  const filtradas = useMemo(() => {
    const q = normalizar(busca.trim());
    return linhas.filter((l) => {
      if (status && l.status !== status) return false;
      if (!q) return true;
      return normalizar(
        [numeroSolicitacao(l.id), l.servico, l.obra?.codigo, l.obra?.nome, l.obra?.cliente?.nome, l.solicitante?.nome].join(" "),
      ).includes(q);
    });
  }, [linhas, busca, status]);

  const pendentes = linhas.filter((l) => l.status === "pendente").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Solicitações de compra</h1>
          <p className="text-sm text-muted-foreground">
            {linhas.length} no total · {pendentes} pendente(s) de cotação
          </p>
        </div>
        <Button render={<Link href="/solicitacoes/nova" />}>
          <Plus /> Nova solicitação
        </Button>
      </div>

      <FiltroLista busca={busca} onBusca={setBusca} status={status} onStatus={setStatus} opcoesStatus={STATUS_SOLICITACAO} />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead className="text-right">Itens</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  Nenhuma solicitação encontrada.
                </TableCell>
              </TableRow>
            )}
            {filtradas.map((l) => {
              const editavel = l.status === "pendente" && (podeComprar || l.solicitante_id === usuarioId);
              return (
                <TableRow key={l.id} className={pending ? "opacity-60" : undefined}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/solicitacoes/${l.id}`} className="hover:underline">
                      {numeroSolicitacao(l.id)}
                    </Link>
                  </TableCell>
                  <TableCell>{l.obra ? `${l.obra.codigo} — ${l.obra.nome}` : ""}</TableCell>
                  <TableCell>{l.obra?.cliente?.nome}</TableCell>
                  <TableCell className="max-w-64 truncate">{l.servico}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.itens?.[0]?.count ?? 0}</TableCell>
                  <TableCell>{l.solicitante?.nome}</TableCell>
                  <TableCell className="whitespace-nowrap">{dataHora(l.criado_em)}</TableCell>
                  <TableCell>
                    <StatusBadge mapa={STATUS_SOLICITACAO} valor={l.status} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Ações" />}>
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/solicitacoes/${l.id}`)}>
                          <Pencil /> {editavel ? "Abrir / editar" : "Abrir"}
                        </DropdownMenuItem>
                        {podeComprar && l.status === "pendente" && (
                          <DropdownMenuItem onClick={() => router.push(`/mapas/novo?solicitacao=${l.id}`)}>
                            <FileStack /> Gerar mapa de cotação
                          </DropdownMenuItem>
                        )}
                        {(editavel || (podeComprar && l.status === "em_cotacao")) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                if (!confirm(`Cancelar a solicitação ${numeroSolicitacao(l.id)}?`)) return;
                                startTransition(async () => {
                                  const r = await cancelarSolicitacao(l.id);
                                  if (r.ok) toast.success("Solicitação cancelada.");
                                  else toast.error(r.erro);
                                });
                              }}
                            >
                              <Ban /> Cancelar
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FiltroLista, normalizar } from "@/components/compras/filtro-lista";
import { StatusBadge } from "@/components/compras/status-badge";
import { dataHora, data as fmtData, moeda } from "@/lib/format";
import { numeroReembolso, STATUS_REEMBOLSO, type ReembolsoResumo } from "@/lib/reembolsos/tipos";
import { AcoesReembolso } from "./acoes";

export function ListaReembolsos({ linhas, podeAprovar, podePagar }: { linhas: ReembolsoResumo[]; podeAprovar: boolean; podePagar: boolean }) {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");

  const filtradas = useMemo(() => {
    const q = normalizar(busca.trim());
    return linhas.filter((l) => {
      if (status && l.status !== status) return false;
      return !q || normalizar([numeroReembolso(l.id), l.obra_codigo, l.obra_nome, l.fornecedor_nome, l.cpf_cnpj, l.criado_por_nome].join(" ")).includes(q);
    });
  }, [linhas, busca, status]);

  const total = filtradas.reduce((s, l) => s + Number(l.valor_total), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ordens de reembolso</h1>
          <p className="text-sm text-muted-foreground">
            {filtradas.length} reembolso(s) · {moeda(total)}
          </p>
        </div>
        <Button render={<Link href="/ordens-reembolso/novo" />}>
          <Plus /> Novo reembolso
        </Button>
      </div>

      <FiltroLista busca={busca} onBusca={setBusca} status={status} onStatus={setStatus} opcoesStatus={STATUS_REEMBOLSO} placeholder="Buscar número, obra, favorecido…" />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Favorecido</TableHead>
              <TableHead className="text-right">Itens</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Nenhum reembolso encontrado.
                </TableCell>
              </TableRow>
            )}
            {filtradas.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/ordens-reembolso/${l.id}`} className="hover:underline">
                    {numeroReembolso(l.id)}
                  </Link>
                </TableCell>
                <TableCell>
                  {l.obra_codigo} — {l.obra_nome}
                  {l.filial && <div className="text-xs text-muted-foreground">Filial: {l.filial}</div>}
                </TableCell>
                <TableCell>
                  {l.fornecedor_nome}
                  <div className="text-xs text-muted-foreground">{l.cpf_cnpj}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{l.qtd_itens}</TableCell>
                <TableCell className="text-right tabular-nums">{moeda(Number(l.valor_total))}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {dataHora(l.criado_em)}
                  {l.criado_por_nome && <div className="text-xs text-muted-foreground">{l.criado_por_nome}</div>}
                </TableCell>
                <TableCell>
                  <StatusBadge mapa={STATUS_REEMBOLSO} valor={l.status} />
                  {l.pago_em && <div className="text-xs text-muted-foreground">pago {fmtData(l.pago_em)}</div>}
                  {l.pagamento_forcado && (
                    <div className="inline-flex items-center gap-0.5 text-xs text-amber-700">
                      <TriangleAlert className="size-3" /> forçado
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <AcoesReembolso r={l} podeAprovar={podeAprovar} podePagar={podePagar} compacto />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

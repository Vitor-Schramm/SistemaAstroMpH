"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FiltroLista, normalizar } from "@/components/compras/filtro-lista";
import { StatusBadge } from "@/components/compras/status-badge";
import { data as fmtData, moeda } from "@/lib/format";
import { numeroOC, STATUS_OC } from "@/lib/compras/tipos";
import { Aprovacao } from "@/components/compras/aprovacao-icone";

export type LinhaOc = {
  id: number;
  status: string;
  data_emissao: string;
  obra_codigo: string;
  obra_nome: string;
  cliente_nome: string | null;
  fornecedor_nome: string;
  engenheiro_responsavel: string | null;
  valor_total: number;
  fornecedor_bloqueado: boolean;
  aprovado_engenharia: boolean | null;
  aprovado_financeiro: boolean | null;
  mapa_id: number | null;
};

function exportar(linhas: LinhaOc[]) {
  const esc = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const csv = [
    ["OC", "Emissão", "Obra", "Cliente", "Fornecedor", "Engenheiro", "Valor", "Status"].map(esc).join(";"),
    ...linhas.map((l) =>
      [numeroOC(l.id), fmtData(l.data_emissao), `${l.obra_codigo} — ${l.obra_nome}`, l.cliente_nome, l.fornecedor_nome, l.engenheiro_responsavel, String(l.valor_total).replace(".", ","), STATUS_OC[l.status]?.rotulo]
        .map(esc)
        .join(";"),
    ),
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  Object.assign(document.createElement("a"), { href: url, download: "ordens-compra.csv" }).click();
  URL.revokeObjectURL(url);
}

export function ListaOcs({ linhas, podeComprar }: { linhas: LinhaOc[]; podeComprar: boolean }) {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");

  const filtradas = useMemo(() => {
    const q = normalizar(busca.trim());
    return linhas.filter((l) => {
      if (status && l.status !== status) return false;
      if (!q) return true;
      return normalizar([numeroOC(l.id), l.obra_codigo, l.obra_nome, l.cliente_nome, l.fornecedor_nome, l.engenheiro_responsavel].join(" ")).includes(q);
    });
  }, [linhas, busca, status]);

  const total = filtradas.reduce((s, l) => s + Number(l.valor_total), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ordens de compra</h1>
          <p className="text-sm text-muted-foreground">
            {filtradas.length} OC(s) · {moeda(total)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportar(filtradas)}>
            <Download /> Exportar
          </Button>
          {podeComprar && (
            <Button render={<Link href="/ordens-compra/nova" />}>
              <Plus /> Nova OC
            </Button>
          )}
        </div>
      </div>

      <FiltroLista busca={busca} onBusca={setBusca} status={status} onStatus={setStatus} opcoesStatus={STATUS_OC} />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>OC</TableHead>
              <TableHead>Emissão</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Eng. responsável</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Eng.</TableHead>
              <TableHead className="text-center">Fin.</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  Nenhuma ordem de compra encontrada.
                </TableCell>
              </TableRow>
            )}
            {filtradas.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/ordens-compra/${l.id}`} className="hover:underline">
                    {numeroOC(l.id)}
                  </Link>
                </TableCell>
                <TableCell>{fmtData(l.data_emissao)}</TableCell>
                <TableCell>
                  {l.obra_codigo} — {l.obra_nome}
                  {l.cliente_nome && <div className="text-xs text-muted-foreground">{l.cliente_nome}</div>}
                </TableCell>
                <TableCell>
                  {l.fornecedor_nome}
                  {l.fornecedor_bloqueado && (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-destructive">
                      <TriangleAlert className="size-3" /> bloqueado
                    </span>
                  )}
                </TableCell>
                <TableCell>{l.engenheiro_responsavel}</TableCell>
                <TableCell className="text-right tabular-nums">{moeda(Number(l.valor_total))}</TableCell>
                <TableCell className="text-center">
                  <Aprovacao valor={l.aprovado_engenharia} />
                </TableCell>
                <TableCell className="text-center">
                  <Aprovacao valor={l.aprovado_financeiro} />
                </TableCell>
                <TableCell>
                  <StatusBadge mapa={STATUS_OC} valor={l.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

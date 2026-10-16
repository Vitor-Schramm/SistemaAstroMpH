"use client";

import type React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Paperclip, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/compras/status-badge";
import { normalizar } from "@/components/compras/filtro-lista";
import { selectClass } from "@/components/cadastros/registro-form";
import { cn } from "@/lib/utils";
import { data as fmtData, moeda } from "@/lib/format";
import { numeroOC } from "@/lib/compras/tipos";
import { STATUS_NF, type NotaResumo } from "@/lib/notas/tipos";

export type Aba = { chave: string; rotulo: string; status: string[] };

function exportar(linhas: NotaResumo[], nome: string) {
  const esc = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const csv = [
    ["Nota", "Série", "Fase", "Emissão", "Vencimento", "Obra", "Cliente", "OC", "Fornecedor", "CNPJ", "Valor", "Status", "Pago em"].map(esc).join(";"),
    ...linhas.map((n) =>
      [n.numero, n.serie, n.fase, fmtData(n.emissao), fmtData(n.vencimento), `${n.obra_codigo} — ${n.obra_nome}`, n.cliente_nome, numeroOC(n.ordem_compra_id), n.fornecedor_nome, n.fornecedor_cnpj, String(n.valor).replace(".", ","), STATUS_NF[n.status]?.rotulo, fmtData(n.pago_em)]
        .map(esc)
        .join(";"),
    ),
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  Object.assign(document.createElement("a"), { href: url, download: `${nome}.csv` }).click();
  URL.revokeObjectURL(url);
}

/**
 * Listagem de notas com abas por status, busca, filtro de obra e período de vencimento.
 * `acoes` renderiza os botões de cada linha; `selecao` liga as caixas de seleção.
 */
export function NotasTabela({
  titulo,
  descricao,
  notas,
  abas,
  acoes,
  selecao,
  topo,
  nomeArquivo,
}: {
  titulo: string;
  descricao?: string;
  notas: NotaResumo[];
  abas: Aba[];
  acoes?: (n: NotaResumo) => React.ReactNode;
  selecao?: { aba: string; selecionadas: number[]; onChange: (ids: number[]) => void; acao: (sel: NotaResumo[]) => React.ReactNode };
  topo?: React.ReactNode;
  nomeArquivo: string;
}) {
  const [aba, setAba] = useState(abas[0].chave);
  const [busca, setBusca] = useState("");
  const [obra, setObra] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const abaAtual = abas.find((a) => a.chave === aba)!;
  const obras = useMemo(() => [...new Map(notas.map((n) => [n.obra_id, `${n.obra_codigo} — ${n.obra_nome}`])).entries()], [notas]);

  const filtradas = useMemo(() => {
    const q = normalizar(busca.trim());
    return notas.filter((n) => {
      if (!abaAtual.status.includes(n.status)) return false;
      if (obra && String(n.obra_id) !== obra) return false;
      if (de && n.vencimento < de) return false;
      if (ate && n.vencimento > ate) return false;
      if (!q) return true;
      return normalizar([n.numero, n.fornecedor_nome, n.fornecedor_cnpj, n.obra_codigo, n.obra_nome, n.cliente_nome, numeroOC(n.ordem_compra_id)].join(" ")).includes(q);
    });
  }, [notas, abaAtual, busca, obra, de, ate]);

  const total = filtradas.reduce((s, n) => s + Number(n.valor), 0);
  const hoje = new Date().toISOString().slice(0, 10);
  const comSelecao = selecao && selecao.aba === aba;
  const selecionadas = comSelecao ? filtradas.filter((n) => selecao.selecionadas.includes(n.id)) : [];

  const alternar = (id: number) =>
    selecao?.onChange(selecao.selecionadas.includes(id) ? selecao.selecionadas.filter((x) => x !== id) : [...selecao.selecionadas, id]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportar(filtradas, nomeArquivo)}>
            <Download /> Exportar
          </Button>
          {topo}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b">
        {abas.map((a) => {
          const qtd = notas.filter((n) => a.status.includes(n.status)).length;
          return (
            <button
              key={a.chave}
              type="button"
              onClick={() => {
                setAba(a.chave);
                selecao?.onChange([]);
              }}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm",
                aba === a.chave ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {a.rotulo} <span className="ml-1 rounded-full bg-muted px-1.5 text-xs">{qtd}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar nota, fornecedor, CNPJ, obra, OC…" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8" />
        </div>
        <select value={obra} onChange={(e) => setObra(e.target.value)} className={`${selectClass} w-64`} aria-label="Filtrar por obra">
          <option value="">Todas as obras</option>
          {obras.map(([id, r]) => (
            <option key={id} value={id}>
              {r}
            </option>
          ))}
        </select>
        <label className="text-xs text-muted-foreground">
          Vencimento de
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-40" />
        </label>
        <label className="text-xs text-muted-foreground">
          até
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-40" />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          {filtradas.length} nota(s) · <span className="font-medium text-foreground">{moeda(total)}</span>
        </span>
        {comSelecao && selecionadas.length > 0 && selecao.acao(selecionadas)}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {comSelecao && <TableHead className="w-8" />}
              <TableHead>Nota</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>OC</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  Nenhuma nota nesta situação.
                </TableCell>
              </TableRow>
            )}
            {filtradas.map((n) => {
              const vencida = !["paga", "cancelada"].includes(n.status) && n.vencimento < hoje;
              return (
                <TableRow key={n.id}>
                  {comSelecao && (
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selecao.selecionadas.includes(n.id)}
                        onChange={() => alternar(n.id)}
                        className="size-4 accent-primary"
                        aria-label={`Selecionar nota ${n.numero}`}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Link href={`/notas/${n.id}`} className="font-medium hover:underline">
                      {n.numero}
                      <span className="text-muted-foreground">/{n.serie}</span>
                    </Link>
                    {n.anexos > 0 && <Paperclip className="ml-1 inline size-3 text-muted-foreground" aria-label={`${n.anexos} anexo(s)`} />}
                    <div
                      className={cn(
                        "mt-0.5 w-fit rounded px-1 text-[10px] font-medium uppercase",
                        n.fase === "azul" ? "bg-sky-100 text-sky-800" : "bg-zinc-200 text-zinc-700",
                      )}
                    >
                      {n.fase}
                    </div>
                  </TableCell>
                  <TableCell className={cn("whitespace-nowrap", vencida && "font-medium text-destructive")}>
                    {fmtData(n.vencimento)}
                    {n.pago_em && <div className="text-xs text-muted-foreground">pago {fmtData(n.pago_em)}</div>}
                  </TableCell>
                  <TableCell>
                    {n.obra_codigo} — {n.obra_nome}
                    {n.cliente_nome && <div className="text-xs text-muted-foreground">{n.cliente_nome}</div>}
                  </TableCell>
                  <TableCell>
                    {n.fornecedor_nome}
                    <div className="text-xs text-muted-foreground">{n.fornecedor_cnpj}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/ordens-compra/${n.ordem_compra_id}`} className="hover:underline">
                      {numeroOC(n.ordem_compra_id)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{moeda(Number(n.valor))}</TableCell>
                  <TableCell>
                    <StatusBadge mapa={STATUS_NF} valor={n.status} />
                    {n.pagamento_forcado && (
                      <div className="mt-1 inline-flex items-center gap-0.5 text-xs text-amber-700">
                        <TriangleAlert className="size-3" /> forçado
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{acoes?.(n)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

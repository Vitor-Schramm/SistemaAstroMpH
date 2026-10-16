"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { selectClass } from "@/components/cadastros/registro-form";
import { data as fmtData, moeda } from "@/lib/format";
import type { Opcao } from "@/lib/compras/tipos";

export type Coluna = { chave: string; rotulo: string; tipo?: "data" | "moeda" };
export type Linha = Record<string, string | number> & { href: string };
type Filtros = { tipo: string; obra: string; fornecedor: string; de: string; ate: string; status: string };

const formatar = (c: Coluna, v: string | number) => (c.tipo === "moeda" ? moeda(Number(v)) : c.tipo === "data" ? fmtData(String(v)) : String(v ?? ""));

export function ConsultaView({
  filtros,
  tipos,
  obras,
  fornecedores,
  statusOpcoes,
  colunas,
  linhas,
  limite,
}: {
  filtros: Filtros;
  tipos: Record<string, string>;
  obras: Opcao[];
  fornecedores: Opcao[];
  statusOpcoes: Opcao[];
  colunas: Coluna[];
  linhas: Linha[];
  limite: boolean;
}) {
  const router = useRouter();
  const [f, setF] = useState(filtros);
  const set = (k: keyof Filtros) => (v: string) => setF((x) => ({ ...x, [k]: v, ...(k === "tipo" ? { status: "" } : {}) }));
  const rotuloPeriodo = { ocs: "Emissão", notas: "Vencimento", reembolsos: "Criação", pagamentos: "Pagamento" }[f.tipo] ?? "Período";

  const consultar = () => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
    router.push(`/consultas?${qs}`);
  };

  const total = linhas.reduce((s, l) => s + (typeof l.valor === "number" ? l.valor : 0), 0);

  const exportar = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const csv = [
      colunas.map((c) => esc(c.rotulo)).join(";"),
      ...linhas.map((l) => colunas.map((c) => esc(c.tipo === "moeda" ? String(l[c.chave]).replace(".", ",") : formatar(c, l[c.chave]))).join(";")),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: `consulta-${filtros.tipo}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Consultas</h1>
        <p className="text-sm text-muted-foreground">Escolha o tipo de consulta, aplique os filtros e exporte para Excel.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          consultar();
        }}
        className="grid gap-3 rounded-md border p-4 sm:grid-cols-6"
      >
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="c-tipo">
            Tipo de consulta<span className="text-destructive">*</span>
          </Label>
          <select id="c-tipo" required value={f.tipo} onChange={(e) => set("tipo")(e.target.value)} className={selectClass}>
            <option value="">Selecione…</option>
            {Object.entries(tipos).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="c-obra">Obra</Label>
          <select id="c-obra" value={f.obra} onChange={(e) => set("obra")(e.target.value)} className={selectClass}>
            <option value="">Todas</option>
            {obras.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="c-forn">Fornecedor</Label>
          <select id="c-forn" value={f.fornecedor} onChange={(e) => set("fornecedor")(e.target.value)} className={selectClass}>
            <option value="">Todos</option>
            {fornecedores.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="c-de">{rotuloPeriodo} de</Label>
          <Input id="c-de" type="date" value={f.de} onChange={(e) => set("de")(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="c-ate">até</Label>
          <Input id="c-ate" type="date" value={f.ate} onChange={(e) => set("ate")(e.target.value)} />
        </div>
        {f.tipo && f.tipo !== "pagamentos" && f.tipo === filtros.tipo && (
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="c-status">Status</Label>
            <select id="c-status" value={f.status} onChange={(e) => set("status")(e.target.value)} className={selectClass}>
              <option value="">Todos</option>
              {statusOpcoes.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-end sm:col-span-2 sm:col-start-5 sm:justify-end">
          <Button type="submit" disabled={!f.tipo}>
            <Search /> Consultar
          </Button>
        </div>
      </form>

      {filtros.tipo && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              {tipos[filtros.tipo]}: {linhas.length} registro(s) · <span className="font-medium text-foreground">{moeda(total)}</span>
              {limite && <span className="ml-2 text-amber-700">Resultado limitado — refine os filtros.</span>}
            </span>
            <Button variant="outline" onClick={exportar} disabled={!linhas.length}>
              <Download /> Exportar
            </Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {colunas.map((c) => (
                    <TableHead key={c.chave} className={c.tipo === "moeda" ? "text-right" : undefined}>
                      {c.rotulo}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={colunas.length} className="h-24 text-center text-muted-foreground">
                      Nenhum registro com esses filtros.
                    </TableCell>
                  </TableRow>
                )}
                {linhas.map((l, i) => (
                  <TableRow key={`${l.href}-${i}`}>
                    {colunas.map((c, j) => (
                      <TableCell key={c.chave} className={c.tipo === "moeda" ? "text-right tabular-nums" : undefined}>
                        {j === 0 || c.chave === "numero" ? (
                          <Link href={l.href} className="hover:underline">
                            {formatar(c, l[c.chave])}
                          </Link>
                        ) : (
                          formatar(c, l[c.chave])
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              {linhas.length > 0 && (
                <TableFooter>
                  <TableRow>
                    {colunas.map((c, j) => (
                      <TableCell key={c.chave} className={c.tipo === "moeda" ? "text-right font-semibold tabular-nums" : undefined}>
                        {c.tipo === "moeda" ? moeda(total) : j === 0 ? "Total" : ""}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

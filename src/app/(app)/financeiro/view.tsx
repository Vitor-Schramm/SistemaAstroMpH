"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { normalizar } from "@/components/compras/filtro-lista";
import { selectClass } from "@/components/cadastros/registro-form";
import { cn } from "@/lib/utils";
import { data as fmtData, moeda } from "@/lib/format";
import { REGIMES, STATUS_OBRA } from "@/lib/cadastros/config";
import type { PainelObra } from "@/lib/painel";

const rotulo = (lista: { valor: string; rotulo: string }[], v: string) => lista.find((o) => o.valor === v)?.rotulo ?? v;

/** Barra de consumo da verba: pago / aportes. */
function Consumo({ pago, aportes }: { pago: number; aportes: number }) {
  if (!aportes) return <span className="text-xs text-muted-foreground">sem aportes</span>;
  const p = (pago / aportes) * 100;
  return (
    <div className="flex min-w-28 items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", p > 100 ? "bg-destructive" : p > 85 ? "bg-amber-500" : "bg-emerald-600")}
          style={{ width: `${Math.min(p, 100)}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs tabular-nums">{Math.round(p)}%</span>
    </div>
  );
}

export function FinanceiroView({ obras }: { obras: PainelObra[] }) {
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("ativas");
  const [regime, setRegime] = useState("");

  const filtradas = useMemo(() => {
    const q = normalizar(busca.trim());
    return obras.filter((o) => {
      if (situacao === "ativas" && !o.ativo) return false;
      if (situacao === "inativas" && o.ativo) return false;
      if (regime && o.regime !== regime) return false;
      return !q || normalizar([o.codigo, o.nome, o.cliente_nome, o.engenheiro, o.orcamentista, o.suprimento].join(" ")).includes(q);
    });
  }, [obras, busca, situacao, regime]);

  const soma = (k: keyof PainelObra) => filtradas.reduce((s, o) => s + Number(o[k] ?? 0), 0);
  const kpis = [
    { titulo: "Valor das obras", valor: soma("valor_total") },
    { titulo: "OCs aprovadas", valor: soma("ocs_aprovadas") },
    { titulo: "Aportes (verba alocada)", valor: soma("aportes") },
    { titulo: "Pago (Fase Cinza)", valor: soma("pago") },
    { titulo: "Verba disponível", valor: soma("disponivel"), alerta: soma("disponivel") < 0 },
    { titulo: "A pagar em aberto", valor: soma("a_pagar") },
    { titulo: "Fase Azul em guia", valor: soma("azul_em_guia") },
    { titulo: "Adm prevista", valor: soma("adm_prevista") },
  ];

  const exportar = () => {
    const esc = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const n = (v: unknown) => String(Number(v ?? 0)).replace(".", ",");
    const cab = ["Código", "Obra", "Cliente", "Ano", "Regime", "Status", "Início", "Término", "Entrega", "Engenheiro", "Orçamentista", "Suprimento", "Taxa adm fin. %", "Taxa adm orç. %", "Valor obra", "OCs aprovadas", "Aportes", "Pago", "Disponível", "A pagar", "Azul pendente guia", "Azul em guia", "Azul pago", "Adm prevista"];
    const csv = [
      cab.map(esc).join(";"),
      ...filtradas.map((o) =>
        [o.codigo, o.nome, o.cliente_nome, o.ano, rotulo(REGIMES, o.regime), rotulo(STATUS_OBRA, o.status), fmtData(o.inicio), fmtData(o.termino), fmtData(o.entrega_prevista), o.engenheiro, o.orcamentista, o.suprimento, n(o.taxa_adm_analise_financeira), n(o.taxa_adm_analise_orcamento), n(o.valor_total), n(o.ocs_aprovadas), n(o.aportes), n(o.pago), n(o.disponivel), n(o.a_pagar), n(o.azul_pendente_guia), n(o.azul_em_guia), n(o.azul_pago), n(o.adm_prevista)]
          .map(esc)
          .join(";"),
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: "dashboard-financeiro.csv" }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard Financeiro</h1>
          <p className="text-sm text-muted-foreground">{filtradas.length} obra(s) no filtro.</p>
        </div>
        <Button variant="outline" onClick={exportar}>
          <Download /> Exportar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.titulo}>
            <CardHeader>
              <CardDescription>{k.titulo}</CardDescription>
              <CardTitle className={cn("text-xl tabular-nums", k.alerta && "text-destructive")}>{moeda(k.valor)}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar obra, cliente, responsável…" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8" />
        </div>
        <select value={situacao} onChange={(e) => setSituacao(e.target.value)} className={`${selectClass} w-36`} aria-label="Situação">
          <option value="ativas">Ativas</option>
          <option value="inativas">Inativas</option>
          <option value="todas">Todas</option>
        </select>
        <select value={regime} onChange={(e) => setRegime(e.target.value)} className={`${selectClass} w-44`} aria-label="Regime">
          <option value="">Todos os regimes</option>
          {REGIMES.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.rotulo}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Obra</TableHead>
              <TableHead>Regime / status</TableHead>
              <TableHead>Prazos</TableHead>
              <TableHead>Equipe</TableHead>
              <TableHead className="text-right">Valor obra</TableHead>
              <TableHead className="text-right">OCs aprovadas</TableHead>
              <TableHead className="text-right">Aportes</TableHead>
              <TableHead className="text-right">Pago</TableHead>
              <TableHead>Consumo verba</TableHead>
              <TableHead className="text-right">Disponível</TableHead>
              <TableHead className="text-right">A pagar</TableHead>
              <TableHead className="text-right">Adm prevista</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                  Nenhuma obra no filtro.
                </TableCell>
              </TableRow>
            )}
            {filtradas.map((o) => (
              <TableRow key={o.obra_id}>
                <TableCell>
                  <div className="font-medium">
                    {o.codigo} — {o.nome}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[o.cliente_nome, o.ano, o.tipo_obra, o.metragem ? `${o.metragem} m²` : null].filter(Boolean).join(" · ")}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {rotulo(REGIMES, o.regime)}
                  <div className="text-xs text-muted-foreground">{rotulo(STATUS_OBRA, o.status)}</div>
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  {o.inicio && <div>Início {fmtData(o.inicio)}</div>}
                  {o.termino && <div>Término {fmtData(o.termino)}</div>}
                  {o.entrega_prevista && <div>Entrega {fmtData(o.entrega_prevista)}</div>}
                </TableCell>
                <TableCell className="text-xs">
                  {o.engenheiro && <div>Eng.: {o.engenheiro}</div>}
                  {o.orcamentista && <div>Orç.: {o.orcamentista}</div>}
                  {o.suprimento && <div>Supr.: {o.suprimento}</div>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{moeda(Number(o.valor_total ?? 0))}</TableCell>
                <TableCell className="text-right tabular-nums">{moeda(Number(o.ocs_aprovadas))}</TableCell>
                <TableCell className="text-right tabular-nums">{moeda(Number(o.aportes))}</TableCell>
                <TableCell className="text-right tabular-nums">{moeda(Number(o.pago))}</TableCell>
                <TableCell>
                  <Consumo pago={Number(o.pago)} aportes={Number(o.aportes)} />
                </TableCell>
                <TableCell className={cn("text-right font-medium tabular-nums", Number(o.disponivel) < 0 && "text-destructive")}>
                  {moeda(Number(o.disponivel))}
                </TableCell>
                <TableCell className="text-right tabular-nums">{moeda(Number(o.a_pagar))}</TableCell>
                <TableCell className="text-right tabular-nums">{moeda(Number(o.adm_prevista))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FiltroLista, normalizar } from "@/components/compras/filtro-lista";
import { StatusBadge } from "@/components/compras/status-badge";
import { dataHora } from "@/lib/format";
import { numeroMapa, numeroSolicitacao, STATUS_MAPA, TIPOS_MAPA } from "@/lib/compras/tipos";

export type LinhaMapa = {
  id: number;
  servico: string;
  status: string;
  tipo: string;
  solicitacao_id: number | null;
  criado_em: string;
  obra: { codigo: string; nome: string; cliente: { nome: string } | null } | null;
  itens: { count: number }[];
  fornecedores: { count: number }[];
};

export function ListaMapas({ linhas, podeComprar }: { linhas: LinhaMapa[]; podeComprar: boolean }) {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("aberto");

  const filtradas = useMemo(() => {
    const q = normalizar(busca.trim());
    return linhas.filter((l) => {
      if (status && l.status !== status) return false;
      if (!q) return true;
      return normalizar([numeroMapa(l.id), l.servico, l.obra?.codigo, l.obra?.nome, l.obra?.cliente?.nome].join(" ")).includes(q);
    });
  }, [linhas, busca, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mapas de cotação</h1>
          <p className="text-sm text-muted-foreground">
            {linhas.length} no total · {linhas.filter((l) => l.status === "aberto").length} aberto(s)
          </p>
        </div>
        {podeComprar && (
          <Button render={<Link href="/mapas/novo" />}>
            <Plus /> Novo mapa
          </Button>
        )}
      </div>

      <FiltroLista busca={busca} onBusca={setBusca} status={status} onStatus={setStatus} opcoesStatus={STATUS_MAPA} />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Solicitação</TableHead>
              <TableHead className="text-right">Itens</TableHead>
              <TableHead className="text-right">Fornecedores</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                  Nenhum mapa encontrado.
                </TableCell>
              </TableRow>
            )}
            {filtradas.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/mapas/${l.id}`} className="hover:underline">
                    {numeroMapa(l.id)}
                  </Link>
                </TableCell>
                <TableCell>{l.obra ? `${l.obra.codigo} — ${l.obra.nome}` : ""}</TableCell>
                <TableCell>{l.obra?.cliente?.nome}</TableCell>
                <TableCell className="max-w-56 truncate">{l.servico}</TableCell>
                <TableCell>{TIPOS_MAPA.find((t) => t.valor === l.tipo)?.rotulo}</TableCell>
                <TableCell className="font-mono text-xs">
                  {l.solicitacao_id && (
                    <Link href={`/solicitacoes/${l.solicitacao_id}`} className="hover:underline">
                      {numeroSolicitacao(l.solicitacao_id)}
                    </Link>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{l.itens?.[0]?.count ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">{l.fornecedores?.[0]?.count ?? 0}</TableCell>
                <TableCell className="whitespace-nowrap">{dataHora(l.criado_em)}</TableCell>
                <TableCell>
                  <StatusBadge mapa={STATUS_MAPA} valor={l.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

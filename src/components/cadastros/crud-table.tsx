"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Download, MoreHorizontal, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { data as fmtData, moeda } from "@/lib/format";
import { ENTIDADES, type Coluna, type Entidade } from "@/lib/cadastros/config";
import { alternarAtivo, excluirRegistro } from "@/lib/cadastros/actions";
import { RegistroForm, selectClass, type Opcoes, type Registro } from "./registro-form";

const POR_PAGINA = 25;

function textoCelula(entidade: Entidade, coluna: Coluna, r: Registro, opcoes: Opcoes): string {
  const v = r[coluna.campo];
  if (v == null || v === "") return "";
  switch (coluna.formato) {
    case "data":
      return fmtData(String(v));
    case "moeda":
      return moeda(Number(v));
    case "boolean":
      return v ? "Sim" : "Não";
    case "opcao":
      return entidade.campos.find((c) => c.nome === coluna.campo)?.opcoes?.find((o) => o.valor === v)?.rotulo ?? String(v);
    case "relacao": {
      const rel = entidade.campos.find((c) => c.nome === coluna.campo)?.relacao;
      return opcoes[rel ?? ""]?.find((o) => o.valor === String(v))?.rotulo ?? String(v);
    }
    default:
      return String(v);
  }
}

function exportarCsv(entidade: Entidade, linhas: Registro[], opcoes: Opcoes) {
  const cols = entidade.colunas;
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const csv = [
    [...cols.map((c) => c.rotulo), "Situação"].map(esc).join(";"),
    ...linhas.map((r) => [...cols.map((c) => textoCelula(entidade, c, r, opcoes)), r.ativo ? "Ativo" : "Inativo"].map(esc).join(";")),
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${entidade.chave}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

export function CrudTable({
  chave,
  registros,
  opcoes = {},
  podeEditar,
  podeExcluir,
  extraStatus,
  linkDetalhe,
}: {
  chave: string;
  registros: Registro[];
  opcoes?: Opcoes;
  podeEditar: boolean;
  podeExcluir: boolean;
  /** Ids com um selo extra de status (ex.: fornecedor bloqueado). */
  extraStatus?: Record<number, string>;
  /** Rota base da tela de detalhe: a primeira coluna vira link para `${linkDetalhe}/${id}`. */
  linkDetalhe?: string;
}) {
  const entidade = ENTIDADES[chave];
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"todos" | "ativos" | "inativos">("ativos");
  const [pagina, setPagina] = useState(0);
  const [editando, setEditando] = useState<Registro | null | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  const filtrados = useMemo(() => {
    const q = busca
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    return registros.filter((r) => {
      if (status === "ativos" && !r.ativo) return false;
      if (status === "inativos" && r.ativo) return false;
      if (!q) return true;
      return entidade.busca.some((c) =>
        String(r[c] ?? "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .includes(q),
      );
    });
  }, [registros, busca, status, entidade.busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const visiveis = filtrados.slice(paginaAtual * POR_PAGINA, (paginaAtual + 1) * POR_PAGINA);
  const ativos = registros.filter((r) => r.ativo).length;

  const fechar = useCallback(() => setEditando(undefined), []);

  const executar = (fn: () => Promise<void>, ok: string) =>
    startTransition(async () => {
      try {
        await fn();
        toast.success(ok);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{entidade.titulo}</h1>
          <p className="text-sm text-muted-foreground">
            {entidade.descricao} · {registros.length} no total, {ativos} ativos, {registros.length - ativos} inativos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportarCsv(entidade, filtrados, opcoes)}>
            <Download /> Exportar
          </Button>
          {podeEditar && (
            <Button onClick={() => setEditando(null)}>
              <Plus /> {entidade.feminino ? "Nova" : "Novo"} {entidade.singular.toLowerCase()}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar…"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(0);
            }}
            className="pl-8"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status);
            setPagina(0);
          }}
          className={`${selectClass} w-36`}
          aria-label="Filtrar por status"
        >
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
          <option value="todos">Todos</option>
        </select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {entidade.colunas.map((c) => (
                <TableHead key={c.campo}>{c.rotulo}</TableHead>
              ))}
              <TableHead>Situação</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.length === 0 && (
              <TableRow>
                <TableCell colSpan={entidade.colunas.length + 2} className="h-24 text-center text-muted-foreground">
                  Nenhum registro encontrado.
                </TableCell>
              </TableRow>
            )}
            {visiveis.map((r) => (
              <TableRow key={r.id} className={pending ? "opacity-60" : undefined}>
                {entidade.colunas.map((c, i) => (
                  <TableCell key={c.campo} className="max-w-64 truncate">
                    {linkDetalhe && i === 0 ? (
                      <Link href={`${linkDetalhe}/${r.id}`} className="font-medium text-primary hover:underline">
                        {textoCelula(entidade, c, r, opcoes)}
                      </Link>
                    ) : (
                      textoCelula(entidade, c, r, opcoes)
                    )}
                  </TableCell>
                ))}
                <TableCell className="space-x-1">
                  <Badge variant={r.ativo ? "secondary" : "outline"}>{r.ativo ? "Ativo" : "Inativo"}</Badge>
                  {extraStatus?.[r.id!] && <Badge variant="destructive">{extraStatus[r.id!]}</Badge>}
                </TableCell>
                <TableCell>
                  {podeEditar && (
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Ações" />}>
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditando(r)}>
                          <Pencil /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            executar(() => alternarAtivo(chave, r.id!, !r.ativo), r.ativo ? "Desativado." : "Ativado.")
                          }
                        >
                          <Power /> {r.ativo ? "Desativar" : "Ativar"}
                        </DropdownMenuItem>
                        {podeExcluir && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                if (confirm(`Excluir ${entidade.feminino ? "esta" : "este"} ${entidade.singular.toLowerCase()}? Essa ação não pode ser desfeita.`))
                                  executar(() => excluirRegistro(chave, r.id!), "Excluído.");
                              }}
                            >
                              <Trash2 /> Excluir
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">
            Página {paginaAtual + 1} de {totalPaginas} · {filtrados.length} registros
          </span>
          <Button variant="outline" size="sm" disabled={paginaAtual === 0} onClick={() => setPagina(paginaAtual - 1)}>
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={paginaAtual >= totalPaginas - 1}
            onClick={() => setPagina(paginaAtual + 1)}
          >
            Próxima
          </Button>
        </div>
      )}

      <Dialog open={editando !== undefined} onOpenChange={(o) => !o && fechar()}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editando ? `Editar ${entidade.singular.toLowerCase()}` : `${entidade.feminino ? "Nova" : "Novo"} ${entidade.singular.toLowerCase()}`}</DialogTitle>
            <DialogDescription>Campos com * são obrigatórios.</DialogDescription>
          </DialogHeader>
          {editando !== undefined && (
            <RegistroForm key={editando?.id ?? "novo"} entidade={entidade} registro={editando} opcoes={opcoes} onSalvo={fechar} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

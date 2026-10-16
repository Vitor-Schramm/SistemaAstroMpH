"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { moeda } from "@/lib/format";
import { num, type ItemCatalogo, type LinhaItem } from "@/lib/compras/tipos";

let seq = 0;
export const novaChave = () => `n${Date.now()}-${seq++}`;

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Grade de itens. `preco` define a coluna de valor: "medio" (solicitação/mapa) ou "unitario" (OC).
 * Com `titulo`, mostra a coluna de título/agrupador usada nas solicitações.
 */
export function ItensEditor({
  linhas,
  onChange,
  catalogo,
  preco,
  titulo = false,
  somenteLeitura = false,
}: {
  linhas: LinhaItem[];
  onChange: (l: LinhaItem[]) => void;
  catalogo: ItemCatalogo[];
  preco: "medio" | "unitario";
  titulo?: boolean;
  somenteLeitura?: boolean;
}) {
  const [busca, setBusca] = useState("");
  const campoPreco = preco === "medio" ? "valor_medio" : "valor_unitario";

  const sugestoes = useMemo(() => {
    const q = normalizar(busca.trim());
    if (q.length < 2) return [];
    return catalogo.filter((i) => normalizar(`${i.codigo} ${i.descricao}`).includes(q)).slice(0, 8);
  }, [busca, catalogo]);

  const atualizar = (chave: string, patch: Partial<LinhaItem>) =>
    onChange(linhas.map((l) => (l.chave === chave ? { ...l, ...patch } : l)));

  const adicionarDoCatalogo = (i: ItemCatalogo) => {
    onChange([
      ...linhas,
      {
        chave: novaChave(),
        item_id: i.id,
        codigo: i.codigo,
        descricao: i.descricao,
        unidade: i.unidade,
        quantidade: 1,
        [campoPreco]: i.valor_medio ?? "",
      },
    ]);
    setBusca("");
  };

  const adicionarLinha = () =>
    onChange([...linhas, { chave: novaChave(), descricao: "", quantidade: 1, unidade: "UN", [campoPreco]: "" }]);

  const total = linhas.reduce((s, l) => s + num(l.quantidade) * num(l[campoPreco]), 0);

  return (
    <div className="space-y-3">
      {!somenteLeitura && (
        <div className="flex flex-wrap items-start gap-2">
          <div className="relative min-w-72 flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar item do catálogo por código ou descrição…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-8"
              aria-label="Buscar item do catálogo"
            />
            {sugestoes.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
                {sugestoes.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => adicionarDoCatalogo(i)}
                      className="flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                    >
                      <span>
                        <span className="font-mono text-xs text-muted-foreground">{i.codigo}</span> {i.descricao}
                      </span>
                      <span className="text-xs text-muted-foreground">{i.unidade}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {busca.trim().length >= 2 && sugestoes.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Nenhum item no catálogo. Use “Adicionar linha” para digitar livremente.</p>
            )}
          </div>
          <Button type="button" variant="outline" onClick={adicionarLinha}>
            <Plus /> Adicionar linha
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              {titulo && <TableHead className="w-36 min-w-32">Título</TableHead>}
              <TableHead className="w-28 min-w-28">Cód.</TableHead>
              <TableHead className="min-w-64">Descrição</TableHead>
              <TableHead className="w-28 min-w-24">Qtde</TableHead>
              <TableHead className="w-24 min-w-20">Unid.</TableHead>
              <TableHead className="w-36 min-w-32">{preco === "medio" ? "Vl. médio" : "Vl. unitário"}</TableHead>
              <TableHead className="w-32 min-w-28 text-right">Subtotal</TableHead>
              {!somenteLeitura && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-16 text-center text-muted-foreground">
                  Nenhum item. Busque no catálogo ou adicione uma linha.
                </TableCell>
              </TableRow>
            )}
            {linhas.map((l, idx) => (
              <TableRow key={l.chave}>
                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                {titulo && (
                  <TableCell>
                    {somenteLeitura ? (
                      l.titulo
                    ) : (
                      <Input value={l.titulo ?? ""} onChange={(e) => atualizar(l.chave, { titulo: e.target.value })} aria-label="Título" />
                    )}
                  </TableCell>
                )}
                <TableCell>
                  {somenteLeitura || l.item_id ? (
                    <span className="font-mono text-xs">{l.codigo}</span>
                  ) : (
                    <Input value={l.codigo ?? ""} onChange={(e) => atualizar(l.chave, { codigo: e.target.value })} aria-label="Código" />
                  )}
                </TableCell>
                <TableCell>
                  {somenteLeitura || l.item_id ? (
                    l.descricao
                  ) : (
                    <Input
                      value={l.descricao}
                      onChange={(e) => atualizar(l.chave, { descricao: e.target.value })}
                      required
                      aria-label="Descrição"
                    />
                  )}
                </TableCell>
                <TableCell>
                  {somenteLeitura ? (
                    String(l.quantidade).replace(".", ",")
                  ) : (
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={l.quantidade}
                      onChange={(e) => atualizar(l.chave, { quantidade: e.target.value })}
                      required
                      aria-label="Quantidade"
                    />
                  )}
                </TableCell>
                <TableCell>
                  {somenteLeitura || l.item_id ? (
                    l.unidade
                  ) : (
                    <Input value={l.unidade} onChange={(e) => atualizar(l.chave, { unidade: e.target.value.toUpperCase() })} aria-label="Unidade" />
                  )}
                </TableCell>
                <TableCell>
                  {somenteLeitura ? (
                    moeda(num(l[campoPreco]))
                  ) : (
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={l[campoPreco] ?? ""}
                      onChange={(e) => atualizar(l.chave, { [campoPreco]: e.target.value })}
                      aria-label="Valor"
                    />
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{moeda(num(l.quantidade) * num(l[campoPreco]))}</TableCell>
                {!somenteLeitura && (
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remover item"
                      onClick={() => onChange(linhas.filter((x) => x.chave !== l.chave))}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
          {linhas.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={titulo ? 7 : 6} className="text-right font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{moeda(total)}</TableCell>
                {!somenteLeitura && <TableCell />}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}

/** Converte as linhas do editor no formato esperado pelas funções do banco. */
export function linhasParaPayload(linhas: LinhaItem[], preco: "medio" | "unitario") {
  return linhas.map((l) => ({
    id: l.id ?? "",
    titulo: l.titulo ?? "",
    item_id: l.item_id ?? null,
    codigo: l.codigo ?? "",
    descricao: l.descricao.trim(),
    quantidade: num(l.quantidade),
    unidade: l.unidade || "UN",
    ...(preco === "medio"
      ? { valor_medio: l.valor_medio === "" || l.valor_medio == null ? null : num(l.valor_medio) }
      : { valor_unitario: num(l.valor_unitario) }),
  }));
}

export function validarLinhas(linhas: LinhaItem[]): string | null {
  if (linhas.length === 0) return "Inclua ao menos um item.";
  for (const [i, l] of linhas.entries()) {
    if (!l.descricao.trim()) return `Item ${i + 1}: informe a descrição.`;
    if (num(l.quantidade) <= 0) return `Item ${i + 1}: quantidade deve ser maior que zero.`;
  }
  return null;
}

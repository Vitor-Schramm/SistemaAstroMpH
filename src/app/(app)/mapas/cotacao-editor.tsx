"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award, FileOutput, Plus, Save, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { selectClass } from "@/components/cadastros/registro-form";
import { cn } from "@/lib/utils";
import { moeda } from "@/lib/format";
import { gerarOcs, salvarCotacao } from "@/lib/compras/actions";
import { num, numeroOC, type Opcao } from "@/lib/compras/tipos";

export type ItemMapa = { id: number; descricao: string; codigo: string | null; quantidade: number; unidade: string; fornecedor_vencedor_id: number | null };
export type Participante = {
  fornecedor_id: number;
  nome: string;
  bloqueado: boolean;
  condicao_pagamento: string;
  prazo_entrega: string;
  frete: string;
  observacao: string;
};

const chavePreco = (itemId: number, fornId: number) => `${itemId}:${fornId}`;

export function CotacaoEditor({
  mapaId,
  itens,
  participantesIniciais,
  precosIniciais,
  fornecedores,
  editavel,
}: {
  mapaId: number;
  itens: ItemMapa[];
  participantesIniciais: Participante[];
  precosIniciais: Record<string, string>;
  fornecedores: (Opcao & { bloqueado: boolean })[];
  editavel: boolean;
}) {
  const router = useRouter();
  const [participantes, setParticipantes] = useState(participantesIniciais);
  const [precos, setPrecos] = useState(precosIniciais);
  const [vencedores, setVencedores] = useState<Record<number, number | null>>(
    Object.fromEntries(itens.map((i) => [i.id, i.fornecedor_vencedor_id])),
  );
  const [novo, setNovo] = useState("");
  const [pending, startTransition] = useTransition();

  const disponiveis = fornecedores.filter((f) => !participantes.some((p) => String(p.fornecedor_id) === f.valor));

  const preco = (itemId: number, fornId: number) => precos[chavePreco(itemId, fornId)] ?? "";
  const temPreco = (itemId: number, fornId: number) => preco(itemId, fornId) !== "";

  const menorPorItem = useMemo(() => {
    const r: Record<number, number | null> = {};
    for (const i of itens) {
      let melhor: { f: number; v: number } | null = null;
      for (const p of participantes) {
        if (!temPreco(i.id, p.fornecedor_id)) continue;
        const v = num(preco(i.id, p.fornecedor_id));
        if (!melhor || v < melhor.v) melhor = { f: p.fornecedor_id, v };
      }
      r[i.id] = melhor?.f ?? null;
    }
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, participantes, precos]);

  const totalFornecedor = (fornId: number) => {
    const p = participantes.find((x) => x.fornecedor_id === fornId);
    const itensCotados = itens.filter((i) => temPreco(i.id, fornId));
    return {
      total: itensCotados.reduce((s, i) => s + i.quantidade * num(preco(i.id, fornId)), 0) + num(p?.frete),
      cotados: itensCotados.length,
    };
  };

  const totalVencedores = itens.reduce((s, i) => {
    const f = vencedores[i.id];
    return f ? s + i.quantidade * num(preco(i.id, f)) : s;
  }, 0);

  const adicionar = () => {
    const f = fornecedores.find((x) => x.valor === novo);
    if (!f) return;
    if (f.bloqueado) toast.warning("Atenção: este fornecedor está bloqueado e não poderá vencer a cotação.");
    setParticipantes((ps) => [
      ...ps,
      { fornecedor_id: Number(f.valor), nome: f.rotulo.split(" — ")[0], bloqueado: f.bloqueado, condicao_pagamento: "", prazo_entrega: "", frete: "", observacao: "" },
    ]);
    setNovo("");
  };

  const remover = (fornId: number) => {
    setParticipantes((ps) => ps.filter((p) => p.fornecedor_id !== fornId));
    setVencedores((v) => Object.fromEntries(Object.entries(v).map(([k, f]) => [k, f === fornId ? null : f])));
  };

  const atualizarParticipante = (fornId: number, patch: Partial<Participante>) =>
    setParticipantes((ps) => ps.map((p) => (p.fornecedor_id === fornId ? { ...p, ...patch } : p)));

  const payload = () => {
    const precosPayload = itens.flatMap((i) =>
      participantes
        .filter((p) => temPreco(i.id, p.fornecedor_id))
        .map((p) => ({ mapa_item_id: i.id, fornecedor_id: p.fornecedor_id, valor_unitario: num(preco(i.id, p.fornecedor_id)) })),
    );
    const vencedoresPayload = itens
      .filter((i) => vencedores[i.id] && participantes.some((p) => p.fornecedor_id === vencedores[i.id]))
      .map((i) => ({ mapa_item_id: i.id, fornecedor_id: vencedores[i.id] }));
    const fornPayload = participantes.map((p) => ({
      fornecedor_id: p.fornecedor_id,
      condicao_pagamento: p.condicao_pagamento,
      prazo_entrega: p.prazo_entrega,
      frete: num(p.frete),
      observacao: p.observacao,
    }));
    return [fornPayload, precosPayload, vencedoresPayload] as const;
  };

  const salvar = (depois?: () => Promise<void>) =>
    startTransition(async () => {
      const r = await salvarCotacao(mapaId, ...payload());
      if (!r.ok) return void toast.error(r.erro);
      if (depois) await depois();
      else {
        toast.success("Cotação salva.");
        router.refresh();
      }
    });

  const gerar = () => {
    const semVencedor = itens.filter((i) => !vencedores[i.id]).length;
    if (semVencedor) return toast.error(`Defina o vencedor de todos os itens (${semVencedor} sem vencedor).`);
    const nForn = new Set(Object.values(vencedores)).size;
    if (!confirm(`Gerar ${nForn} ordem(ns) de compra e finalizar este mapa? Depois disso o mapa não pode mais ser editado.`)) return;
    salvar(async () => {
      const r = await gerarOcs(mapaId);
      if (!r.ok) return void toast.error(r.erro);
      toast.success(`OCs geradas: ${(r.ids ?? []).map(numeroOC).join(", ")}`);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Cotação</CardTitle>
          <CardDescription>
            Digite o preço unitário de cada fornecedor e marque o vencedor de cada item. O menor preço fica em verde.
          </CardDescription>
        </div>
        {editavel && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setVencedores({ ...menorPorItem })} disabled={!participantes.length}>
              <Award /> Escolher menor preço
            </Button>
            <Button variant="outline" size="sm" onClick={() => salvar()} disabled={pending}>
              <Save /> Salvar cotação
            </Button>
            <Button size="sm" onClick={gerar} disabled={pending || !participantes.length}>
              <FileOutput /> Gerar ordens de compra
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {editavel && (
          <div className="flex flex-wrap gap-2">
            <select value={novo} onChange={(e) => setNovo(e.target.value)} className={`${selectClass} max-w-md flex-1`} aria-label="Fornecedor a incluir">
              <option value="">Incluir fornecedor na cotação…</option>
              {disponiveis.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                  {f.bloqueado ? " (BLOQUEADO)" : ""}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={adicionar} disabled={!novo}>
              <Plus /> Incluir
            </Button>
          </div>
        )}

        {participantes.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum fornecedor na cotação ainda.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2 text-left font-medium">Item</th>
                  <th className="p-2 text-right font-medium">Qtde</th>
                  {participantes.map((p) => (
                    <th key={p.fornecedor_id} className="min-w-44 border-l p-2 text-left font-medium">
                      <div className="flex items-start justify-between gap-1">
                        <span className={cn(p.bloqueado && "text-destructive")}>
                          {p.nome}
                          {p.bloqueado && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-xs">
                              <TriangleAlert className="size-3" /> bloqueado
                            </span>
                          )}
                        </span>
                        {editavel && (
                          <button type="button" onClick={() => remover(p.fornecedor_id)} aria-label={`Remover ${p.nome}`} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itens.map((i) => (
                  <tr key={i.id} className="border-b">
                    <td className="p-2">
                      <div>{i.descricao}</div>
                      {i.codigo && <div className="font-mono text-xs text-muted-foreground">{i.codigo}</div>}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap tabular-nums">
                      {String(i.quantidade).replace(".", ",")} {i.unidade}
                    </td>
                    {participantes.map((p) => {
                      const menor = menorPorItem[i.id] === p.fornecedor_id;
                      const venc = vencedores[i.id] === p.fornecedor_id;
                      const v = preco(i.id, p.fornecedor_id);
                      return (
                        <td key={p.fornecedor_id} className={cn("border-l p-2", menor && "bg-emerald-50 dark:bg-emerald-950/30", venc && "ring-2 ring-primary ring-inset")}>
                          <div className="flex items-center gap-2">
                            {editavel ? (
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={v}
                                placeholder="—"
                                onChange={(e) => setPrecos((ps) => ({ ...ps, [chavePreco(i.id, p.fornecedor_id)]: e.target.value }))}
                                className="h-8"
                                aria-label={`Preço de ${p.nome} para ${i.descricao}`}
                              />
                            ) : (
                              <span className="tabular-nums">{v === "" ? "—" : moeda(num(v))}</span>
                            )}
                            <input
                              type="radio"
                              name={`venc-${i.id}`}
                              checked={venc}
                              disabled={!editavel || v === "" || p.bloqueado}
                              onChange={() => setVencedores((vs) => ({ ...vs, [i.id]: p.fornecedor_id }))}
                              className="size-4 accent-primary"
                              aria-label={`Vencedor: ${p.nome}`}
                            />
                          </div>
                          {v !== "" && <div className="mt-1 text-xs text-muted-foreground tabular-nums">{moeda(i.quantidade * num(v))}</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30">
                {(
                  [
                    ["frete", "Frete (R$)", "number"],
                    ["condicao_pagamento", "Condição de pagamento", "text"],
                    ["prazo_entrega", "Prazo de entrega", "text"],
                  ] as const
                ).map(([campo, rotulo, tipo]) => (
                  <tr key={campo} className="border-b">
                    <td className="p-2 text-muted-foreground" colSpan={2}>
                      {rotulo}
                    </td>
                    {participantes.map((p) => (
                      <td key={p.fornecedor_id} className="border-l p-2">
                        {editavel ? (
                          <Input
                            type={tipo}
                            step={tipo === "number" ? "0.01" : undefined}
                            value={p[campo]}
                            onChange={(e) => atualizarParticipante(p.fornecedor_id, { [campo]: e.target.value })}
                            className="h-8"
                            aria-label={`${rotulo} de ${p.nome}`}
                          />
                        ) : campo === "frete" ? (
                          moeda(num(p.frete))
                        ) : (
                          p[campo] || "—"
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td className="p-2 font-medium" colSpan={2}>
                    Total do fornecedor
                  </td>
                  {participantes.map((p) => {
                    const t = totalFornecedor(p.fornecedor_id);
                    return (
                      <td key={p.fornecedor_id} className="border-l p-2">
                        <div className="font-semibold tabular-nums">{moeda(t.total)}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.cotados}/{itens.length} itens cotados
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {participantes.length > 0 && (
          <p className="text-right text-sm">
            Total dos vencedores (sem frete): <span className="font-semibold tabular-nums">{moeda(totalVencedores)}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

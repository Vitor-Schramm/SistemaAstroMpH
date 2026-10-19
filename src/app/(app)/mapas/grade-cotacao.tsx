"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { gerarPedido, salvarCotacao } from "@/lib/mapas/actions";

// Modal "Cotações" do AstroTools: uma coluna por fornecedor com o preço unitário de cada item,
// Frete, Impostos, Desconto, Total Individual, Cond Pagto, Prazo de Entrega, Observações,
// Melhor Preço e o botão Gerar Pedido. No modo "parcial" (Pedido Parcial) há a coluna Check.

export type ItemCotacao = { id: number; descricao: string; unidade: string; quantidade: number; orcamento: number; e_titulo: boolean; comPedido: boolean };
export type FornecedorMapa = {
  fornecedor_id: number;
  nome: string;
  frete: number;
  impostos: number;
  desconto: number;
  condicao_pagamento: string;
  prazo_entrega: string;
  observacao: string;
};

const n2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const lerNumero = (s: string) => {
  const t = s.trim();
  if (!t) return 0;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : NaN;
};

const th = "border-b border-[#ebe9f1] bg-muted px-[1rem] py-[0.72rem] text-left align-top text-[0.857rem] font-bold tracking-[0.5px] text-[#22292f] uppercase dark:text-heading";
const td = "border-b border-border px-[1rem] py-[0.6rem] align-middle";
const inputCls = "w-full min-w-[6rem] bg-transparent outline-none focus:bg-[#f8f8f8] dark:focus:bg-[#283046]";

export function GradeCotacao({
  mapaId,
  itens,
  fornecedores,
  precos: precosIniciais,
  modo,
  podeCotar,
  editavel,
  onFechar,
  onPdf,
}: {
  mapaId: number;
  itens: ItemCotacao[];
  fornecedores: FornecedorMapa[];
  precos: Record<string, number>;
  modo: "total" | "parcial";
  podeCotar: boolean;
  editavel: boolean;
  onFechar: () => void;
  onPdf: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const chave = (i: number, f: number) => `${i}-${f}`;
  const [precos, setPrecos] = useState<Record<string, string>>(() =>
    Object.fromEntries(itens.flatMap((i) => fornecedores.map((f) => [chave(i.id, f.fornecedor_id), precosIniciais[chave(i.id, f.fornecedor_id)] ? n2(precosIniciais[chave(i.id, f.fornecedor_id)]) : ""]))),
  );
  const [forn, setForn] = useState(() =>
    Object.fromEntries(
      fornecedores.map((f) => [
        f.fornecedor_id,
        { frete: n2(f.frete), impostos: n2(f.impostos), desconto: n2(f.desconto), condicao_pagamento: f.condicao_pagamento, prazo_entrega: f.prazo_entrega, observacao: f.observacao },
      ]),
    ),
  );
  const [marcados, setMarcados] = useState<number[]>([]);
  const cotaveis = itens.filter((i) => !i.e_titulo);
  const podeEditar = modo === "total" && podeCotar && editavel;

  const unit = (i: number, f: number) => lerNumero(precos[chave(i, f)] ?? "") || 0;
  const subtotal = (f: number) => cotaveis.reduce((s, i) => s + i.quantidade * unit(i.id, f), 0);
  const extra = (f: number, k: "frete" | "impostos" | "desconto") => lerNumero(forn[f]?.[k] ?? "") || 0;
  const total = (f: number) => subtotal(f) + extra(f, "frete") + extra(f, "impostos") - extra(f, "desconto");
  const menor = (vals: number[]) => {
    const v = vals.filter((x) => x > 0);
    return v.length ? Math.min(...v) : 0;
  };

  const atualizar = () => {
    const precosEnvio: { mapa_item_id: number; fornecedor_id: number; valor_unitario: number }[] = [];
    for (const i of cotaveis)
      for (const f of fornecedores) {
        const v = lerNumero(precos[chave(i.id, f.fornecedor_id)] ?? "");
        if (Number.isNaN(v)) return void toast.error(`Valor inválido em "${i.descricao}" / ${f.nome}.`);
        precosEnvio.push({ mapa_item_id: i.id, fornecedor_id: f.fornecedor_id, valor_unitario: v });
      }
    const fornEnvio = fornecedores.map((f) => {
      const x = forn[f.fornecedor_id];
      return {
        fornecedor_id: f.fornecedor_id,
        frete: lerNumero(x.frete) || 0,
        impostos: lerNumero(x.impostos) || 0,
        desconto: lerNumero(x.desconto) || 0,
        condicao_pagamento: x.condicao_pagamento,
        prazo_entrega: x.prazo_entrega,
        observacao: x.observacao,
      };
    });
    startTransition(async () => {
      const r = await salvarCotacao(mapaId, fornEnvio, precosEnvio);
      if (!r.ok) return void toast.error(r.erro);
      toast.success("Cotação atualizada.");
      router.refresh();
    });
  };

  const gerar = (f: FornecedorMapa) => {
    const itensPedido = modo === "parcial" ? marcados : null;
    if (modo === "parcial" && !marcados.length) return void toast.warning("Por favor, selecione pelo menos um item válido!");
    if (!confirm(`Confirma a geração do pedido? Fornecedor: ${f.nome}`)) return;
    startTransition(async () => {
      const r = await gerarPedido(mapaId, f.fornecedor_id, itensPedido);
      if (!r.ok) return void toast.error(r.erro);
      toast.success(`Pedido gerado para ${f.nome}.`);
      onFechar();
      router.refresh();
    });
  };

  const linhaTexto = (rotulo: string, k: "condicao_pagamento" | "prazo_entrega" | "observacao") => (
    <tr>
      {modo === "parcial" && <td className={td} />}
      <td className={cn(td, "font-semibold")}>{rotulo}</td>
      <td className={td} />
      <td className={td} />
      <td className={td} />
      {fornecedores.map((f) => (
        <td key={f.fornecedor_id} className={td}>
          {podeEditar ? (
            <input
              value={forn[f.fornecedor_id]?.[k] ?? ""}
              onChange={(e) => setForn({ ...forn, [f.fornecedor_id]: { ...forn[f.fornecedor_id], [k]: e.target.value } })}
              className={inputCls}
              aria-label={`${rotulo} ${f.nome}`}
            />
          ) : (
            forn[f.fornecedor_id]?.[k]
          )}
        </td>
      ))}
      <td className={td} />
    </tr>
  );

  const linhaValor = (rotulo: string, k: "frete" | "impostos" | "desconto") => (
    <tr>
      {modo === "parcial" && <td className={td} />}
      <td className={cn(td, "font-semibold")}>{rotulo}</td>
      <td className={td} />
      <td className={td} />
      <td className={td} />
      {fornecedores.map((f) => (
        <td key={f.fornecedor_id} className={td}>
          {podeEditar ? (
            <input
              value={forn[f.fornecedor_id]?.[k] ?? ""}
              onChange={(e) => setForn({ ...forn, [f.fornecedor_id]: { ...forn[f.fornecedor_id], [k]: e.target.value } })}
              className={inputCls}
              inputMode="decimal"
              aria-label={`${rotulo} ${f.nome}`}
            />
          ) : (
            n2(extra(f.fornecedor_id, k))
          )}
        </td>
      ))}
      <td className={td}>{n2(fornecedores.length ? Math.min(...fornecedores.map((f) => extra(f.fornecedor_id, k))) : 0)}</td>
    </tr>
  );

  return (
    <div>
      <div className="mb-[1rem] flex gap-[0.5rem]">
        {modo === "total" && (
          <Button onClick={atualizar} disabled={!podeEditar || pending}>
            Atualizar Cotação
          </Button>
        )}
        <Button variant="outline" onClick={onFechar}>
          Voltar
        </Button>
        {modo === "total" && (
          <Button variant="outline" onClick={onPdf}>
            PDF
          </Button>
        )}
      </div>
      {fornecedores.length === 0 ? (
        <p className="py-[2rem] text-center">Nenhum fornecedor incluído no mapa. Use o botão &quot;Fornecedores&quot;.</p>
      ) : (
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full text-[1rem]">
            <thead className="sticky top-0 z-10">
              <tr>
                {modo === "parcial" && <th className={th} />}
                <th className={th} />
                <th className={th} />
                <th className={th} />
                <th className={th} />
                {fornecedores.map((f) => (
                  <th key={f.fornecedor_id} className={cn(th, "bg-[#d3d3d3] dark:bg-[#4b5265]")}>
                    {f.fornecedor_id}
                  </th>
                ))}
                <th className={th} />
              </tr>
              <tr>
                {modo === "parcial" && <th className={th}>Check</th>}
                <th className={th}>Item</th>
                <th className={th}>Und</th>
                <th className={th}>Qtde.</th>
                <th className={th}>Orçamento</th>
                {fornecedores.map((f) => (
                  <th key={f.fornecedor_id} className={cn(th, "max-w-[9rem] bg-[#d3d3d3] dark:bg-[#4b5265]")}>
                    {f.nome}
                  </th>
                ))}
                <th className={cn(th, "bg-[#d3d3d3] dark:bg-[#4b5265]")}>Melhor Preço</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.id} className={cn(i.e_titulo && "font-semibold")}>
                  {modo === "parcial" && (
                    <td className={td}>
                      {!i.e_titulo && (
                        <input
                          type="checkbox"
                          disabled={i.comPedido}
                          checked={i.comPedido || marcados.includes(i.id)}
                          onChange={(e) => setMarcados((m) => (e.target.checked ? [...m, i.id] : m.filter((x) => x !== i.id)))}
                          className="size-[16px] accent-primary"
                          aria-label={`Selecionar ${i.descricao}`}
                        />
                      )}
                    </td>
                  )}
                  <td className={td}>{i.descricao}</td>
                  <td className={td}>{i.e_titulo ? "" : i.unidade}</td>
                  <td className={td}>{i.e_titulo ? "" : n2(i.quantidade)}</td>
                  <td className={td}>{i.e_titulo ? "" : n2(i.orcamento)}</td>
                  {fornecedores.map((f) => (
                    <td key={f.fornecedor_id} className={td}>
                      {i.e_titulo ? null : podeEditar ? (
                        <input
                          value={precos[chave(i.id, f.fornecedor_id)] ?? ""}
                          onChange={(e) => setPrecos({ ...precos, [chave(i.id, f.fornecedor_id)]: e.target.value })}
                          className={inputCls}
                          inputMode="decimal"
                          placeholder="0,00"
                          aria-label={`Preço ${i.descricao} ${f.nome}`}
                        />
                      ) : (
                        n2(unit(i.id, f.fornecedor_id))
                      )}
                    </td>
                  ))}
                  <td className={td}>{i.e_titulo ? "" : n2(menor(fornecedores.map((f) => unit(i.id, f.fornecedor_id))))}</td>
                </tr>
              ))}
              {linhaValor("Frete", "frete")}
              {linhaValor("Impostos", "impostos")}
              {linhaValor("Desconto", "desconto")}
              <tr className="font-semibold">
                {modo === "parcial" && <td className={td} />}
                <td className={td}>Total Individual</td>
                <td className={td} />
                <td className={td} />
                <td className={td}>{n2(cotaveis.reduce((s, i) => s + i.orcamento, 0))}</td>
                {fornecedores.map((f) => (
                  <td key={f.fornecedor_id} className={td}>
                    {n2(total(f.fornecedor_id))}
                  </td>
                ))}
                <td className={td}>{n2(menor(fornecedores.map((f) => total(f.fornecedor_id))))}</td>
              </tr>
              {linhaTexto("Cond Pagto", "condicao_pagamento")}
              {linhaTexto("Prazo de Entrega", "prazo_entrega")}
              {linhaTexto("Observações", "observacao")}
              <tr>
                {modo === "parcial" && <td className={td} />}
                <td className={td} />
                <td className={td} />
                <td className={td} />
                <td className={td} />
                {fornecedores.map((f) => (
                  <Fragment key={f.fornecedor_id}>
                    <td className={cn(td, "text-center")}>
                      <button
                        type="button"
                        disabled={pending || !podeCotar}
                        onClick={() => gerar(f)}
                        className="rounded-[0.358rem] bg-[#ff9f43] px-[1rem] py-[0.4rem] text-[0.9rem] leading-tight text-white disabled:opacity-60"
                      >
                        {modo === "parcial" ? "Gerar Pedido Itens" : "Gerar Pedido"}
                      </button>
                    </td>
                  </Fragment>
                ))}
                <td className={td} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

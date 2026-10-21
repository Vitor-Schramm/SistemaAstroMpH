"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Cartao, Campo } from "@/components/astro/basicos";
import { BuscaItens, cabecalho, celula, editavelCls } from "@/components/astro/itens";
import { selectClass } from "@/components/cadastros/registro-form";
import { cn } from "@/lib/utils";
import type { ItemCatalogo } from "@/lib/compras/tipos";
import { criarOcDireta, type DadosOcDireta, type ItemOcDireta } from "@/lib/ocs/actions";

// "Nova Ordem de Compra" do AstroTools (Suprimentos): OC direta, sem mapa. Depois de salva abre a "Vizualizar Ordem".

type Opcao = { valor: string; rotulo: string };
type Linha = { chave: string; e_titulo: boolean; item_id: number | null; codigo: string; descricao: string; quantidade: string; unidade: string; valor_unitario: string; valor_impostos: string; valor_medio: number | null };

const TIPOS = [
  { valor: "compra", rotulo: "Compra de Materias" },
  { valor: "locacao", rotulo: "Serviço de Locação" },
  { valor: "servico", rotulo: "Serviço" },
];
const n2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numero = (s: string) => {
  const t = s.replace(/R\$/g, "").trim();
  if (!t) return 0;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : NaN;
};
const vlMedio = (v: number | null) => (v == null ? "N/A" : `R$ ${v.toFixed(2).replace(".", ",")}`);
let seq = 0;
const novaChave = () => `n${++seq}`;
const VAZIO: DadosOcDireta = {
  obra_id: "",
  filial_cliente_id: "",
  fornecedor_id: "",
  nome: "",
  numero_cliente: "",
  percentual_especial: "",
  observacao: "",
  tipo: "",
  data_entrega: "",
  prazo_locacao: "",
  data_devolucao: "",
  forma_pagamento: "",
  prazo: "",
  frete: "",
  desconto: "",
};

export function NovaOc({ obras, filiais, fornecedores, catalogo }: { obras: Opcao[]; filiais: Record<string, Opcao[]>; fornecedores: Opcao[]; catalogo: ItemCatalogo[] }) {
  const router = useRouter();
  const [d, setD] = useState<DadosOcDireta>(VAZIO);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [ativa, setAtiva] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const campo = (k: keyof DadosOcDireta) => ({ value: d[k], onChange: (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value })) });
  const inserir = (l: Linha) =>
    setLinhas((ls) => {
      const i = ativa ? ls.findIndex((x) => x.chave === ativa) : -1;
      return i < 0 ? [...ls, l] : [...ls.slice(0, i + 1), l, ...ls.slice(i + 1)];
    });
  const mudar = (chave: string, p: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...p } : l)));
  const totalLinha = (l: Linha) => (l.e_titulo ? 0 : (numero(l.quantidade) || 0) * (numero(l.valor_unitario) || 0) + (numero(l.valor_impostos) || 0));
  const total = linhas.reduce((s, l) => s + totalLinha(l), 0) + (numero(d.frete) || 0) - (numero(d.desconto) || 0);

  const salvar = () => {
    const itens: ItemOcDireta[] = [];
    for (const l of linhas) {
      if (!l.descricao.trim()) continue;
      const q = numero(l.quantidade);
      const u = numero(l.valor_unitario);
      const imp = numero(l.valor_impostos);
      if ([q, u, imp].some(Number.isNaN)) return void toast.error(`Valor inválido no item "${l.descricao}".`);
      itens.push({ e_titulo: l.e_titulo, item_id: l.item_id, codigo: l.codigo, descricao: l.descricao.trim(), quantidade: q, unidade: l.unidade.trim(), valor_unitario: u, valor_impostos: imp });
    }
    const dados = { ...d, frete: String(numero(d.frete) || 0), desconto: String(numero(d.desconto) || 0), percentual_especial: d.percentual_especial ? String(numero(d.percentual_especial)) : "" };
    startTransition(async () => {
      const r = await criarOcDireta(dados, itens);
      if (!r.ok) return void toast.error(r.erro);
      toast.success("Ordem de compra criada.");
      router.push(`/ordens-compra/${r.id}`);
    });
  };

  return (
    <Cartao>
      <div className="border-b border-border px-[1.5rem] py-[1.5rem]">
        <h4 className="mb-0 text-[1.285rem] font-medium">Nova Ordem de Compra</h4>
      </div>
      <div className="px-[1.5rem] pt-[1.5rem]">
        <div className="grid gap-x-[2rem] md:grid-cols-3">
          <Campo rotulo="Obra" htmlFor="n-obra">
            <select id="n-obra" value={d.obra_id} onChange={(e) => setD((x) => ({ ...x, obra_id: e.target.value, filial_cliente_id: "" }))} className={selectClass}>
              <option value="">Selecione uma Obra</option>
              {obras.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Filial" htmlFor="n-filial">
            <select id="n-filial" {...campo("filial_cliente_id")} className={selectClass}>
              <option value="">{d.obra_id ? "Selecione uma Filial" : ""}</option>
              {(filiais[d.obra_id] ?? []).map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Fornecedor" htmlFor="n-forn">
            <select id="n-forn" {...campo("fornecedor_id")} className={selectClass}>
              <option value="">Selecione</option>
              {fornecedores.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <div className="grid gap-x-[2rem] md:grid-cols-[6fr_2fr_2fr]">
          <Campo rotulo="Nome da Ordem" htmlFor="n-nome">
            <Input id="n-nome" {...campo("nome")} />
          </Campo>
          <Campo rotulo="Numero Cliente" htmlFor="n-num">
            <Input id="n-num" inputMode="numeric" placeholder="Automático" {...campo("numero_cliente")} />
          </Campo>
          <Campo rotulo="% Especial" htmlFor="n-pct">
            <Input id="n-pct" inputMode="decimal" {...campo("percentual_especial")} />
          </Campo>
        </div>
        <Campo rotulo="Observação" htmlFor="n-obs">
          <Textarea id="n-obs" rows={3} {...campo("observacao")} />
        </Campo>
        <div className="grid gap-x-[2rem] md:grid-cols-4">
          <Campo rotulo="Serviço" htmlFor="n-tipo">
            <select id="n-tipo" {...campo("tipo")} className={selectClass}>
              <option value="">Selecione</option>
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Data de Entrega" htmlFor="n-ent">
            <Input id="n-ent" type="date" {...campo("data_entrega")} />
          </Campo>
          <Campo rotulo="Prazo de Locação" htmlFor="n-loc">
            <Input id="n-loc" {...campo("prazo_locacao")} />
          </Campo>
          <Campo rotulo="Data de Devolução" htmlFor="n-dev">
            <Input id="n-dev" type="date" {...campo("data_devolucao")} />
          </Campo>
        </div>
        <div className="grid gap-x-[2rem] md:grid-cols-5">
          <Campo rotulo="Forma Pagamento" htmlFor="n-pag">
            <Input id="n-pag" {...campo("forma_pagamento")} />
          </Campo>
          <Campo rotulo="Prazo" htmlFor="n-prazo">
            <Input id="n-prazo" {...campo("prazo")} />
          </Campo>
          <Campo rotulo="Frete" htmlFor="n-frete">
            <Input id="n-frete" inputMode="decimal" {...campo("frete")} />
          </Campo>
          <Campo rotulo="Desconto" htmlFor="n-desc">
            <Input id="n-desc" inputMode="decimal" {...campo("desconto")} />
          </Campo>
          <Campo rotulo="Total" htmlFor="n-total">
            <Input id="n-total" readOnly value={n2(total)} />
          </Campo>
        </div>
      </div>
      <div className="flex justify-end gap-[0.3rem] border-t border-border px-[1.5rem] py-[1rem]">
        <Button onClick={salvar} disabled={pending}>
          Salvar
        </Button>
        <Button variant="outline" onClick={() => router.back()}>
          cancelar
        </Button>
      </div>
      <div className="px-[1.5rem] pt-[0.5rem] pb-[2.5rem]">
        <div className="mb-[1rem] space-y-[1rem]">
          <BuscaItens
            catalogo={catalogo}
            onAdicionar={(c) =>
              inserir({ chave: novaChave(), e_titulo: false, item_id: c.id, codigo: c.codigo, descricao: c.descricao, quantidade: "0", unidade: c.unidade, valor_unitario: "0,00", valor_impostos: "0,00", valor_medio: c.valor_medio })
            }
          />
          <Button
            variant="outline"
            onClick={() =>
              inserir({ chave: novaChave(), e_titulo: false, item_id: null, codigo: "0", descricao: "", quantidade: "0", unidade: "", valor_unitario: "0,00", valor_impostos: "0,00", valor_medio: null })
            }
          >
            Adicionar Linha
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[1rem]">
            <thead>
              <tr>
                {["Titulo", "Cod", "Item", "Qtde", "Unid.Med", "Vl.Unitário", "Vl.Total", "Vl.Impostos", "Vl.Médio", "Del."].map((c) => (
                  <th key={c} className={cabecalho}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={10} className={cn(celula, "text-center")}>
                    Nenhum item adicionado
                  </td>
                </tr>
              )}
              {linhas.map((l) => {
                const livre = l.item_id == null;
                return (
                  <tr key={l.chave} onClick={() => setAtiva(l.chave)} className={cn(ativa === l.chave && "bg-[#f3f2f7] dark:bg-[#242b3d]", l.e_titulo && "font-semibold")}>
                    <td className={cn(celula, "text-center")}>
                      <input type="checkbox" checked={l.e_titulo} disabled={!livre} onChange={(e) => mudar(l.chave, { e_titulo: e.target.checked })} className="size-[14px] accent-primary" aria-label="Título" />
                    </td>
                    <td className={celula}>{l.codigo}</td>
                    <td className={cn(celula, "min-w-[14rem]")}>
                      {livre ? <input value={l.descricao} onChange={(e) => mudar(l.chave, { descricao: e.target.value })} className={editavelCls} aria-label="Item" /> : l.descricao}
                    </td>
                    {(["quantidade", "unidade", "valor_unitario"] as const).map((k) => (
                      <td key={k} className={cn(celula, "min-w-[6rem]")}>
                        {l.e_titulo || (k === "unidade" && !livre) ? (l.e_titulo ? "" : l[k]) : <input value={l[k]} onChange={(e) => mudar(l.chave, { [k]: e.target.value })} className={editavelCls} aria-label={k} />}
                      </td>
                    ))}
                    <td className={cn(celula, "whitespace-nowrap")}>{l.e_titulo ? "" : n2(totalLinha(l))}</td>
                    <td className={cn(celula, "min-w-[6rem]")}>
                      {l.e_titulo ? "" : <input value={l.valor_impostos} onChange={(e) => mudar(l.chave, { valor_impostos: e.target.value })} className={editavelCls} aria-label="Impostos" />}
                    </td>
                    <td className={cn(celula, "whitespace-nowrap")}>{vlMedio(l.valor_medio)}</td>
                    <td className={celula}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLinhas((ls) => ls.filter((x) => x.chave !== l.chave));
                        }}
                        className="rounded-[0.358rem] bg-[#ea5455] px-[0.9rem] py-[0.3rem] text-[0.857rem] text-white"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Cartao>
  );
}

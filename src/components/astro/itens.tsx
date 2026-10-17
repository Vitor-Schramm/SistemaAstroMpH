"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo } from "@/components/astro/basicos";
import { selectClass } from "@/components/cadastros/registro-form";
import { cn } from "@/lib/utils";
import type { ItemCatalogo } from "@/lib/compras/tipos";

// Peças da edição de itens comuns a Solicitação e Mapa: busca no catálogo e modal de Apropriações.

export type Resultado = { ok: true; id?: number } | { ok: false; erro: string };
export type Apropriacao = { id: number; cc_codigo: string; cc_descricao: string };
export type CcSaldo = { id: number; codigo: string; descricao: string; saldo: number };

const n2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const celula = "border border-[#ebe9f1] px-[1.5rem] py-[0.72rem] align-middle dark:border-[#3b4253]";
export const cabecalho = "border border-[#ebe9f1] bg-muted px-[1.5rem] py-[0.72rem] text-left text-[0.857rem] font-bold tracking-[0.5px] text-[#22292f] uppercase dark:border-[#3b4253] dark:text-heading";
export const editavelCls = "w-full bg-transparent outline-none focus:bg-[#f8f8f8] dark:focus:bg-[#283046]";

export function BuscaItens({ catalogo, onAdicionar }: { catalogo: ItemCatalogo[]; onAdicionar: (i: ItemCatalogo) => void }) {
  const [texto, setTexto] = useState("");
  const [escolhido, setEscolhido] = useState<ItemCatalogo | null>(null);
  const [aberto, setAberto] = useState(false);
  const sugestoes = useMemo(() => {
    const q = texto
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    if (!q) return [];
    return catalogo
      .filter((c) =>
        `${c.codigo}-${c.descricao}`
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .includes(q),
      )
      .slice(0, 15);
  }, [texto, catalogo]);

  return (
    <div className="grid items-start gap-[1.5rem] md:grid-cols-[6.5rem_1fr_6.5rem_auto]">
      <Input value={escolhido?.codigo ?? ""} disabled aria-label="Código do item" />
      <div className="relative">
        <Input
          value={texto}
          placeholder="Busca de Itens"
          onChange={(e) => {
            setTexto(e.target.value);
            setEscolhido(null);
            setAberto(true);
          }}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          onFocus={() => setAberto(true)}
        />
        {aberto && sugestoes.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-[0.357rem] border border-input bg-card shadow-[0_4px_24px_0_rgba(34,41,47,0.1)]">
            {sugestoes.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="w-full px-[1rem] py-[0.4rem] text-left hover:bg-primary hover:text-white"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setEscolhido(c);
                    setTexto(c.descricao);
                    setAberto(false);
                  }}
                >
                  {c.codigo}-{c.descricao}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Input value={escolhido?.unidade ?? ""} disabled aria-label="Unidade do item" />
      <Button
        variant="outline"
        onClick={() => {
          if (!escolhido) return;
          onAdicionar(escolhido);
          setEscolhido(null);
          setTexto("");
        }}
      >
        Adicionar Item
      </Button>
    </div>
  );
}

export function ModalApropriacao({
  linha,
  ccs,
  podeEditar,
  onApropriar,
  onExcluir,
  onFechar,
}: {
  linha: { id?: number; descricao: string; bloqueado: boolean; apropriacoes: Apropriacao[] };
  ccs: CcSaldo[];
  podeEditar: boolean;
  onApropriar: (itemId: number, ccId: number) => Promise<Resultado>;
  onExcluir: (apropriacaoId: number) => Promise<Resultado>;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [cc, setCc] = useState("");
  const [busca, setBusca] = useState("");
  const [pending, startTransition] = useTransition();
  const filtrados = ccs.filter((c) => `${c.codigo} ${c.descricao}`.toLowerCase().includes(busca.trim().toLowerCase()));

  const rodar = (fn: () => Promise<Resultado>, ok: string) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.erro);
      toast.success(ok);
      setCc("");
      router.refresh();
    });

  return (
    <div>
      <Campo rotulo="Item:" htmlFor="ap-item">
        <Input id="ap-item" value={linha.descricao} readOnly disabled />
      </Campo>
      {podeEditar && !linha.bloqueado && (
        <>
          <Campo rotulo="Centro de Custo:" htmlFor="ap-cc">
            <Input placeholder="Filtrar centro de custo…" value={busca} onChange={(e) => setBusca(e.target.value)} className="mb-[0.5rem]" />
            <select id="ap-cc" value={cc} onChange={(e) => setCc(e.target.value)} className={selectClass}>
              <option value="">Selecione</option>
              {filtrados.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} - {c.descricao} | Saldo: {n2(c.saldo)}
                </option>
              ))}
            </select>
            {ccs.length === 0 && <p className="mt-1 text-[0.857rem] text-[#ea5455]">A obra não tem planilha de centros de custo importada.</p>}
          </Campo>
          <div className="mb-[1rem] flex gap-[0.5rem]">
            <Button disabled={pending || !cc} onClick={() => rodar(() => onApropriar(linha.id!, Number(cc)), "Item apropriado.")}>
              Adicionar
            </Button>
            <Button variant="outline" onClick={onFechar}>
              Voltar
            </Button>
          </div>
        </>
      )}
      <table className="w-full text-[1rem]">
        <thead>
          <tr>
            <th className={cabecalho}>cc</th>
            <th className={cabecalho}>DescriçãoC</th>
            <th className={cabecalho}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {linha.apropriacoes.length === 0 && (
            <tr>
              <td colSpan={3} className={cn(celula, "text-center")}>
                Nenhuma apropriação
              </td>
            </tr>
          )}
          {linha.apropriacoes.map((a) => (
            <tr key={a.id}>
              <td className={celula}>{a.cc_codigo}</td>
              <td className={celula}>{a.cc_descricao}</td>
              <td className={celula}>
                {podeEditar && !linha.bloqueado && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => rodar(() => onExcluir(a.id), "Apropriação excluída.")}
                    className="rounded-[0.358rem] bg-[#ea5455] px-[0.7rem] py-[0.2rem] text-[0.857rem] text-white"
                  >
                    Excluir
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


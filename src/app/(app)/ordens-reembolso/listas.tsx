"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Filter, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Cartao } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import { data as fmtData } from "@/lib/format";
import { excluirReembolso } from "@/lib/reembolsos/actions";
import type { ReembolsoLista } from "@/lib/reembolsos/tipos";

// "Ordens de Reembolso" do AstroTools: agrupada por cliente, ordens do cliente e lista geral (botão de filtro).

const real = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const botao = "flex size-[38px] items-center justify-center rounded-[0.358rem] bg-primary text-white hover:shadow-[0_8px_25px_-8px_var(--primary)]";

function Moldura({ filtroHref, children }: { filtroHref: string; children: React.ReactNode }) {
  return (
    <Cartao>
      <div className="border-b border-border px-[1.5rem] py-[1.5rem]">
        <h4 className="mb-0 text-[1.285rem] font-medium">Ordens de Reembolso</h4>
      </div>
      <div className="flex justify-end gap-[0.3rem] px-[1.5rem] pt-[1.5rem]">
        <Link href={filtroHref} title="Filtrar" className={botao}>
          <Filter className="size-[14px]" />
        </Link>
        <Link href="/ordens-reembolso/novo" title="Nova Ordem de Reembolso" className={botao}>
          <Plus className="size-[14px]" />
        </Link>
      </div>
      <div className="pt-[1.5rem]">{children}</div>
    </Cartao>
  );
}

type Grupo = { cliente_id: number; cliente: string; quantidade: number };

export function GrupoReembolsos({ reembolsos }: { reembolsos: ReembolsoLista[] }) {
  const grupos = new Map<number, Grupo>();
  for (const r of reembolsos) {
    const id = r.cliente_id ?? 0;
    const g = grupos.get(id) ?? { cliente_id: id, cliente: r.cliente_nome ?? "SEM CLIENTE", quantidade: 0 };
    g.quantidade++;
    grupos.set(id, g);
  }
  const colunas: ColunaTabela<Grupo>[] = [
    { chave: "cliente", titulo: "Cliente", valor: (g) => g.cliente, className: "font-semibold uppercase" },
    { chave: "quantidade", titulo: "Quantidade", valor: (g) => g.quantidade, className: "w-[1%] font-semibold whitespace-nowrap" },
    {
      chave: "acoes",
      titulo: "Ações",
      valor: () => "",
      className: "w-[1%]",
      render: (g) => (
        <Link href={`/ordens-reembolso/cliente/${g.cliente_id}`} title="Abrir" className="text-primary">
          <Search className="size-[14px]" />
        </Link>
      ),
    },
  ];
  return (
    <Moldura filtroHref="/ordens-reembolso/todas">
      <TabelaDados
        colunas={colunas}
        linhas={[...grupos.values()].sort((a, b) => a.cliente.localeCompare(b.cliente, "pt-BR"))}
        chave={(g) => g.cliente_id}
        exportar={false}
        nomeArquivo="ordens-reembolso"
      />
    </Moldura>
  );
}

export function ListaReembolsos({ reembolsos, podeExcluir }: { reembolsos: ReembolsoLista[]; podeExcluir: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const excluir = (r: ReembolsoLista) =>
    confirm("Confirma a Exclusão do Pedido?") &&
    startTransition(async () => {
      const res = await excluirReembolso(r.id);
      if (!res.ok) return void toast.error(res.erro);
      toast.success("Ordem de reembolso excluída.");
      router.refresh();
    });
  const colunas: ColunaTabela<ReembolsoLista>[] = [
    { chave: "id", titulo: "ID", valor: (r) => r.id, className: "font-semibold" },
    { chave: "valor", titulo: "Valor", valor: (r) => r.valor_total, render: (r) => real(r.valor_total), className: "font-semibold whitespace-nowrap" },
    { chave: "benef", titulo: "Beneficiario", valor: (r) => r.fornecedor_nome, className: "font-semibold uppercase" },
    { chave: "obra", titulo: "Obra", valor: (r) => r.obra_nome, className: "font-semibold uppercase" },
    { chave: "data", titulo: "Data", valor: (r) => r.criado_em.slice(0, 10), render: (r) => fmtData(r.criado_em), className: "font-semibold" },
    { chave: "nf", titulo: "NF Emitida", valor: (r) => (r.solicitacao_enviada ? "S" : "N"), className: "font-semibold" },
    {
      chave: "acoes",
      titulo: "Ações",
      valor: () => "",
      exportar: false,
      ordenavel: false,
      render: (r) => (
        <span className="flex items-center gap-[0.8rem]">
          <Link href={`/ordens-reembolso/${r.id}`} title="Abrir" className="text-primary">
            <Search className="size-[14px]" />
          </Link>
          {podeExcluir && (
            <button type="button" title="Excluir" disabled={pending} className="text-[#ea5455]" onClick={() => excluir(r)}>
              <Trash2 className="size-[14px]" />
            </button>
          )}
        </span>
      ),
    },
  ];
  return (
    <Moldura filtroHref="/ordens-reembolso">
      <TabelaDados colunas={colunas} linhas={reembolsos} chave={(r) => r.id} nomeArquivo="ordens-reembolso" />
    </Moldura>
  );
}

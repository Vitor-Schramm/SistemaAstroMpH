"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Cartao } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import { data as fmtData } from "@/lib/format";
import { STATUS_OC_ORIGINAL } from "@/lib/ocs/tipos";
import type { OcResumo } from "@/lib/ocs/dados";
import { BotoesTopo, FILTRO_VAZIO, PainelFiltro, type Filtro } from "../solicitacoes/listas";

// "Ordens de Compra": lista agrupada por cliente e lista das OCs de um cliente.

const real = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dia = (ts: string) => ts.slice(0, 10);
const STATUS_FILTRO = Object.fromEntries(Object.entries(STATUS_OC_ORIGINAL).map(([k, v]) => [k, { rotulo: v }]));

function aplicar(lista: OcResumo[], f: Filtro) {
  return lista.filter(
    (o) =>
      (!f.obra || String(o.obra_id) === f.obra) &&
      (!f.status || o.status === f.status) &&
      (!f.inicio || dia(o.data_emissao) >= f.inicio) &&
      (!f.fim || dia(o.data_emissao) <= f.fim),
  );
}

function obrasDe(lista: OcResumo[]) {
  const m = new Map<string, string>();
  for (const s of lista) m.set(String(s.obra_id), s.obra_nome);
  return [...m].map(([valor, rotulo]) => ({ valor, rotulo })).sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

function Moldura({ filtro, setFiltro, ocs, podeCriar, children }: { filtro: Filtro; setFiltro: (f: Filtro) => void; ocs: OcResumo[]; podeCriar: boolean; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Cartao>
      <div className="border-b border-border px-[1.5rem] py-[1.5rem]">
        <h4 className="mb-0 text-[1.285rem] font-medium">Ordens de Compra</h4>
      </div>
      <BotoesTopo filtroAberto={aberto} onFiltro={() => setAberto(!aberto)} novoHref={podeCriar ? "/ordens-compra/nova" : null} novoTitulo="Nova Ordem de Compra" />
      {aberto && <PainelFiltro obras={obrasDe(ocs)} valor={filtro} onChange={setFiltro} status={STATUS_FILTRO} />}
      <div className="pt-[1.5rem]">{children}</div>
    </Cartao>
  );
}

type Grupo = { cliente_id: number; cliente: string; responsaveis: string; quantidade: number };

export function GrupoOcs({ ocs, podeCriar = false }: { ocs: OcResumo[]; podeCriar?: boolean }) {
  const [filtro, setFiltro] = useState(FILTRO_VAZIO);
  const grupos = new Map<number, Grupo>();
  for (const o of aplicar(ocs, filtro)) {
    const id = o.cliente_id ?? 0;
    const g = grupos.get(id) ?? { cliente_id: id, cliente: o.cliente_nome ?? "SEM CLIENTE", responsaveis: o.responsaveis ?? "", quantidade: 0 };
    g.quantidade++;
    grupos.set(id, g);
  }
  const colunas: ColunaTabela<Grupo>[] = [
    { chave: "cliente", titulo: "Cliente", valor: (g) => g.cliente, className: "font-semibold uppercase" },
    { chave: "resp", titulo: "Eng. Responsável", valor: (g) => g.responsaveis, className: "font-semibold" },
    { chave: "quantidade", titulo: "Quantidade", valor: (g) => g.quantidade, className: "w-[1%] font-semibold whitespace-nowrap" },
    {
      chave: "acoes",
      titulo: "Ações",
      valor: () => "",
      className: "w-[1%]",
      render: (g) => (
        <Link href={`/ordens-compra/cliente/${g.cliente_id}`} title="Visualizar" className="text-[#00cfe8]">
          <Search className="size-[14px]" />
        </Link>
      ),
    },
  ];
  return (
    <Moldura filtro={filtro} setFiltro={setFiltro} ocs={ocs} podeCriar={podeCriar}>
      <TabelaDados
        colunas={colunas}
        linhas={[...grupos.values()].sort((a, b) => a.cliente.localeCompare(b.cliente, "pt-BR"))}
        chave={(g) => g.cliente_id}
        exportar={false}
        nomeArquivo="ordens-compra"
      />
    </Moldura>
  );
}

export function ListaOcs({ ocs, podeCriar = false }: { ocs: OcResumo[]; podeCriar?: boolean }) {
  const [filtro, setFiltro] = useState(FILTRO_VAZIO);
  const colunas: ColunaTabela<OcResumo>[] = [
    { chave: "num", titulo: "Ordem Cliente", valor: (o) => o.numero_cliente ?? o.id, className: "font-semibold" },
    { chave: "nome", titulo: "Nome Ordem", valor: (o) => o.nome ?? "", className: "font-semibold" },
    { chave: "valor", titulo: "Valor", valor: (o) => Number(o.valor_total), render: (o) => real(o.valor_total), className: "font-semibold whitespace-nowrap" },
    { chave: "forn", titulo: "Fornecedor", valor: (o) => o.fornecedor_fantasia || o.fornecedor_nome, className: "font-semibold uppercase" },
    { chave: "obra", titulo: "Obra", valor: (o) => o.obra_nome, className: "font-semibold uppercase" },
    { chave: "data", titulo: "Data", valor: (o) => dia(o.data_emissao), render: (o) => fmtData(o.data_emissao), className: "font-semibold" },
    { chave: "saldo", titulo: "Saldo da OC", valor: (o) => Number(o.saldo), render: (o) => real(o.saldo), className: "font-semibold whitespace-nowrap" },
    { chave: "resp", titulo: "Eng. Responsável", valor: (o) => o.responsaveis ?? "", className: "font-semibold" },
    { chave: "reg", titulo: "Regularização Engenharia?", valor: (o) => (o.regularizacao_engenharia ? "Sim" : "Não"), className: "font-semibold" },
    {
      chave: "acoes",
      titulo: "Ações",
      valor: () => "",
      exportar: false,
      ordenavel: false,
      render: (o) => (
        <Link href={`/ordens-compra/${o.id}`} title="Visualizar" className="text-[#00cfe8]">
          <Search className="size-[14px]" />
        </Link>
      ),
    },
  ];
  return (
    <Moldura filtro={filtro} setFiltro={setFiltro} ocs={ocs} podeCriar={podeCriar}>
      <TabelaDados colunas={colunas} linhas={aplicar(ocs, filtro)} chave={(o) => o.id} nomeArquivo="ordens-compra" />
    </Moldura>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Cartao } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import { STATUS_MAPA } from "@/lib/compras/tipos";
import type { MapaResumo } from "@/lib/mapas/dados";
import { BotoesTopo, FILTRO_VAZIO, PainelFiltro, type Filtro } from "../solicitacoes/listas";

// "Mapas de Cotação": lista agrupada por cliente e lista dos mapas de um cliente.

const STATUS_FILTRO = { digitacao: STATUS_MAPA.digitacao, cotacao: STATUS_MAPA.cotacao, finalizado: STATUS_MAPA.finalizado };
const dia = (ts: string) => new Date(ts).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

function aplicar(lista: MapaResumo[], f: Filtro) {
  return lista.filter(
    (m) =>
      (!f.obra || String(m.obra_id) === f.obra) &&
      (!f.status || m.status === f.status) &&
      (!f.inicio || dia(m.criado_em) >= f.inicio) &&
      (!f.fim || dia(m.criado_em) <= f.fim),
  );
}

function obrasDe(lista: MapaResumo[]) {
  const m = new Map<string, string>();
  for (const s of lista) m.set(String(s.obra_id), s.obra_nome);
  return [...m].map(([valor, rotulo]) => ({ valor, rotulo })).sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

function Moldura({ filtro, setFiltro, mapas, children }: { filtro: Filtro; setFiltro: (f: Filtro) => void; mapas: MapaResumo[]; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Cartao>
      <div className="border-b border-border px-[1.5rem] py-[1.5rem]">
        <h4 className="mb-0 text-[1.285rem] font-medium">Mapas de Cotação</h4>
      </div>
      <BotoesTopo filtroAberto={aberto} onFiltro={() => setAberto(!aberto)} novoHref="/mapas/novo" novoTitulo="Novo Mapa" />
      {aberto && <PainelFiltro obras={obrasDe(mapas)} valor={filtro} onChange={setFiltro} status={STATUS_FILTRO} />}
      <div className="pt-[1.5rem]">{children}</div>
    </Cartao>
  );
}

type Grupo = { cliente_id: number; cliente: string; quantidade: number; pendente: number };

export function GrupoMapas({ mapas }: { mapas: MapaResumo[] }) {
  const [filtro, setFiltro] = useState(FILTRO_VAZIO);
  const grupos = new Map<number, Grupo>();
  for (const m of aplicar(mapas, filtro)) {
    const id = m.cliente_id ?? 0;
    const g = grupos.get(id) ?? { cliente_id: id, cliente: m.cliente_nome ?? "SEM CLIENTE", quantidade: 0, pendente: 0 };
    g.quantidade++;
    if (m.status !== "finalizado" && m.status !== "cancelado") g.pendente++;
    grupos.set(id, g);
  }
  const colunas: ColunaTabela<Grupo>[] = [
    { chave: "cliente", titulo: "Cliente", valor: (g) => g.cliente, className: "font-semibold uppercase" },
    { chave: "quantidade", titulo: "Quantidade", valor: (g) => g.quantidade, className: "w-[1%] font-semibold whitespace-nowrap" },
    { chave: "pendente", titulo: "Pendente", valor: (g) => g.pendente, className: "w-[1%] font-semibold whitespace-nowrap" },
    {
      chave: "acoes",
      titulo: "Ações",
      valor: () => "",
      className: "w-[1%]",
      render: (g) => (
        <Link href={`/mapas/cliente/${g.cliente_id}`} title="Visualizar" className="text-[#00cfe8]">
          <Search className="size-[14px]" />
        </Link>
      ),
    },
  ];
  return (
    <Moldura filtro={filtro} setFiltro={setFiltro} mapas={mapas}>
      <TabelaDados
        colunas={colunas}
        linhas={[...grupos.values()].sort((a, b) => a.cliente.localeCompare(b.cliente, "pt-BR"))}
        chave={(g) => g.cliente_id}
        exportar={false}
        nomeArquivo="mapas"
      />
    </Moldura>
  );
}

export function ListaMapas({ mapas }: { mapas: MapaResumo[] }) {
  const [filtro, setFiltro] = useState(FILTRO_VAZIO);
  const colunas: ColunaTabela<MapaResumo>[] = [
    { chave: "id", titulo: "Id", valor: (m) => m.id, className: "font-semibold" },
    { chave: "cliente", titulo: "Cliente", valor: (m) => m.cliente_nome ?? "", className: "font-semibold uppercase" },
    { chave: "obra", titulo: "Obra", valor: (m) => m.obra_nome, className: "font-semibold uppercase" },
    { chave: "servico", titulo: "Serviço", valor: (m) => m.servico, className: "font-semibold" },
    { chave: "numero", titulo: "Mapa Cliente", valor: (m) => m.numero_cliente ?? "", className: "font-semibold" },
    { chave: "status", titulo: "Status", valor: (m) => STATUS_MAPA[m.status]?.rotulo ?? m.status, className: "font-semibold" },
    { chave: "regularizacao", titulo: "Regularização Engenharia", valor: (m) => (m.regularizacao_engenharia ? "Sim" : "Não"), className: "font-semibold" },
    {
      chave: "acoes",
      titulo: "Ações",
      valor: () => "",
      exportar: false,
      ordenavel: false,
      render: (m) => (
        <Link href={`/mapas/${m.id}`} title="Visualizar" className="text-[#00cfe8]">
          <Search className="size-[14px]" />
        </Link>
      ),
    },
  ];
  return (
    <Moldura filtro={filtro} setFiltro={setFiltro} mapas={mapas}>
      <TabelaDados colunas={colunas} linhas={aplicar(mapas, filtro)} chave={(m) => m.id} nomeArquivo="mapas" />
    </Moldura>
  );
}

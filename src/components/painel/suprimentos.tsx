"use client";

import { useState } from "react";
import { Box, Search, TrendingUp } from "lucide-react";
import { Cartao } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import type { LinhaObra, SemanaOc } from "@/lib/painel-suprimentos";

// Dashboard de Suprimentos do AstroTools: "Gráfico de OC's (últimas Semanas)", cartão OC's/Mapas e tabela por obra.
// Cores das séries: primária do tema e um laranja validado (contraste e daltonismo) no lugar do warning claro do original.

const SERIES = [
  { chave: "total" as const, nome: "Total de OCs Departamento", cor: "var(--serie-1)" },
  { chave: "meu" as const, nome: "OCs Usuário Acesso", cor: "var(--serie-2)" },
];

function Grafico({ semanas }: { semanas: SemanaOc[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(10, ...semanas.flatMap((s) => [s.total, s.meu]));
  // Escala "redonda" com ~4 divisões (passos de 1, 2 ou 5 × 10ⁿ), como o ApexCharts.
  const bruto = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 5, 10].map((m) => m * mag).find((p) => p >= bruto) ?? 10 * mag;
  const topo = Math.ceil(max / passo) * passo;
  const ticks = Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
  const W = 720;
  const H = 230;
  const esq = 40;
  const base = H - 30;
  const larguraGrupo = (W - esq) / semanas.length;
  const barra = Math.min(22, larguraGrupo * 0.18);
  const y = (v: number) => base - (v / topo) * (base - 10);

  return (
    <div className="relative">
      <div className="mb-[0.5rem] flex flex-wrap gap-[1.2rem] text-[0.9rem]">
        {SERIES.map((s) => (
          <span key={s.chave} className="flex items-center gap-[0.4rem]">
            <span className="inline-block size-[10px] rounded-full" style={{ background: s.cor }} />
            {s.nome}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="OCs por semana: departamento e meu usuário">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={esq} x2={W} y1={y(t)} y2={y(t)} stroke="var(--grade)" strokeWidth={1} />
            <text x={esq - 8} y={y(t) + 4} textAnchor="end" className="fill-[#b9b9c3] text-[12px]">
              {t}
            </text>
          </g>
        ))}
        {semanas.map((s, i) => {
          const cx = esq + larguraGrupo * i + larguraGrupo / 2;
          return (
            <g key={s.rotulo} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={esq + larguraGrupo * i} y={0} width={larguraGrupo} height={base} fill={hover === i ? "var(--grade)" : "transparent"} opacity={0.5} />
              {SERIES.map((serie, j) => {
                const v = s[serie.chave];
                const h = base - y(v);
                const x = cx + (j === 0 ? -barra - 1 : 1);
                return v > 0 ? (
                  <path
                    key={serie.chave}
                    d={`M${x},${base} v${-Math.max(h - 4, 0)} q0,-4 4,-4 h${barra - 8} q4,0 4,4 v${Math.max(h - 4, 0)} z`}
                    fill={serie.cor}
                  />
                ) : null;
              })}
              <text x={cx} y={H - 8} textAnchor="middle" className="fill-[#b9b9c3] text-[12px]">
                {s.rotulo}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-[2rem] rounded-[0.357rem] border border-border bg-card px-[0.8rem] py-[0.5rem] text-[0.9rem] shadow-md"
          style={{ left: `${((esq + (W - esq) / semanas.length * (hover + 0.5)) / W) * 100}%`, transform: "translateX(-50%)" }}
        >
          <p className="mb-[0.3rem] font-semibold">{semanas[hover].rotulo}</p>
          {SERIES.map((s) => (
            <p key={s.chave} className="mb-0 flex items-center gap-[0.4rem] whitespace-nowrap">
              <span className="inline-block size-[8px] rounded-full" style={{ background: s.cor }} />
              {s.nome}: <b>{semanas[hover][s.chave]}</b>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Item({ icone: Icone, cor, titulo, sub, valor }: { icone: typeof Box; cor: string; titulo: string; sub: string; valor: number }) {
  return (
    <div className="flex items-center justify-between py-[0.6rem]">
      <div className="flex items-center gap-[1rem]">
        <span className="flex size-[38px] items-center justify-center rounded-[0.357rem]" style={{ color: cor, background: `${cor}1f` }}>
          <Icone className="size-[18px]" />
        </span>
        <div>
          <h6 className="mb-0 text-[1rem] font-medium">{titulo}</h6>
          <small className="text-[0.857rem]">{sub}</small>
        </div>
      </div>
      <span className="font-bold">{valor}</span>
    </div>
  );
}

export function PainelSuprimentos({
  semanas,
  ocsSemanaMeu,
  ocsSemanaGeral,
  mapasPendentes,
  mapasPendentesMeus,
  obras,
}: {
  semanas: SemanaOc[];
  ocsSemanaMeu: number;
  ocsSemanaGeral: number;
  mapasPendentes: number;
  mapasPendentesMeus: number;
  obras: LinhaObra[];
}) {
  const lupa = (href: string) => (
    <a href={href} target="_blank" rel="noreferrer" title="Vizualizar" className="ml-[0.4rem] inline-flex text-primary">
      <Search className="size-[14px]" />
    </a>
  );
  const colunas: ColunaTabela<LinhaObra>[] = [
    {
      chave: "obra",
      titulo: "Cliente",
      valor: (l) => l.obra,
      className: "font-semibold uppercase",
      render: (l) => (
        <>
          {l.obra}
          {lupa(`/obras/${l.obra_id}`)}
        </>
      ),
    },
    {
      chave: "sol",
      titulo: "Solicitações Qtd.",
      valor: (l) => l.solicitacoes,
      className: "font-semibold",
      render: (l) => (
        <>
          {l.solicitacoes}
          {lupa(`/solicitacoes/cliente/${l.cliente_id ?? 0}`)}
        </>
      ),
    },
    { chave: "solp", titulo: "Solicitações Pendentes", valor: (l) => l.solicitacoesPendentes, className: "font-semibold" },
    {
      chave: "map",
      titulo: "Mapas Qtd.",
      valor: (l) => l.mapas,
      className: "font-semibold",
      render: (l) => (
        <>
          {l.mapas}
          {lupa(`/mapas/cliente/${l.cliente_id ?? 0}`)}
        </>
      ),
    },
    { chave: "mapp", titulo: "Mapas pendentes", valor: (l) => l.mapasPendentes, className: "font-semibold" },
  ];

  return (
    <div className="[--grade:#ebe9f1] [--serie-1:#01a08a] [--serie-2:#dd7712] dark:[--grade:#3b4253] dark:[--serie-2:#d06d10]">
      <div className="grid gap-[2rem] lg:grid-cols-[3fr_1fr]">
        <Cartao className="p-[1.5rem]">
          <h4 className="mb-[1rem] text-[1.285rem] font-medium">Gráfico de OC&apos;s (últimas Semanas)</h4>
          <Grafico semanas={semanas} />
        </Cartao>
        <Cartao>
          <div className="px-[1.5rem] pt-[1.5rem]">
            <h4 className="mb-[0.5rem] text-[1.285rem] font-medium">OC&apos;s</h4>
            <Item icone={TrendingUp} cor="#01a08a" titulo="Semana" sub="Meu Usuário" valor={ocsSemanaMeu} />
            <Item icone={TrendingUp} cor="#01a08a" titulo="Semana" sub="Geral" valor={ocsSemanaGeral} />
          </div>
          <div className="px-[1.5rem] pt-[1rem] pb-[1.5rem]">
            <h4 className="mb-[0.5rem] text-[1.285rem] font-medium">Mapas</h4>
            <Item icone={Box} cor="#ea5455" titulo="Pendentes" sub="Geral" valor={mapasPendentes} />
            <Item icone={Box} cor="#ea5455" titulo="Pendentes" sub="Meu Usuário" valor={mapasPendentesMeus} />
          </div>
        </Cartao>
      </div>
      <Cartao>
        <TabelaDados colunas={colunas} linhas={obras} chave={(l) => l.obra_id} porPaginaInicial={50} nomeArquivo="painel-suprimentos" />
      </Cartao>
    </div>
  );
}

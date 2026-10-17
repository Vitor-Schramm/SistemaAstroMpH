"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Filter, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Cartao, Campo } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import { selectClass } from "@/components/cadastros/registro-form";
import { STATUS_SOLICITACAO } from "@/lib/compras/tipos";
import { data as fmtData } from "@/lib/format";
import { excluirSolicitacao } from "@/lib/solicitacoes/actions";
import type { SolicitacaoResumo } from "@/lib/solicitacoes/dados";

// "Solicitações de Compra": lista agrupada por cliente e lista das solicitações de um cliente.

export function BotoesTopo({ filtroAberto, onFiltro, novoHref = "/solicitacoes/nova", novoTitulo = "Nova Solicitação" }: { filtroAberto: boolean; onFiltro: () => void; novoHref?: string; novoTitulo?: string }) {
  return (
    <div className="flex justify-end gap-[0.3rem] px-[1.5rem] pt-[1.5rem]">
      <button
        type="button"
        onClick={onFiltro}
        aria-pressed={filtroAberto}
        title="Filtrar"
        className="flex size-[38px] items-center justify-center rounded-[0.358rem] bg-primary text-white hover:shadow-[0_8px_25px_-8px_var(--primary)]"
      >
        <Filter className="size-[14px]" />
      </button>
      <Link
        href={novoHref}
        title={novoTitulo}
        className="flex size-[38px] items-center justify-center rounded-[0.358rem] bg-primary text-white hover:shadow-[0_8px_25px_-8px_var(--primary)]"
      >
        <Plus className="size-[14px]" />
      </Link>
    </div>
  );
}

export type Filtro = { obra: string; status: string; inicio: string; fim: string };
export const FILTRO_VAZIO: Filtro = { obra: "", status: "", inicio: "", fim: "" };

export function PainelFiltro({
  obras,
  valor,
  onChange,
  status = STATUS_SOLICITACAO,
}: {
  obras: { valor: string; rotulo: string }[];
  valor: Filtro;
  onChange: (f: Filtro) => void;
  status?: Record<string, { rotulo: string }>;
}) {
  return (
    <div className="grid gap-x-[1.5rem] px-[1.5rem] pt-[1rem] md:grid-cols-4">
      <Campo rotulo="Obra" htmlFor="f-obra">
        <select id="f-obra" value={valor.obra} onChange={(e) => onChange({ ...valor, obra: e.target.value })} className={selectClass}>
          <option value="">Todas</option>
          {obras.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Status" htmlFor="f-status">
        <select id="f-status" value={valor.status} onChange={(e) => onChange({ ...valor, status: e.target.value })} className={selectClass}>
          <option value="">Todos</option>
          {Object.entries(status).map(([v, s]) => (
            <option key={v} value={v}>
              {s.rotulo}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Data Inicial" htmlFor="f-ini">
        <input id="f-ini" type="date" value={valor.inicio} onChange={(e) => onChange({ ...valor, inicio: e.target.value })} className={selectClass} />
      </Campo>
      <Campo rotulo="Data Final" htmlFor="f-fim">
        <input id="f-fim" type="date" value={valor.fim} onChange={(e) => onChange({ ...valor, fim: e.target.value })} className={selectClass} />
      </Campo>
    </div>
  );
}

const dia = (ts: string) => new Date(ts).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

function aplicar(lista: SolicitacaoResumo[], f: Filtro) {
  return lista.filter(
    (s) =>
      (!f.obra || String(s.obra_id) === f.obra) &&
      (!f.status || s.status === f.status) &&
      (!f.inicio || dia(s.criado_em) >= f.inicio) &&
      (!f.fim || dia(s.criado_em) <= f.fim),
  );
}

function obrasDe(lista: SolicitacaoResumo[]) {
  const m = new Map<string, string>();
  for (const s of lista) m.set(String(s.obra_id), s.obra_nome);
  return [...m].map(([valor, rotulo]) => ({ valor, rotulo })).sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

type Grupo = { cliente_id: number; cliente: string; quantidade: number; pendente: number };

export function GrupoSolicitacoes({ solicitacoes }: { solicitacoes: SolicitacaoResumo[] }) {
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [filtro, setFiltro] = useState(FILTRO_VAZIO);

  const grupos = new Map<number, Grupo>();
  for (const s of aplicar(solicitacoes, filtro)) {
    const id = s.cliente_id ?? 0;
    const g = grupos.get(id) ?? { cliente_id: id, cliente: s.cliente_nome ?? "SEM CLIENTE", quantidade: 0, pendente: 0 };
    g.quantidade++;
    if (s.status === "pendente") g.pendente++;
    grupos.set(id, g);
  }
  const linhas = [...grupos.values()].sort((a, b) => a.cliente.localeCompare(b.cliente, "pt-BR"));

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
        <Link href={`/solicitacoes/cliente/${g.cliente_id}`} title="Visualizar" className="text-[#00cfe8]">
          <Search className="size-[14px]" />
        </Link>
      ),
    },
  ];

  return (
    <Cartao>
      <div className="border-b border-border px-[1.5rem] py-[1.5rem]">
        <h4 className="mb-0 text-[1.285rem] font-medium">Solicitações de Compra</h4>
      </div>
      <BotoesTopo filtroAberto={filtroAberto} onFiltro={() => setFiltroAberto(!filtroAberto)} />
      {filtroAberto && <PainelFiltro obras={obrasDe(solicitacoes)} valor={filtro} onChange={setFiltro} />}
      <div className="pt-[1.5rem]">
        <TabelaDados colunas={colunas} linhas={linhas} chave={(g) => g.cliente_id} exportar={false} nomeArquivo="solicitacoes" />
      </div>
    </Cartao>
  );
}

export function ListaSolicitacoes({ solicitacoes, ehAdmin }: { solicitacoes: SolicitacaoResumo[]; ehAdmin: boolean }) {
  const router = useRouter();
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [filtro, setFiltro] = useState(FILTRO_VAZIO);
  const [, startTransition] = useTransition();

  const colunas: ColunaTabela<SolicitacaoResumo>[] = [
    { chave: "id", titulo: "Id", valor: (s) => s.id, className: "font-semibold" },
    { chave: "cliente", titulo: "Cliente", valor: (s) => s.cliente_nome ?? "", className: "font-semibold uppercase" },
    { chave: "obra", titulo: "Obra", valor: (s) => s.obra_nome, className: "font-semibold uppercase" },
    { chave: "servico", titulo: "Serviço", valor: (s) => s.servico, className: "font-semibold" },
    { chave: "data", titulo: "Data", valor: (s) => dia(s.criado_em), render: (s) => fmtData(s.criado_em), className: "font-semibold" },
    { chave: "status", titulo: "Status", valor: (s) => STATUS_SOLICITACAO[s.status]?.rotulo ?? s.status, className: "font-semibold" },
    {
      chave: "acoes",
      titulo: "Ações",
      valor: () => "",
      exportar: false,
      ordenavel: false,
      render: (s) => (
        <span className="flex items-center gap-3">
          <Link href={`/solicitacoes/${s.id}`} title="Visualizar" className="text-[#00cfe8]">
            <Search className="size-[14px]" />
          </Link>
          {ehAdmin && s.status === "pendente" && (
            <button
              type="button"
              title="Excluir"
              className="text-[#ea5455]"
              onClick={() => {
                if (!confirm("Confirma a Exclusão da Solicitação?")) return;
                startTransition(async () => {
                  const r = await excluirSolicitacao(s.id);
                  if (!r.ok) return void toast.error(r.erro);
                  toast.success("Solicitação excluída.");
                  router.refresh();
                });
              }}
            >
              <Trash2 className="size-[14px]" />
            </button>
          )}
        </span>
      ),
    },
  ];

  return (
    <Cartao>
      <div className="border-b border-border px-[1.5rem] py-[1.5rem]">
        <h4 className="mb-0 text-[1.285rem] font-medium">Solicitações de Compra</h4>
      </div>
      <BotoesTopo filtroAberto={filtroAberto} onFiltro={() => setFiltroAberto(!filtroAberto)} />
      {filtroAberto && <PainelFiltro obras={obrasDe(solicitacoes)} valor={filtro} onChange={setFiltro} />}
      <div className="pt-[1.5rem]">
        <TabelaDados colunas={colunas} linhas={aplicar(solicitacoes, filtro)} chave={(s) => s.id} nomeArquivo="solicitacoes" />
      </div>
    </Cartao>
  );
}

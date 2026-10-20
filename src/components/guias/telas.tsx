"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Edit, MoreVertical, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Cartao, Campo } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import { selectClass } from "@/components/cadastros/registro-form";
import { data as fmtData } from "@/lib/format";
import {
  adicionarGuiaNaAdm,
  adicionarItemGuia,
  criarGuiaEnvio,
  excluirItemGuia,
  pagarGuiaAdm,
  removerGuiaDaAdm,
  salvarGuiaAdm,
  type DadosGuiaAdm,
  type Resultado,
} from "@/lib/guias/actions";
import { n2, real, type Guia, type LinhaGuia } from "@/lib/guias/tipos";
import { ModalArquivos } from "@/app/(app)/vincular/telas";

// Guias do AstroTools: "Guias Envio" e "Guias Adm" da obra, "Guia de Envio", "Guia de Adm" e "Consulta Guias".

type Opcao = { valor: string; rotulo: string };

function useAcao() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const rodar = (fn: () => Promise<Resultado>, ok: string, depois?: (r: Resultado & { ok: true }) => void) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.erro);
      toast.success(ok);
      depois?.(r);
      router.refresh();
    });
  return { pending, rodar, router };
}

function TopoCartao({ titulo, obra, guia, extra }: { titulo: string; obra: string; guia?: number; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-[1.5rem] py-[1.5rem]">
      <h4 className="mb-0 flex items-center gap-[0.5rem] text-[1.285rem] font-medium">
        {titulo}
        {extra}
      </h4>
      <h4 className="mb-0 text-[1.285rem] font-medium">
        Obra: {obra}
        {guia != null && ` || Guia: ${guia}`}
      </h4>
    </div>
  );
}

const iconeAbrir = "text-primary [&_svg]:size-[14px]";

// ============================================================
// Listas da obra: "Guias de Envio" e "Guias de Administração"
// ============================================================

export function ListaGuias({ tipo, obra, guias, podeEditar }: { tipo: "envio" | "adm"; obra: { id: number; nome: string }; guias: Guia[]; podeEditar: boolean }) {
  const { pending, rodar, router } = useAcao();
  const [nova, setNova] = useState(false);

  const abrir = (g: Guia) =>
    g.tipo === "adm" ? (
      tipo === "envio" ? (
        <a href={`/guias-adm/${g.id}`} target="_blank" rel="noreferrer" title="Abrir" className={iconeAbrir}>
          <Search />
        </a>
      ) : (
        <Link href={`/guias-adm/${g.id}`} title="Abrir" className={iconeAbrir}>
          <Search />
        </Link>
      )
    ) : (
      <Link href={`/guias-envio/${g.id}`} title="Abrir" className={iconeAbrir}>
        <Search />
      </Link>
    );

  const colunas: ColunaTabela<Guia>[] = [
    { chave: "tipo", titulo: "Tipo", valor: (g) => (g.tipo === "adm" ? (tipo === "envio" ? "ADM" : "Adm") : "Normal") },
    { chave: "numero", titulo: "Guia Cliente", valor: (g) => g.numero },
    { chave: "valor", titulo: "Valor", valor: (g) => g.valor, render: (g) => real(g.valor) },
    { chave: "acoes", titulo: "Ações", valor: () => "", exportar: false, render: abrir },
  ];

  return (
    <Cartao>
      <TopoCartao titulo={tipo === "envio" ? "Guias de Envio" : "Guias de Administração"} obra={obra.nome} />
      <div className="flex justify-end gap-[0.5rem] px-[1.5rem] pt-[1.5rem]">
        <Button variant="outline" onClick={() => router.push(`/obras/${obra.id}`)}>
          Voltar
        </Button>
        {podeEditar &&
          (tipo === "envio" ? (
            <Button
              size="icon"
              title="Nova Guia de Envio"
              disabled={pending}
              onClick={() =>
                confirm(`Confirma a geração de uma nova Guia de Envio? Obra:${obra.nome}!`) &&
                rodar(() => criarGuiaEnvio(obra.id), "Guia de envio gerada.", (r) => r.id && router.push(`/guias-envio/${r.id}`))
              }
            >
              <Plus />
            </Button>
          ) : (
            <Button onClick={() => setNova(true)}>
              <Plus /> Nova Guia
            </Button>
          ))}
      </div>
      <div className="pt-[0.5rem]">
        <TabelaDados colunas={colunas} linhas={guias} chave={(g) => g.id} nomeArquivo={tipo === "envio" ? "guias-envio" : "guias-adm"} />
      </div>
      {tipo === "adm" && (
        <ModalDadosAdm
          aberto={nova}
          titulo="Adicionar Guia"
          inicial={null}
          onFechar={() => setNova(false)}
          onSalvar={(d) => rodar(() => salvarGuiaAdm(obra.id, null, d), "Guia ADM gerada.", (r) => (setNova(false), r.id && router.push(`/guias-adm/${r.id}`)))}
          pending={pending}
        />
      )}
    </Cartao>
  );
}

// ============================================================
// Modal "Adicionar Guia" / "Alterar dados Guia" (Guia ADM)
// ============================================================

const DADOS_VAZIOS: DadosGuiaAdm = { controle_parcela: "", conta_faturamento: "MPH ENGENHARIA LTDA", vencimento: "", tipo_documento: "NF", tipo_pagamento: "" };

function CamposAdm({ d, onChange, leitura }: { d: DadosGuiaAdm; onChange?: (d: DadosGuiaAdm) => void; leitura?: boolean }) {
  const set = (k: keyof DadosGuiaAdm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange?.({ ...d, [k]: e.target.value });
  const p = leitura ? "g" : "m";
  return (
    <div className="grid gap-x-[1.5rem] md:grid-cols-[2fr_2fr_2fr_1fr_4fr]">
      <Campo rotulo="N°Controle/Parcela" htmlFor={`${p}-ctrl`}>
        <Input id={`${p}-ctrl`} readOnly={leitura} value={d.controle_parcela} onChange={set("controle_parcela")} />
      </Campo>
      <Campo rotulo="Conta Pagamento" htmlFor={`${p}-conta`}>
        <select id={`${p}-conta`} disabled={leitura} value={d.conta_faturamento} onChange={set("conta_faturamento")} className={selectClass}>
          <option>MPH ENGENHARIA LTDA</option>
        </select>
      </Campo>
      <Campo rotulo="Data Validade" htmlFor={`${p}-venc`}>
        <Input id={`${p}-venc`} type="date" readOnly={leitura} value={d.vencimento} onChange={set("vencimento")} />
      </Campo>
      <Campo rotulo="Tipo" htmlFor={`${p}-tipo`}>
        <select id={`${p}-tipo`} disabled={leitura} value={d.tipo_documento} onChange={set("tipo_documento")} className={selectClass}>
          {["NF", "BOLETO", "RECIBO"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Tipo Pagamento" htmlFor={`${p}-pag`}>
        <Input id={`${p}-pag`} readOnly={leitura} value={d.tipo_pagamento} onChange={set("tipo_pagamento")} />
      </Campo>
    </div>
  );
}

function ModalDadosAdm({
  aberto,
  titulo,
  inicial,
  onFechar,
  onSalvar,
  pending,
}: {
  aberto: boolean;
  titulo: string;
  inicial: DadosGuiaAdm | null;
  onFechar: () => void;
  onSalvar: (d: DadosGuiaAdm) => void;
  pending: boolean;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-[1.1rem] font-medium text-heading">{titulo}</DialogTitle>
        </DialogHeader>
        {aberto && <FormDadosAdm inicial={inicial ?? DADOS_VAZIOS} onFechar={onFechar} onSalvar={onSalvar} pending={pending} />}
      </DialogContent>
    </Dialog>
  );
}

function FormDadosAdm({ inicial, onFechar, onSalvar, pending }: { inicial: DadosGuiaAdm; onFechar: () => void; onSalvar: (d: DadosGuiaAdm) => void; pending: boolean }) {
  const [d, setD] = useState(inicial);
  return (
    <div>
      <CamposAdm d={d} onChange={setD} />
      <div className="flex gap-[0.5rem]">
        <Button disabled={pending} onClick={() => onSalvar(d)}>
          Enviar
        </Button>
        <Button variant="outline" onClick={onFechar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// "Guia de Envio"
// ============================================================

export function TelaGuiaEnvio({ guia, itens, disponiveis, podeEditar }: { guia: Guia; itens: LinhaGuia[]; disponiveis: LinhaGuia[]; podeEditar: boolean }) {
  const { pending, rodar, router } = useAcao();
  const [sel, setSel] = useState("");
  const [arquivos, setArquivos] = useState<LinhaGuia | null>(null);
  const linha = disponiveis.find((l) => String(l.rateio_id) === sel);
  const bloqueada = guia.guia_adm_id != null;
  const podeAdicionar = podeEditar && !bloqueada && disponiveis.length > 0;

  const colunas: ColunaTabela<LinhaGuia>[] = [
    { chave: "pedido", titulo: "Pedido", valor: (l) => l.pedido, ordenavel: false },
    { chave: "pedcli", titulo: "Pedido Cliente", valor: (l) => l.pedido_cliente, ordenavel: false },
    { chave: "nome", titulo: "Nome do Pedido", valor: (l) => l.pedido_nome, ordenavel: false },
    { chave: "forn", titulo: "Fornecedor", valor: (l) => l.fornecedor_nome, ordenavel: false },
    { chave: "valor", titulo: "Valor", valor: (l) => n2(l.valor), render: (l) => real(l.valor), ordenavel: false },
    { chave: "tipo", titulo: "Tipo", valor: (l) => l.tipo_documento, ordenavel: false },
    { chave: "nota", titulo: "Nota/Parcela", valor: (l) => l.numero, ordenavel: false },
    { chave: "venc", titulo: "Vencimento", valor: (l) => fmtData(l.vencimento), ordenavel: false },
    { chave: "pag", titulo: "Pagamento", valor: (l) => l.tipo_pagamento, ordenavel: false },
    { chave: "cc", titulo: "Apropriação", valor: (l) => l.cc_codigo, ordenavel: false },
    {
      chave: "arq",
      titulo: "Arquivos",
      valor: () => "",
      exportar: false,
      ordenavel: false,
      render: (l) => (
        <span className="flex items-center gap-[0.6rem] text-primary [&_svg]:size-[14px]">
          {l.pedido && (
            <a href={`/imprimir/oc/${l.pedido}`} target="_blank" rel="noreferrer" title="Download">
              <Download />
            </a>
          )}
          <button type="button" title="Upload" onClick={() => setArquivos(l)}>
            <Upload />
          </button>
        </span>
      ),
    },
    {
      chave: "acoes",
      titulo: "Ações",
      valor: () => "",
      exportar: false,
      ordenavel: false,
      render: (l) => (
        <button
          type="button"
          title="Excluir"
          disabled={!podeEditar || bloqueada || pending}
          className="text-[#ea5455] disabled:opacity-50 [&_svg]:size-[14px]"
          onClick={() => confirm(`Confirma a Exclusão? NF: ${l.numero} Valor: R$ ${l.valor}`) && rodar(() => excluirItemGuia(l.item_id!), "Item excluído da guia.")}
        >
          <Trash2 />
        </button>
      ),
    },
  ];

  const ro = (id: string, rotulo: string, valor: string | number | null | undefined, tipo = "text") => (
    <Campo rotulo={rotulo} htmlFor={id}>
      <Input id={id} type={tipo} readOnly value={valor ?? ""} />
    </Campo>
  );

  return (
    <Cartao>
      <TopoCartao titulo="Guias de Envio" obra={guia.obra_nome} guia={guia.numero} />
      <div className="px-[1.5rem] pt-[1.5rem]">
        <div className="grid gap-x-[1.5rem] md:grid-cols-[4fr_2fr_6fr]">
          <Campo rotulo="Nota:" htmlFor="g-nota">
            <select id="g-nota" disabled={!podeAdicionar} value={sel} onChange={(e) => setSel(e.target.value)} className={selectClass}>
              <option value="">Selecione</option>
              {disponiveis.length === 0 && <option disabled>Notas indisponiveis para está guia</option>}
              {disponiveis.map((l) => (
                <option key={l.rateio_id} value={l.rateio_id}>
                  NF: {l.numero} - Valor: {l.valor.toFixed(2)} - Vencimento: {fmtData(l.vencimento)} - Fornecedor: {l.fornecedor_nome}
                </option>
              ))}
            </select>
          </Campo>
          {ro("g-oc", "Num Oc Cliente:", linha?.pedido_cliente)}
          {ro("g-nome", "Ordem Nome:", linha?.pedido_nome)}
        </div>
        <div className="grid gap-x-[1.5rem] md:grid-cols-[6fr_4fr_2fr]">
          {ro("g-forn", "Fornecedor:", linha?.fornecedor_nome)}
          {ro("g-valor", "Valor da Nota:", linha && linha.valor.toFixed(2))}
          {ro("g-cc", "CC:", linha?.cc_codigo)}
        </div>
        <div className="grid gap-x-[1.5rem] md:grid-cols-[2fr_3fr_3fr_2fr_2fr]">
          {ro("g-tipo", "Tipo", linha?.tipo_documento)}
          {ro("g-parc", "NºNota/Parcela", linha?.numero)}
          {ro("g-tpag", "Tipo Pagamento", linha?.tipo_pagamento)}
          {ro("g-venc", "Data Validade", linha?.vencimento, "date")}
        </div>
      </div>
      <div className="flex justify-end gap-[0.5rem] border-t border-border px-[1.5rem] py-[1rem]">
        <a href={`/imprimir/guia-envio/${guia.id}`} target="_blank" rel="noreferrer" className="inline-flex">
          <Button variant="outline">PDF</Button>
        </a>
        <Button
          disabled={!podeAdicionar || !linha || pending}
          onClick={() => linha && rodar(() => adicionarItemGuia(guia.id, linha.rateio_id), "Nota adicionada na guia.", () => setSel(""))}
        >
          Salvar
        </Button>
        <Button variant="outline" onClick={() => router.push(`/guias-envio/obra/${guia.obra_id}`)}>
          Voltar
        </Button>
      </div>
      {bloqueada && (
        <p className="mx-[1.5rem] rounded-[0.357rem] bg-[#ff9f43]/10 p-[0.75rem] text-[0.95rem] text-[#c76b12]">
          Esta guia já foi cobrada na Guia ADM {guia.guia_adm_numero} e não pode ser alterada.
        </p>
      )}
      <div className="pt-[0.5rem]">
        <TabelaDados colunas={colunas} linhas={itens} chave={(l) => l.rateio_id} nomeArquivo={`guia-envio-${guia.numero}`} porPaginaInicial={100} controles={false} />
      </div>
      <Dialog open={arquivos !== null} onOpenChange={(o) => !o && setArquivos(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[1.1rem] font-medium text-heading">Arquivos-NF</DialogTitle>
          </DialogHeader>
          {arquivos && (
            <ModalArquivos ocId={arquivos.pedido ?? 0} nota={{ id: arquivos.nota_id, numero: arquivos.numero, status: "paga", anexos: arquivos.anexos }} onFechar={() => setArquivos(null)} />
          )}
        </DialogContent>
      </Dialog>
    </Cartao>
  );
}

// ============================================================
// "Guia de Adm"
// ============================================================

export function TelaGuiaAdm({ guia, incluidas, disponiveis, podeEditar }: { guia: Guia; incluidas: Guia[]; disponiveis: Guia[]; podeEditar: boolean }) {
  const { pending, rodar, router } = useAcao();
  const [sel, setSel] = useState("");
  const [editar, setEditar] = useState(false);
  const escolhida = disponiveis.find((g) => String(g.id) === sel);
  const dados: DadosGuiaAdm = {
    controle_parcela: guia.controle_parcela ?? "",
    conta_faturamento: guia.conta_faturamento ?? "MPH ENGENHARIA LTDA",
    vencimento: guia.vencimento ?? "",
    tipo_documento: guia.tipo_documento ?? "NF",
    tipo_pagamento: guia.tipo_pagamento ?? "",
  };
  const travada = !podeEditar || guia.pago;

  type Linha = { id: number; rotulo: string; valor: number; guia?: Guia };
  const linhas: Linha[] = [
    ...[...incluidas].sort((a, b) => b.numero - a.numero).map((g) => ({ id: g.id, rotulo: `GUIA DE ENVIO ${g.numero}`, valor: g.valor, guia: g })),
    { id: -1, rotulo: `GUIA DE ENVIO ${guia.numero} - ADM`, valor: guia.valor },
  ];
  const colunas: ColunaTabela<Linha>[] = [
    { chave: "guia", titulo: "Guia", valor: (l) => l.rotulo, ordenavel: false, render: (l) => <span className="font-semibold">{l.rotulo}</span> },
    { chave: "valor", titulo: "Valor", valor: (l) => n2(l.valor), ordenavel: false, render: (l) => <span className="font-semibold">{n2(l.valor)}</span> },
    {
      chave: "acoes",
      titulo: "Ações",
      valor: () => "",
      exportar: false,
      ordenavel: false,
      className: "text-right",
      render: (l) =>
        l.guia && (
          <span className="flex justify-end">
            <button
              type="button"
              title="Excluir"
              disabled={travada || pending}
              className="text-[#ea5455] disabled:opacity-50 [&_svg]:size-[14px]"
              onClick={() => confirm(`Confirma a Exclusão da Guia: ${l.guia!.numero}?`) && rodar(() => removerGuiaDaAdm(l.guia!.id), "Guia retirada da Guia ADM.")}
            >
              <Trash2 />
            </button>
          </span>
        ),
    },
  ];

  return (
    <Cartao>
      <TopoCartao
        titulo="Guias de Adm"
        obra={guia.obra_nome}
        guia={guia.numero}
        extra={
          !travada && (
            <button type="button" title="Alterar dados Guia" onClick={() => setEditar(true)} className="text-[#00cfe8] [&_svg]:size-[14px]">
              <Edit />
            </button>
          )
        }
      />
      <div className="px-[1.5rem] pt-[1.5rem]">
        <CamposAdm d={dados} leitura />
        <div className="grid gap-x-[1.5rem] md:grid-cols-[4fr_2fr_2fr_4fr]">
          <Campo rotulo="Guia:" htmlFor="a-guia">
            <select id="a-guia" disabled={travada} value={sel} onChange={(e) => setSel(e.target.value)} className={selectClass}>
              <option value="">Selecione</option>
              {disponiveis.map((g) => (
                <option key={g.id} value={g.id}>
                  Guia: {g.numero} - Valor: {g.valor.toFixed(2)}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Numero Guia:" htmlFor="a-num">
            <Input id="a-num" readOnly value={escolhida?.numero ?? ""} />
          </Campo>
          <Campo rotulo="Valor:" htmlFor="a-valor">
            <Input id="a-valor" readOnly value={escolhida ? n2(escolhida.valor) : ""} />
          </Campo>
        </div>
        <Button
          className="mb-[1.5rem]"
          disabled={travada || !escolhida || pending}
          onClick={() => escolhida && rodar(() => adicionarGuiaNaAdm(guia.id, escolhida.id), "Guia adicionada.", () => setSel(""))}
        >
          Adicionar
        </Button>
      </div>
      <div className="flex justify-end gap-[0.5rem] border-t border-border px-[1.5rem] py-[1rem]">
        <a href={`/imprimir/guia-adm/${guia.id}?calculo=1`} target="_blank" rel="noreferrer" className="inline-flex">
          <Button variant="outline">PDF-Calculo</Button>
        </a>
        <a href={`/imprimir/guia-adm/${guia.id}`} target="_blank" rel="noreferrer" className="inline-flex">
          <Button variant="outline">PDF-Guia</Button>
        </a>
        <Button variant="outline" onClick={() => router.push(`/guias-adm/obra/${guia.obra_id}`)}>
          Voltar
        </Button>
      </div>
      <div className="px-[1.5rem] pb-[1.5rem]">
        <TabelaDados colunas={colunas} linhas={linhas} chave={(l) => l.id} nomeArquivo={`guia-adm-${guia.numero}`} porPaginaInicial={100} controles={false} exportar={false} />
      </div>
      <ModalDadosAdm
        aberto={editar}
        titulo="Alterar dados Guia"
        inicial={dados}
        onFechar={() => setEditar(false)}
        onSalvar={(d) => rodar(() => salvarGuiaAdm(guia.obra_id, guia.id, d), "Dados da guia alterados.", () => setEditar(false))}
        pending={pending}
      />
    </Cartao>
  );
}

// ============================================================
// "Consulta Guias" (menu Guias Adm)
// ============================================================

export function ConsultaGuiasAdm({ guias, obras, podePagar }: { guias: Guia[]; obras: Opcao[]; podePagar: boolean }) {
  const { pending, rodar } = useAcao();
  const [filtro, setFiltro] = useState({ obra: "", nf: "", inicio: "", fim: "" });
  const [filtrado, setFiltrado] = useState<typeof filtro | null>(null);
  const [modal, setModal] = useState<{ tipo: "pagar" | "estornar"; guia: Guia } | null>(null);

  const linhas = filtrado
    ? guias.filter(
        (g) =>
          String(g.obra_id) === filtrado.obra &&
          filtrado.nf !== "sim" &&
          (!filtrado.inicio || (g.vencimento ?? "") >= filtrado.inicio) &&
          (!filtrado.fim || (g.vencimento ?? "") <= filtrado.fim),
      )
    : [];

  const colunas: ColunaTabela<Guia>[] = [
    { chave: "numero", titulo: "Número Guia", valor: (g) => g.numero },
    { chave: "valor", titulo: "Valor", valor: (g) => g.valor, render: (g) => real(g.valor) },
    { chave: "venc", titulo: "Vencimento", valor: (g) => g.vencimento, render: (g) => fmtData(g.vencimento) },
    { chave: "pag", titulo: "Pagamento", valor: (g) => (g.pago ? "Pago" : "Pendente") },
    { chave: "dpag", titulo: "Data Pagamento", valor: (g) => g.data_pagamento, render: (g) => fmtData(g.data_pagamento) },
    { chave: "nfse", titulo: "NFS-e", valor: () => "" },
    { chave: "stnf", titulo: "Status NF", valor: () => "" },
    { chave: "ret", titulo: "Retorno NF", valor: () => "" },
    {
      chave: "acoes",
      titulo: "Ações",
      valor: () => "",
      exportar: false,
      ordenavel: false,
      render: (g) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex size-[30px] items-center justify-center rounded-[0.358rem] text-primary hover:bg-primary/10" aria-label="Ações">
            <MoreVertical className="size-[14px]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => window.open(`/guias-adm/${g.id}`, "_blank")}>Visualizar Guia</DropdownMenuItem>
            {podePagar && !g.pago && <DropdownMenuItem onClick={() => setModal({ tipo: "pagar", guia: g })}>Confirmar Pagamento</DropdownMenuItem>}
            {podePagar && g.pago && <DropdownMenuItem onClick={() => setModal({ tipo: "estornar", guia: g })}>Estornar Pagamento</DropdownMenuItem>}
            {podePagar && <DropdownMenuItem onClick={() => toast.info("A emissão de NFS-e (prefeitura) ainda não está disponível no sistema novo.")}>Emitir NFS-e</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <Cartao>
        <div className="border-b border-border px-[1.5rem] py-[1.5rem]">
          <h4 className="mb-0 text-[1.285rem] font-medium">Filtro</h4>
        </div>
        <div className="px-[1.5rem] pt-[1.5rem] pb-[1.5rem]">
          <div className={podePagar && !filtrado ? "grid gap-x-[1.5rem] md:grid-cols-[5fr_3fr_2fr_2fr]" : "grid gap-x-[1.5rem] md:grid-cols-[6fr_2fr_2fr_2fr]"}>
            <Campo rotulo="Obra" htmlFor="c-obra">
              <select id="c-obra" value={filtro.obra} onChange={(e) => setFiltro({ ...filtro, obra: e.target.value })} className={selectClass}>
                <option value="">Selecione uma Obra</option>
                {obras.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </select>
            </Campo>
            {podePagar && !filtrado && (
              <Campo rotulo="NF Gerada" htmlFor="c-nf">
                <select id="c-nf" value={filtro.nf} onChange={(e) => setFiltro({ ...filtro, nf: e.target.value })} className={selectClass}>
                  <option value="">Selecione</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </Campo>
            )}
            <Campo rotulo={filtrado ? "Data Inicial" : "Vencimento De:"} htmlFor="c-ini">
              <Input id="c-ini" type="date" value={filtro.inicio} onChange={(e) => setFiltro({ ...filtro, inicio: e.target.value })} />
            </Campo>
            <Campo rotulo={filtrado ? "Data Final" : "Vencimento Ate:"} htmlFor="c-fim">
              <Input id="c-fim" type="date" value={filtro.fim} onChange={(e) => setFiltro({ ...filtro, fim: e.target.value })} />
            </Campo>
          </div>
          <div className="flex justify-end border-t border-border pt-[1rem]">
            <Button onClick={() => (filtro.obra ? setFiltrado(filtro) : toast.error("Selecione uma Obra."))}>Filtrar</Button>
          </div>
        </div>
        {filtrado && (
          <div className="pb-[0.5rem]">
            <TabelaDados colunas={colunas} linhas={linhas} chave={(g) => g.id} nomeArquivo="consulta-guias" />
          </div>
        )}
      </Cartao>

      <Dialog open={modal !== null} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="sm:max-w-2xl">
          {modal && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[1.1rem] font-medium text-heading">
                  {modal.tipo === "pagar" ? "Confirma o pagamento da Guia de Administração?" : "Confirma a exclução do pagamento da Guia de Administração?"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-x-[1.5rem] md:grid-cols-3">
                <Campo rotulo="Guia :" htmlFor="p-guia">
                  <Input id="p-guia" readOnly value={modal.guia.numero} />
                </Campo>
                <Campo rotulo="valor:" htmlFor="p-valor">
                  <Input id="p-valor" readOnly value={n2(modal.guia.valor)} />
                </Campo>
                <Campo rotulo="Vencimento:" htmlFor="p-venc">
                  <Input id="p-venc" type="date" readOnly value={modal.guia.vencimento ?? ""} />
                </Campo>
                {modal.tipo === "estornar" && (
                  <Campo rotulo="Data Pagamento:" htmlFor="p-data">
                    <Input id="p-data" type="date" readOnly value={modal.guia.data_pagamento ?? ""} />
                  </Campo>
                )}
              </div>
              <div className="flex gap-[0.5rem]">
                <Button
                  disabled={pending}
                  onClick={() =>
                    rodar(
                      () => pagarGuiaAdm(modal.guia.id, modal.tipo === "pagar"),
                      modal.tipo === "pagar" ? "Pagamento confirmado." : "Pagamento estornado.",
                      () => setModal(null),
                    )
                  }
                >
                  Confirmar
                </Button>
                <Button variant="outline" onClick={() => setModal(null)}>
                  Cancelar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

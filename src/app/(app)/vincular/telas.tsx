"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Edit, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cartao, Campo } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import { cabecalho, celula, editavelCls } from "@/components/astro/itens";
import { selectClass } from "@/components/cadastros/registro-form";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { data as fmtData, dataHora } from "@/lib/format";
import { linkAnexo, registrarAnexo, removerAnexo } from "@/lib/notas/actions";
import { editarBancoLancamento, editarLancamentoAzul, excluirLancamento, vincularNfAzul, vincularNfCinza, type Resultado } from "@/lib/vinculo/actions";

// "Vincular OCXNF" (Fase Cinza) e "Vincular OC Adm" (Fase Azul) do AstroTools.

export type CabecalhoVinculo = {
  id: number;
  numero_cliente: number | null;
  servico: string;
  cliente: string;
  fornecedor: string;
  valor_total: number;
  utilizado: number;
  disponivel: number;
};
export type Anexo = { id: number; nome: string; criado_em: string };
export type Lancamento = {
  id: number;
  numero: string;
  serie: string;
  tipo_documento: string | null;
  vencimento: string;
  valor: number;
  status: string;
  tipo_pagamento: string | null;
  favorecido_cpf_cnpj: string | null;
  favorecido: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  anexos: Anexo[];
  ccs: string;
};
export type CcVinculo = { cc_id: number; codigo: string; descricao: string; apropriado: number; disponivel: number };

const n2 = (v: number) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const real = (v: number) => `R$ ${n2(v)}`;
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const numero = (s: string) => {
  const t = s.trim();
  if (!t) return 0;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : NaN;
};

const STATUS: Record<string, string> = {
  aguardando_engenharia: "EM ABERTO",
  reprovada: "REPROVADA",
  pendente_pagamento: "LIBERADA",
  aguardando_guia: "PENDENTE",
  em_guia: "EM GUIA",
  paga: "PAGA",
  cancelada: "CANCELADA",
};

function useAcao() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const rodar = (fn: () => Promise<Resultado>, ok: string, depois?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.erro);
      toast.success(ok);
      depois?.();
      router.refresh();
    });
  return { pending, rodar };
}

async function enviarArquivos(notaId: number, files: File[]) {
  const supabase = createClient();
  for (const file of files) {
    const caminho = `${notaId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error } = await supabase.storage.from("nf-anexos").upload(caminho, file);
    if (error) {
      toast.error(`Falha ao enviar ${file.name}: ${error.message}`);
      continue;
    }
    await registrarAnexo(notaId, caminho, file.name, file.size);
  }
}

function Dados({ c, fase }: { c: CabecalhoVinculo; fase: "cinza" | "azul" }) {
  return (
    <>
      <div className="grid gap-x-[2rem] md:grid-cols-[2fr_2fr_8fr]">
        <Campo rotulo="Pedido" htmlFor="v-ped">
          <Input id="v-ped" readOnly value={c.id} />
        </Campo>
        <Campo rotulo={fase === "cinza" ? "Num. Cliente" : "Num Oc Cliente:"} htmlFor="v-num">
          <Input id="v-num" readOnly value={c.numero_cliente ?? ""} />
        </Campo>
        <Campo rotulo="Serviço" htmlFor="v-serv">
          <Input id="v-serv" readOnly value={c.servico} />
        </Campo>
      </div>
      <div className="grid gap-x-[2rem] md:grid-cols-2">
        <Campo rotulo="Cliente" htmlFor="v-cli">
          <Input id="v-cli" readOnly value={c.cliente} />
        </Campo>
        <Campo rotulo="Fornecedor" htmlFor="v-forn">
          <Input id="v-forn" readOnly value={c.fornecedor} />
        </Campo>
      </div>
      <div className="grid gap-x-[2rem] md:grid-cols-3">
        <Campo rotulo="Valor Total" htmlFor="v-tot">
          <Input id="v-tot" readOnly value={n2(c.valor_total)} />
        </Campo>
        <Campo rotulo="Valor Utilizado" htmlFor="v-uti">
          <Input id="v-uti" readOnly value={n2(c.utilizado)} />
        </Campo>
        <Campo rotulo={fase === "cinza" ? "Valor Pendente" : "Saldo Pendente"} htmlFor="v-pend">
          <Input id="v-pend" readOnly value={n2(c.disponivel)} />
        </Campo>
      </div>
    </>
  );
}

function ModalArquivos({ ocId, nota, onFechar }: { ocId: number; nota: Lancamento; onFechar: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const { pending, rodar } = useAcao();
  const [enviando, setEnviando] = useState(false);
  return (
    <div>
      <div className="flex gap-2">
        <Input ref={ref} type="file" multiple />
        <Button
          disabled={enviando || pending}
          onClick={async () => {
            const files = [...(ref.current?.files ?? [])];
            if (!files.length) return void toast.error("Escolha um arquivo.");
            setEnviando(true);
            await enviarArquivos(nota.id, files);
            setEnviando(false);
            rodar(async () => ({ ok: true }), "Arquivo(s) enviado(s).", onFechar);
          }}
        >
          {enviando ? "Enviando…" : "Adicionar"}
        </Button>
      </div>
      <table className="mt-[1.5rem] w-full text-[1rem]">
        <thead>
          <tr>
            <th className={cabecalho}>Arquivo</th>
            <th className={cabecalho}>Data</th>
            <th className={cabecalho} />
          </tr>
        </thead>
        <tbody>
          {nota.anexos.length === 0 && (
            <tr>
              <td colSpan={3} className={cn(celula, "text-center")}>
                Nenhum registro encontrado
              </td>
            </tr>
          )}
          {nota.anexos.map((a) => (
            <tr key={a.id}>
              <td className={celula}>
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={async () => {
                    const r = await linkAnexo(a.id);
                    if (!r.ok) return void toast.error(r.erro);
                    window.open(r.url, "_blank");
                  }}
                >
                  {a.nome}
                </button>
              </td>
              <td className={celula}>{dataHora(a.criado_em)}</td>
              <td className={celula}>
                {!["paga", "em_guia"].includes(nota.status) && (
                  <button
                    type="button"
                    aria-label="Excluir arquivo"
                    className="text-[#ea5455]"
                    onClick={() => confirm("Excluir o arquivo?") && rodar(async () => removerAnexo(a.id, nota.id) as Promise<Resultado>, "Arquivo excluído.", onFechar)}
                  >
                    <Trash2 className="size-[14px]" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[0.857rem] text-muted-foreground">Nota {nota.numero}</p>
      <span className="sr-only">{ocId}</span>
    </div>
  );
}

// ------------------------------------------------------------------ Fase Cinza

export function VincularCinza({ cab, notas }: { cab: CabecalhoVinculo; notas: Lancamento[] }) {
  const [f, setF] = useState({ numero: "", serie: "1", tipo: "NOTA FISCAL", vencimento: hoje(), valor: "" });
  const arquivo = useRef<HTMLInputElement>(null);
  const [arquivosDe, setArquivosDe] = useState<Lancamento | null>(null);
  const { pending, rodar } = useAcao();

  const adicionar = () => {
    const v = numero(f.valor);
    if (Number.isNaN(v) || v <= 0) return void toast.error("Informe o Valor.");
    const files = [...(arquivo.current?.files ?? [])];
    rodar(
      async () => {
        const r = await vincularNfCinza(cab.id, { numero: f.numero, serie: f.serie, tipo_documento: f.tipo, vencimento: f.vencimento, valor: v });
        if (r.ok && r.id && files.length) await enviarArquivos(r.id, files);
        return r;
      },
      "Operação realizada com sucesso!",
      () => {
        setF({ numero: "", serie: "1", tipo: "NOTA FISCAL", vencimento: hoje(), valor: "" });
        if (arquivo.current) arquivo.current.value = "";
      },
    );
  };

  const colunas: ColunaTabela<Lancamento>[] = [
    { chave: "nota", titulo: "Nota", valor: (n) => n.numero },
    { chave: "serie", titulo: "Serie", valor: (n) => n.serie },
    { chave: "tipo", titulo: "Tipo", valor: (n) => n.tipo_documento ?? "NOTA FISCAL" },
    { chave: "venc", titulo: "Vencimento", valor: (n) => n.vencimento, render: (n) => fmtData(n.vencimento) },
    { chave: "valor", titulo: "Valor", valor: (n) => Number(n.valor), render: (n) => n2(n.valor) },
    { chave: "status", titulo: "Status", valor: (n) => STATUS[n.status] ?? n.status },
    {
      chave: "arq",
      titulo: "Arquivo",
      valor: (n) => n.anexos.length,
      exportar: false,
      render: (n) => (
        <button type="button" title="Arquivos" className="text-primary" onClick={() => setArquivosDe(n)}>
          <FileText className="size-[16px]" />
          {n.anexos.length > 0 && <span className="ml-1 text-[0.8rem]">{n.anexos.length}</span>}
        </button>
      ),
    },
    {
      chave: "acoes",
      titulo: "Ações",
      valor: () => "",
      exportar: false,
      ordenavel: false,
      render: (n) =>
        ["aguardando_engenharia", "reprovada", "pendente_pagamento"].includes(n.status) ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => confirm(`Excluir a nota ${n.numero}?`) && rodar(() => excluirLancamento(cab.id, n.id), "Nota excluída.")}
            className="rounded-[0.358rem] bg-[#ea5455] px-[0.7rem] py-[0.2rem] text-[0.857rem] text-white"
          >
            Excluir
          </button>
        ) : null,
    },
  ];

  return (
    <Cartao>
      <div className="px-[1.5rem] pt-[1.5rem]">
        <Dados c={cab} fase="cinza" />
        <div className="grid gap-x-[1.5rem] md:grid-cols-[2fr_1fr_2fr_3fr_4fr]">
          <Campo rotulo="Nota Fiscal" htmlFor="c-num">
            <Input id="c-num" type="number" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} />
          </Campo>
          <Campo rotulo="Serie" htmlFor="c-serie">
            <Input id="c-serie" type="number" value={f.serie} onChange={(e) => setF({ ...f, serie: e.target.value })} />
          </Campo>
          <Campo rotulo="Tipo NF" htmlFor="c-tipo">
            <select id="c-tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} className={selectClass}>
              <option value="NOTA FISCAL">Nota Fiscal</option>
              <option value="RECIBO">Recibo</option>
            </select>
          </Campo>
          <Campo rotulo="Vencimento" htmlFor="c-venc">
            <Input id="c-venc" type="date" value={f.vencimento} onChange={(e) => setF({ ...f, vencimento: e.target.value })} />
          </Campo>
          <Campo rotulo="Valor" htmlFor="c-valor">
            <Input id="c-valor" inputMode="decimal" placeholder="0,00" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />
          </Campo>
        </div>
        <Campo rotulo="Arquivo" htmlFor="c-arq" className="md:w-1/4">
          <Input id="c-arq" ref={arquivo} type="file" multiple />
        </Campo>
        <div className="pb-[1.5rem]">
          <Button onClick={adicionar} disabled={pending || cab.disponivel <= 0}>
            Adicionar
          </Button>
        </div>
      </div>
      <div className="border-t border-border">
        <TabelaDados colunas={colunas} linhas={notas} chave={(n) => n.id} nomeArquivo="notas-oc" />
      </div>
      <Dialog open={arquivosDe !== null} onOpenChange={(o) => !o && setArquivosDe(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[1.285rem] font-medium text-heading">Arquivos-NF</DialogTitle>
          </DialogHeader>
          {arquivosDe && <ModalArquivos ocId={cab.id} nota={arquivosDe} onFechar={() => setArquivosDe(null)} />}
        </DialogContent>
      </Dialog>
    </Cartao>
  );
}

// ------------------------------------------------------------------ Fase Azul

const TIPOS_AZUL = ["BOLETO", "NF", "RECIBO", "TRANSFERENCIA"];
const incompleto = (n: Lancamento) => !n.favorecido_cpf_cnpj || !n.favorecido || !n.banco || !n.agencia || !n.conta;

export function VincularAzul({ cab, notas, ccs }: { cab: CabecalhoVinculo; notas: Lancamento[]; ccs: CcVinculo[] }) {
  const [f, setF] = useState({ numero: "", tipo: "NF", vencimento: "", tipo_pagamento: "", rateio: "" });
  const [linhas, setLinhas] = useState(() => ccs.map((c) => ({ ...c, valor: "0" })));
  const [editar, setEditar] = useState<Lancamento | null>(null);
  const [banco, setBanco] = useState<Lancamento | null>(null);
  const [arquivosDe, setArquivosDe] = useState<Lancamento | null>(null);
  const [ed, setEd] = useState({ numero: "", tipo: "NF", vencimento: "", tipo_pagamento: "" });
  const [bc, setBc] = useState({ cpf_cnpj: "", favorecido: "", banco: "", agencia: "", conta: "" });
  const arquivo = useRef<HTMLInputElement>(null);
  const { pending, rodar } = useAcao();

  const totalApropriado = ccs.reduce((s, c) => s + c.apropriado, 0);
  const soma = linhas.reduce((s, l) => s + (numero(l.valor) || 0), 0);

  const ratear = () => {
    const v = numero(f.rateio);
    if (Number.isNaN(v) || v <= 0 || !totalApropriado) return;
    const novas = linhas.map((l) => ({ ...l, valor: (Math.round((l.apropriado / totalApropriado) * v * 100) / 100).toFixed(2).replace(".", ",") }));
    if (novas.some((l) => numero(l.valor) > l.disponivel + 0.005)) {
      return void toast.error("O valor rateado é maior que o valor disponivel, por favor, valide o valor inserido e tente novamente.");
    }
    setLinhas(novas);
  };

  const salvar = () => {
    if (linhas.some((l) => Number.isNaN(numero(l.valor)))) return void toast.error("Valor inválido no rateio.");
    const files = [...(arquivo.current?.files ?? [])];
    rodar(
      async () => {
        const r = await vincularNfAzul(
          cab.id,
          { numero: f.numero, tipo_documento: f.tipo, vencimento: f.vencimento, tipo_pagamento: f.tipo_pagamento },
          linhas.map((l) => ({ cc_id: l.cc_id, valor: numero(l.valor) })),
        );
        if (r.ok && r.id && files.length) await enviarArquivos(r.id, files);
        return r;
      },
      "Operação realizada com sucesso!",
      () => {
        setF({ numero: "", tipo: "NF", vencimento: "", tipo_pagamento: "", rateio: "" });
        if (arquivo.current) arquivo.current.value = "";
      },
    );
  };

  const colunas: ColunaTabela<Lancamento>[] = [
    { chave: "ped", titulo: "Pedido", valor: () => cab.id },
    { chave: "pedc", titulo: "Pedido Cliente", valor: () => cab.numero_cliente ?? "" },
    { chave: "desc", titulo: "Descrição Pedido", valor: () => cab.servico },
    {
      chave: "forn",
      titulo: "Fornecedor",
      valor: () => cab.fornecedor,
      render: (n) => (
        <span>
          {cab.fornecedor}{" "}
          <button
            type="button"
            title="Alterar Dados Bancários"
            onClick={() => {
              setBanco(n);
              setBc({ cpf_cnpj: n.favorecido_cpf_cnpj ?? "", favorecido: n.favorecido ?? "", banco: n.banco ?? "", agencia: n.agencia ?? "", conta: n.conta ?? "" });
            }}
            className={cn("ml-1 text-[0.857rem] font-semibold", incompleto(n) ? "text-[#ea5455]" : "text-[#28c76f]")}
          >
            {incompleto(n) ? "Incompleto" : "Completo"}
          </button>
        </span>
      ),
    },
    { chave: "valor", titulo: "Valor", valor: (n) => Number(n.valor), render: (n) => real(n.valor), className: "whitespace-nowrap" },
    { chave: "tipo", titulo: "Tipo", valor: (n) => n.tipo_documento ?? "" },
    { chave: "num", titulo: "Nota/Parcela", valor: (n) => n.numero },
    { chave: "venc", titulo: "Vencimento", valor: (n) => n.vencimento, render: (n) => fmtData(n.vencimento) },
    { chave: "pag", titulo: "Pagamento", valor: (n) => n.tipo_pagamento ?? "" },
    { chave: "aprop", titulo: "Apropriação", valor: (n) => n.ccs },
    {
      chave: "arq",
      titulo: "Arquivo",
      valor: (n) => n.anexos.length,
      exportar: false,
      render: (n) => (
        <button type="button" title="Download" className="text-primary" onClick={() => setArquivosDe(n)}>
          <Download className="size-[14px]" />
          {n.anexos.length > 0 && <span className="ml-1 text-[0.8rem]">{n.anexos.length}</span>}
        </button>
      ),
    },
    {
      chave: "acoes",
      titulo: "Ações",
      valor: () => "",
      exportar: false,
      ordenavel: false,
      render: (n) =>
        ["em_guia", "paga"].includes(n.status) ? (
          <span className="text-[0.9rem] font-semibold text-[#28c76f]">Nota Vinculada</span>
        ) : (
          <span className="flex items-center gap-[0.5rem]">
            <button type="button" title="Excluir" className="text-[#ea5455]" disabled={pending} onClick={() => confirm(`Excluir o lançamento ${n.numero}?`) && rodar(() => excluirLancamento(cab.id, n.id), "Lançamento excluído.")}>
              <Trash2 className="size-[14px]" />
            </button>
            <button
              type="button"
              title="Editar NF"
              className="text-[#00cfe8]"
              onClick={() => {
                setEditar(n);
                setEd({ numero: n.numero, tipo: n.tipo_documento ?? "NF", vencimento: n.vencimento, tipo_pagamento: n.tipo_pagamento ?? "" });
              }}
            >
              <Edit className="size-[14px]" />
            </button>
          </span>
        ),
    },
  ];

  return (
    <Cartao>
      <div className="px-[1.5rem] pt-[1.5rem]">
        <Dados c={cab} fase="azul" />
        <div className="grid gap-x-[1.5rem] md:grid-cols-[3fr_2fr_3fr_4fr]">
          <Campo rotulo="NºNota/Parcela" htmlFor="a-num">
            <Input id="a-num" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} />
          </Campo>
          <Campo rotulo="Tipo NF" htmlFor="a-tipo">
            <select id="a-tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} className={selectClass}>
              {TIPOS_AZUL.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Data de Vencimento" htmlFor="a-venc">
            <Input id="a-venc" type="date" value={f.vencimento} onChange={(e) => setF({ ...f, vencimento: e.target.value })} />
          </Campo>
          <Campo rotulo="Tipo Pagamento" htmlFor="a-pag">
            <Input id="a-pag" value={f.tipo_pagamento} onChange={(e) => setF({ ...f, tipo_pagamento: e.target.value })} />
          </Campo>
        </div>
        <div className="grid gap-x-[1.5rem] md:grid-cols-3">
          <Campo rotulo="Valor Lançamento (Soma dos valores informados)" htmlFor="a-soma">
            <Input id="a-soma" readOnly value={n2(soma)} />
          </Campo>
          <Campo rotulo="Arquivo" htmlFor="a-arq">
            <Input id="a-arq" ref={arquivo} type="file" multiple />
          </Campo>
          <Campo rotulo="Valor a ser rateado entre os CC" htmlFor="a-rat">
            <Input id="a-rat" inputMode="decimal" value={f.rateio} onChange={(e) => setF({ ...f, rateio: e.target.value })} />
          </Campo>
        </div>
        <div className="mb-[1rem] grid md:grid-cols-4">
          <Button variant="outline" onClick={ratear}>
            Efetuar rateiro proporcional
          </Button>
        </div>
        <table className="w-full text-[1rem]">
          <thead>
            <tr>
              {["CC", "Descrição", "Apropriado", "Disponivel", "Valor", "Ações"].map((c) => (
                <th key={c} className={cabecalho}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td colSpan={6} className={cn(celula, "text-center")}>
                  A OC não tem apropriações.
                </td>
              </tr>
            )}
            {linhas.map((l) => (
              <tr key={l.cc_id}>
                <td className={celula}>{l.codigo}</td>
                <td className={celula}>{l.descricao}</td>
                <td className={celula}>{n2(l.apropriado)}</td>
                <td className={celula}>{n2(l.disponivel)}</td>
                <td className={celula}>
                  <input value={l.valor} onChange={(e) => setLinhas((ls) => ls.map((x) => (x.cc_id === l.cc_id ? { ...x, valor: e.target.value } : x)))} className={editavelCls} aria-label={`Valor ${l.codigo}`} />
                </td>
                <td className={celula}>
                  <button type="button" onClick={() => setLinhas((ls) => ls.filter((x) => x.cc_id !== l.cc_id))} className="rounded-[0.358rem] bg-[#ea5455] px-[0.7rem] py-[0.2rem] text-[0.857rem] text-white">
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="py-[1.5rem]">
          <Button onClick={salvar} disabled={pending || soma <= 0}>
            Salvar
          </Button>
        </div>
      </div>
      <div className="border-t border-border">
        <TabelaDados colunas={colunas} linhas={notas} chave={(n) => n.id} nomeArquivo="lancamentos-oc" />
      </div>

      <Dialog open={editar !== null} onOpenChange={(o) => !o && setEditar(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-[1.1rem] font-medium text-heading">Deseja alterar os dados do lançamento?</DialogTitle>
          </DialogHeader>
          {editar && (
            <div>
              <Campo rotulo="Controle:" htmlFor="e-ctrl">
                <Input id="e-ctrl" value={ed.numero} onChange={(e) => setEd({ ...ed, numero: e.target.value })} />
              </Campo>
              <Campo rotulo="Tipo" htmlFor="e-tipo">
                <select id="e-tipo" value={ed.tipo} onChange={(e) => setEd({ ...ed, tipo: e.target.value })} className={selectClass}>
                  {TIPOS_AZUL.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Vencimento:" htmlFor="e-venc">
                <Input id="e-venc" type="date" value={ed.vencimento} onChange={(e) => setEd({ ...ed, vencimento: e.target.value })} />
              </Campo>
              <Campo rotulo="valor:" htmlFor="e-valor">
                <Input id="e-valor" readOnly value={n2(editar.valor)} />
              </Campo>
              <Campo rotulo="Tipo Pagamento:" htmlFor="e-pag">
                <Input id="e-pag" value={ed.tipo_pagamento} onChange={(e) => setEd({ ...ed, tipo_pagamento: e.target.value })} />
              </Campo>
              <div className="flex gap-[0.5rem]">
                <Button
                  disabled={pending}
                  onClick={() =>
                    rodar(() => editarLancamentoAzul(cab.id, editar.id, { numero: ed.numero, tipo_documento: ed.tipo, vencimento: ed.vencimento, tipo_pagamento: ed.tipo_pagamento }), "Lançamento alterado.", () =>
                      setEditar(null),
                    )
                  }
                >
                  Confirmar
                </Button>
                <Button variant="outline" onClick={() => setEditar(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={banco !== null} onOpenChange={(o) => !o && setBanco(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-[1.1rem] font-medium text-heading">Deseja alterar os dados do bancarios?</DialogTitle>
          </DialogHeader>
          {banco && (
            <div>
              {(
                [
                  ["cpf_cnpj", "CNPJ"],
                  ["favorecido", "Favorecido"],
                  ["banco", "Banco"],
                  ["agencia", "Agencia"],
                  ["conta", "Conta"],
                ] as const
              ).map(([k, r]) => (
                <Campo key={k} rotulo={r} htmlFor={`b-${k}`}>
                  <Input id={`b-${k}`} value={bc[k]} onChange={(e) => setBc({ ...bc, [k]: e.target.value })} />
                </Campo>
              ))}
              <div className="flex gap-[0.5rem]">
                <Button disabled={pending} onClick={() => rodar(() => editarBancoLancamento(cab.id, banco.id, bc), "Dados bancários alterados.", () => setBanco(null))}>
                  Confirmar
                </Button>
                <Button variant="outline" onClick={() => setBanco(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={arquivosDe !== null} onOpenChange={(o) => !o && setArquivosDe(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[1.285rem] font-medium text-heading">Arquivos-NF</DialogTitle>
          </DialogHeader>
          {arquivosDe && <ModalArquivos ocId={cab.id} nota={arquivosDe} onFechar={() => setArquivosDe(null)} />}
        </DialogContent>
      </Dialog>
    </Cartao>
  );
}

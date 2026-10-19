"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Calendar, ClipboardList, DollarSign, FileText, MapPin, Printer, Slash, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Cartao, Campo } from "@/components/astro/basicos";
import { BuscaItens, cabecalho, celula, editavelCls, type CcSaldo } from "@/components/astro/itens";
import { selectClass } from "@/components/cadastros/registro-form";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { data as fmtData, dataHora } from "@/lib/format";
import { UFS } from "@/lib/cadastros/config";
import type { ItemCatalogo } from "@/lib/compras/tipos";
import { STATUS_OC_ORIGINAL } from "@/lib/ocs/tipos";
import {
  alternarRegularizacaoOc,
  apropriarOc,
  excluirApropriacaoOc,
  excluirArquivoOc,
  linkArquivoOc,
  registrarArquivoOc,
  salvarOc,
  zerarSaldoOc,
  type DadosOc,
  type ItemOcEnvio,
  type Resultado,
} from "@/lib/ocs/actions";

// "Vizualizar Ordem" do AstroTools.

const TIPOS = [
  { valor: "compra", rotulo: "Compra de Materias" },
  { valor: "locacao", rotulo: "Serviço de Locação" },
  { valor: "servico", rotulo: "Serviço" },
];
const TIPOS_CONTRATO = ["Material", "Mão de Obra", "Material e Mão de Obra"];

const n2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const vlMedio = (v: number | null) => (v == null ? "N/A" : `R$ ${v.toFixed(2).replace(".", ",")}`);
const numero = (s: string) => {
  const t = s.trim();
  if (!t) return 0;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : NaN;
};
let seq = 0;
const novaChave = () => `n${++seq}`;

export type CabecalhoOc = {
  id: number;
  numero_cliente: number | null;
  mapa_id: number | null;
  status: string;
  pendencia: string | null;
  regularizacao_engenharia: boolean;
  obra_rotulo: string;
  filial: string;
  fornecedor_rotulo: string;
  percentual_especial: number | null;
  frete: number;
  desconto: number;
  total_apropriado: number;
  total_pago: number;
  dados: DadosOc;
  complemento: Record<string, string>;
};
export type ItemOc = {
  id: number;
  e_titulo: boolean;
  item_id: number | null;
  codigo: string | null;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_impostos: number;
  valor_medio: number | null;
};
export type AproOc = { id: number; cc_codigo: string; cc_descricao: string; valor: number; saldo_ref: number | null };
export type NotaOc = { id: number; numero: string; serie: string; valor: number; pago_em: string | null; status: string; fase: string; fornecedor: string; usuario: string; vencimento: string; guia: number | null };
type Arquivo = { id: number; nome: string; enviado_em: string };
type Justificativa = { id: number; status: string; justificativa: string; responsavel: string; criado_em: string };

type Linha = {
  chave: string;
  id?: number;
  e_titulo: boolean;
  item_id: number | null;
  codigo: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  valor_unitario: string;
  valor_impostos: string;
  valor_medio: number | null;
  excluir: boolean;
};

function paraLinha(i: ItemOc): Linha {
  return {
    chave: `i${i.id}`,
    id: i.id,
    e_titulo: i.e_titulo,
    item_id: i.item_id,
    codigo: i.codigo ?? "0",
    descricao: i.descricao,
    quantidade: n2(Number(i.quantidade)),
    unidade: i.unidade,
    valor_unitario: n2(Number(i.valor_unitario)),
    valor_impostos: n2(Number(i.valor_impostos)),
    valor_medio: i.valor_medio,
    excluir: false,
  };
}

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

function TabelaSimples({ colunas, children, vazia }: { colunas: string[]; children?: React.ReactNode; vazia: boolean }) {
  return (
    <table className="w-full text-[1rem]">
      <thead>
        <tr>
          {colunas.map((c, i) => (
            <th key={`${c}-${i}`} className={cabecalho}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {vazia && (
          <tr>
            <td colSpan={colunas.length} className={cn(celula, "text-center")}>
              Nenhum registro encontrado
            </td>
          </tr>
        )}
        {children}
      </tbody>
    </table>
  );
}

function ModalApropriacoes({ oc, total, aprops, ccs, podeEditar }: { oc: number; total: number; aprops: AproOc[]; ccs: CcSaldo[]; podeEditar: boolean }) {
  const [cc, setCc] = useState("");
  const [valor, setValor] = useState("");
  const { pending, rodar } = useAcao();
  const apropriado = aprops.reduce((s, a) => s + Number(a.valor), 0);
  const escolhido = ccs.find((c) => String(c.id) === cc);
  return (
    <div>
      <div className="grid gap-x-[1.5rem] md:grid-cols-3">
        <Campo rotulo="Valor OC:" htmlFor="ap-total">
          <Input id="ap-total" readOnly value={n2(total)} />
        </Campo>
        <Campo rotulo="Valor Apropriado:" htmlFor="ap-apont">
          <Input id="ap-apont" readOnly value={n2(apropriado)} />
        </Campo>
        <Campo rotulo="Valor Restante:" htmlFor="ap-rest">
          <Input id="ap-rest" readOnly value={n2(total - apropriado)} />
        </Campo>
      </div>
      {podeEditar && (
        <>
          <div className="grid gap-x-[1.5rem] md:grid-cols-[3fr_1fr]">
            <Campo rotulo="Apropriação:" htmlFor="ap-cc">
              <select id="ap-cc" value={cc} onChange={(e) => setCc(e.target.value)} className={selectClass}>
                <option value="">Selecione</option>
                {ccs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} - {c.descricao.slice(0, 90)} | Saldo: {n2(c.saldo)}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Valor Saldo:" htmlFor="ap-saldo">
              <Input id="ap-saldo" readOnly value={escolhido ? n2(escolhido.saldo) : ""} />
            </Campo>
          </div>
          <div className="flex items-end gap-[1rem]">
            <Campo rotulo="Saldo a utilizar:" htmlFor="ap-valor" className="w-[14rem]">
              <Input id="ap-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
            </Campo>
            <Button
              className="mb-[1rem]"
              disabled={pending || !cc}
              onClick={() => {
                const v = numero(valor);
                if (Number.isNaN(v) || v <= 0) return void toast.error("Informe o saldo a utilizar.");
                rodar(() => apropriarOc(oc, Number(cc), v), "Apropriação incluída.", () => {
                  setCc("");
                  setValor("");
                });
              }}
            >
              Adicionar
            </Button>
          </div>
        </>
      )}
      <hr className="my-[1rem] border-border" />
      <TabelaSimples colunas={["Apropriação", "Descrição", "Valor Apontado", "Saldo Aprop.", "Del."]} vazia={aprops.length === 0}>
        {aprops.map((a) => (
          <tr key={a.id}>
            <td className={celula}>{a.cc_codigo}</td>
            <td className={celula}>{a.cc_descricao}</td>
            <td className={celula}>{n2(Number(a.valor))}</td>
            <td className={celula}>{a.saldo_ref == null ? "" : n2(Number(a.saldo_ref))}</td>
            <td className={celula}>
              {podeEditar && (
                <button type="button" aria-label="Excluir" disabled={pending} className="text-[#ea5455]" onClick={() => confirm("Excluir esta apropriação?") && rodar(() => excluirApropriacaoOc(oc, a.id), "Apropriação excluída.")}>
                  <Trash2 className="size-[14px]" />
                </button>
              )}
            </td>
          </tr>
        ))}
      </TabelaSimples>
    </div>
  );
}

function ModalArquivos({ oc, arquivos }: { oc: number; arquivos: Arquivo[] }) {
  const ref = useRef<HTMLInputElement>(null);
  const { pending, rodar } = useAcao();
  const [enviando, setEnviando] = useState(false);
  const enviar = async () => {
    const files = [...(ref.current?.files ?? [])];
    if (!files.length) return void toast.error("Escolha um arquivo.");
    setEnviando(true);
    const supabase = createClient();
    for (const file of files) {
      const caminho = `${oc}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error } = await supabase.storage.from("oc-arquivos").upload(caminho, file);
      if (error) {
        toast.error(`Falha ao enviar ${file.name}: ${error.message}`);
        continue;
      }
      await registrarArquivoOc(oc, caminho, file.name, file.size);
    }
    setEnviando(false);
    if (ref.current) ref.current.value = "";
    rodar(async () => ({ ok: true }), "Arquivo(s) enviado(s).");
  };
  return (
    <div>
      <h6 className="mb-[0.5rem] text-[1rem] font-medium">Arquivos:</h6>
      <div className="flex gap-2">
        <Input ref={ref} type="file" multiple />
        <Button onClick={enviar} disabled={enviando || pending}>
          {enviando ? "Enviando…" : "Adicionar"}
        </Button>
      </div>
      <div className="mt-[1.5rem]">
        <TabelaSimples colunas={["Arquivo", "Data", ""]} vazia={arquivos.length === 0}>
          {arquivos.map((a) => (
            <tr key={a.id}>
              <td className={celula}>
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={async () => {
                    const r = await linkArquivoOc(a.id);
                    if (!r.ok) return void toast.error(r.erro);
                    window.open(r.url, "_blank");
                  }}
                >
                  {a.nome}
                </button>
              </td>
              <td className={celula}>{dataHora(a.enviado_em)}</td>
              <td className={celula}>
                <button type="button" aria-label="Excluir" className="text-[#ea5455]" onClick={() => confirm("Excluir o arquivo?") && rodar(() => excluirArquivoOc(oc, a.id), "Arquivo excluído.")}>
                  <Trash2 className="size-[14px]" />
                </button>
              </td>
            </tr>
          ))}
        </TabelaSimples>
      </div>
    </div>
  );
}

export function TelaOc({
  cabecalho: cab,
  itens,
  aprops,
  ccs,
  notas,
  arquivos,
  justificativas,
  catalogo,
  podeEditar,
}: {
  cabecalho: CabecalhoOc;
  itens: ItemOc[];
  aprops: AproOc[];
  ccs: CcSaldo[];
  notas: NotaOc[];
  arquivos: Arquivo[];
  justificativas: Justificativa[];
  catalogo: ItemCatalogo[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const editavel = podeEditar && cab.status !== "cancelada";
  const [d, setD] = useState<DadosOc>(cab.dados);
  const [comp, setComp] = useState<Record<string, string>>(cab.complemento);
  const [linhas, setLinhas] = useState<Linha[]>(() => itens.map(paraLinha));
  const [ativa, setAtiva] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "contrato" | "apropriacoes" | "entrega" | "pagamentos" | "justificativas" | "arquivos">(null);
  const [pending, startTransition] = useTransition();
  const { rodar } = useAcao();

  const inserir = (l: Linha) =>
    setLinhas((ls) => {
      const i = ativa ? ls.findIndex((x) => x.chave === ativa) : -1;
      return i < 0 ? [...ls, l] : [...ls.slice(0, i + 1), l, ...ls.slice(i + 1)];
    });
  const mudar = (chave: string, p: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...p } : l)));
  const campo = (k: keyof DadosOc) => ({ value: d[k], onChange: (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value }), disabled: !editavel });
  const cmp = (k: string) => ({ value: comp[k] ?? "", onChange: (e: { target: { value: string } }) => setComp({ ...comp, [k]: e.target.value }), disabled: !editavel });

  const totalItens = linhas.filter((l) => !l.excluir && !l.e_titulo).reduce((s, l) => s + (numero(l.quantidade) || 0) * (numero(l.valor_unitario) || 0) + (numero(l.valor_impostos) || 0), 0);
  const total = totalItens + cab.frete - cab.desconto;

  const salvar = () => {
    const envio: ItemOcEnvio[] = [];
    for (const l of linhas) {
      if (!l.descricao.trim() && !l.id) continue;
      const q = numero(l.quantidade);
      const u = numero(l.valor_unitario);
      const im = numero(l.valor_impostos);
      if ([q, u, im].some(Number.isNaN)) return void toast.error(`Valor inválido em "${l.descricao}".`);
      envio.push({ id: l.id, e_titulo: l.e_titulo, item_id: l.item_id, codigo: l.codigo, descricao: l.descricao.trim(), quantidade: q, unidade: l.unidade.trim(), valor_unitario: u, valor_impostos: im, excluir: l.excluir });
    }
    startTransition(async () => {
      const r = await salvarOc(cab.id, d, envio, comp);
      if (!r.ok) return void toast.error(r.erro);
      toast.success("Ordem de compra salva com sucesso.");
      router.refresh();
    });
  };

  const titulos = { contrato: "Contrato", apropriacoes: "Apropriações", entrega: "Local de Entrega", pagamentos: "Pagamentos", justificativas: "Justificativas", arquivos: "Arquivos" } as const;
  const notasPagas = notas.filter((n) => n.fase === "cinza");
  const guias = notas.filter((n) => n.fase === "azul" && n.guia != null);

  return (
    <Cartao>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-[1.5rem] py-[1.5rem]">
        <h4 className="mb-0 flex flex-wrap items-center gap-[1rem] text-[1.285rem] font-medium">
          <span>
            Ordem: {cab.numero_cliente ?? cab.id}
            {cab.mapa_id && (
              <>
                {" "}
                | Mapa:{" "}
                <Link href={`/mapas/${cab.mapa_id}`} target="_blank" className="text-primary">
                  {cab.mapa_id}
                </Link>
              </>
            )}
          </span>
          <Button
            variant="outline"
            disabled={!editavel}
            onClick={() =>
              confirm("Confirma a alteração do status de 'Regularização Engenharia' para essa Ordem de Compras?") &&
              rodar(() => alternarRegularizacaoOc(cab.id), "Regularização Engenharia alterada.")
            }
            className={cn(cab.regularizacao_engenharia && "border-primary text-primary")}
          >
            {cab.regularizacao_engenharia ? "Regularização Engenharia: Sim" : "Clique aqui para Regularização Engenharia"}
          </Button>
          {cab.status !== "aprovada" && (
            <span className={cn("text-[0.95rem] font-semibold", cab.status === "reprovada" ? "text-[#ea5455]" : "text-[#ff9f43]")} title={cab.pendencia ?? undefined}>
              {STATUS_OC_ORIGINAL[cab.status] ?? cab.status}
            </span>
          )}
        </h4>
        <div className="flex items-center">
          <button
            type="button"
            title="PDF Contrato"
            onClick={() => window.open(`/imprimir/oc/${cab.id}?tipo=contrato`, "_blank")}
            className="m-[2px] flex size-[30px] items-center justify-center rounded-full bg-[#82868b] text-white"
          >
            <FileText className="size-[14px]" />
          </button>
          <button
            type="button"
            title="PDF Pedido"
            onClick={() => (confirm("Gostaria de adicionar um Arquivo à Ordem de Compra?") ? setModal("arquivos") : window.open(`/imprimir/oc/${cab.id}`, "_blank"))}
            className="m-[2px] flex size-[30px] items-center justify-center rounded-full bg-[#00cfe8] text-white"
          >
            <Printer className="size-[14px]" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="m-[2px] flex h-[30px] items-center rounded-[0.358rem] bg-primary px-[0.8rem] text-[0.9rem] text-white">Opções</DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[13rem]">
              <DropdownMenuItem onClick={() => setModal("contrato")}>
                <ClipboardList /> Dados Contrato
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setModal("apropriacoes")}>
                <DollarSign /> Apropriações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setModal("entrega")}>
                <MapPin /> Local Entrega
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setModal("pagamentos")}>
                <Calendar /> Pagamentos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setModal("justificativas")}>
                <FileText /> Justificativa Aprovação
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setModal("arquivos")}>
                <Archive /> Arquivos
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  confirm("Confirma a operação? Esta opção zera o saldo apropriado não utilizado!") && rodar(() => zerarSaldoOc(cab.id), "Operação efetuada com sucesso!")
                }
              >
                <Slash /> Zerar Saldo Pedido
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {cab.pendencia && cab.status === "aguardando_aprovacao" && (
        <div className="mx-[1.5rem] mt-[1rem] rounded-[0.357rem] border border-[#ff9f43]/50 bg-[#ff9f43]/10 px-[1rem] py-[0.6rem] text-[0.95rem]">{cab.pendencia}</div>
      )}

      <div className="px-[1.5rem] pt-[1.5rem]">
        <div className="grid gap-x-[2rem] md:grid-cols-3">
          <Campo rotulo="Obra" htmlFor="o-obra">
            <Input id="o-obra" value={cab.obra_rotulo} disabled />
          </Campo>
          <Campo rotulo="Filial" htmlFor="o-filial">
            <Input id="o-filial" value={cab.filial} disabled />
          </Campo>
          <Campo rotulo="Fornecedor" htmlFor="o-forn">
            <Input id="o-forn" value={cab.fornecedor_rotulo} disabled />
          </Campo>
        </div>
        <div className="grid gap-x-[2rem] md:grid-cols-[9fr_2fr_1fr]">
          <Campo rotulo="Nome da Ordem" htmlFor="o-nome">
            <Input id="o-nome" {...campo("nome")} />
          </Campo>
          <Campo rotulo="Numero Cliente" htmlFor="o-num">
            <Input id="o-num" {...campo("numero_cliente")} />
          </Campo>
          <Campo rotulo="% Especial" htmlFor="o-pct">
            <Input id="o-pct" value={cab.percentual_especial ?? ""} disabled />
          </Campo>
        </div>
        <Campo rotulo="Observação" htmlFor="o-obs">
          <Textarea id="o-obs" rows={2} {...campo("observacao")} />
        </Campo>
        <div className="grid gap-x-[2rem] md:grid-cols-4">
          <Campo rotulo="Serviço" htmlFor="o-tipo">
            <select id="o-tipo" {...campo("tipo")} className={selectClass}>
              <option value="">Selecione</option>
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Data de Entrega" htmlFor="o-ent">
            <Input id="o-ent" type="date" {...campo("data_entrega")} />
          </Campo>
          <Campo rotulo="Prazo de Locação" htmlFor="o-prazo-loc">
            <Input id="o-prazo-loc" {...campo("prazo_locacao")} />
          </Campo>
          <Campo rotulo="Data de Devolução" htmlFor="o-dev">
            <Input id="o-dev" type="date" {...campo("data_devolucao")} />
          </Campo>
        </div>
        <div className="grid gap-x-[2rem] md:grid-cols-[3fr_3fr_2fr_2fr_2fr]">
          <Campo rotulo="Forma Pagamento" htmlFor="o-forma">
            <Input id="o-forma" {...campo("forma_pagamento")} />
          </Campo>
          <Campo rotulo="Prazo" htmlFor="o-prazo">
            <Input id="o-prazo" {...campo("prazo")} />
          </Campo>
          <Campo rotulo="Frete" htmlFor="o-frete">
            <Input id="o-frete" value={n2(cab.frete)} disabled />
          </Campo>
          <Campo rotulo="Desconto" htmlFor="o-desc">
            <Input id="o-desc" value={n2(cab.desconto)} disabled />
          </Campo>
          <Campo rotulo="Total" htmlFor="o-total">
            <Input id="o-total" value={n2(total)} readOnly />
          </Campo>
        </div>
        <div className="grid items-end gap-x-[2rem] md:grid-cols-[6fr_2fr_2fr_2fr]">
          <div className="mb-[1rem] flex gap-[0.5rem]">
            <Button onClick={salvar} disabled={!editavel || pending}>
              Salvar
            </Button>
            <Button variant="outline" onClick={() => router.back()}>
              Voltar
            </Button>
          </div>
          <Campo rotulo="Total Apropriado" htmlFor="o-tap">
            <Input id="o-tap" value={n2(cab.total_apropriado)} readOnly />
          </Campo>
          <Campo rotulo="Total Pago" htmlFor="o-tpg">
            <Input id="o-tpg" value={n2(cab.total_pago)} readOnly />
          </Campo>
          <Campo rotulo="Saldo" htmlFor="o-saldo">
            <Input id="o-saldo" value={n2(cab.total_apropriado - cab.total_pago)} readOnly />
          </Campo>
        </div>
      </div>

      <div className="px-[1.5rem] pt-[0.5rem] pb-[2.5rem]">
        <fieldset disabled={!editavel} className="mb-[1rem] space-y-[1rem]">
          <BuscaItens
            catalogo={catalogo}
            onAdicionar={(c) =>
              inserir({
                chave: novaChave(),
                e_titulo: false,
                item_id: c.id,
                codigo: c.codigo,
                descricao: c.descricao,
                quantidade: "0",
                unidade: c.unidade,
                valor_unitario: "0,00",
                valor_impostos: "0,00",
                valor_medio: c.valor_medio,
                excluir: false,
              })
            }
          />
          <Button
            variant="outline"
            onClick={() =>
              inserir({ chave: novaChave(), e_titulo: false, item_id: null, codigo: "0", descricao: "", quantidade: "0", unidade: "", valor_unitario: "0,00", valor_impostos: "0,00", valor_medio: null, excluir: false })
            }
          >
            Adicionar Linha
          </Button>
        </fieldset>

        <div className="overflow-x-auto">
          <table className="w-full text-[1rem]">
            <thead>
              <tr>
                {["Titulo", "Cod", "Item", "Qtde", "Unid.Med", "Vl.Unitário", "Vl.Total", "Vl.Impostos", "Vl.Médio", "Ação Excluir"].map((c) => (
                  <th key={c} className={cabecalho}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const livre = l.item_id == null;
                const pode = editavel && !l.excluir;
                const ed = (k: "descricao" | "quantidade" | "unidade" | "valor_unitario" | "valor_impostos", rotulo: string) =>
                  pode ? <input value={l[k]} onChange={(e) => mudar(l.chave, { [k]: e.target.value })} className={editavelCls} aria-label={rotulo} /> : l[k];
                return (
                  <tr key={l.chave} onClick={() => setAtiva(l.chave)} className={cn(ativa === l.chave && "bg-[#f3f2f7] dark:bg-[#242b3d]", l.excluir && "opacity-50", l.e_titulo && "font-semibold")}>
                    <td className={cn(celula, "text-center")}>
                      <input type="checkbox" checked={l.e_titulo} disabled={!pode || !livre} onChange={(e) => mudar(l.chave, { e_titulo: e.target.checked })} className="size-[14px] accent-primary" aria-label="Título" />
                    </td>
                    <td className={celula}>{l.codigo}</td>
                    <td className={celula}>{livre ? ed("descricao", "Item") : l.descricao}</td>
                    <td className={celula}>{ed("quantidade", "Quantidade")}</td>
                    <td className={celula}>{livre ? ed("unidade", "Unidade") : l.unidade}</td>
                    <td className={celula}>{ed("valor_unitario", "Valor unitário")}</td>
                    <td className={celula}>{l.e_titulo ? "" : n2((numero(l.quantidade) || 0) * (numero(l.valor_unitario) || 0))}</td>
                    <td className={celula}>{ed("valor_impostos", "Valor impostos")}</td>
                    <td className={celula}>{vlMedio(l.valor_medio)}</td>
                    <td className={celula}>
                      {editavel && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!l.id) setLinhas((ls) => ls.filter((x) => x.chave !== l.chave));
                            else mudar(l.chave, { excluir: !l.excluir });
                          }}
                          className={cn("rounded-[0.358rem] px-[0.9rem] py-[0.3rem] text-[0.857rem] text-white", l.excluir ? "bg-[#28c76f]" : "bg-[#ea5455]")}
                        >
                          {l.excluir ? "Adicionar" : "Excluir"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={modal !== null} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className={cn(modal === "pagamentos" || modal === "apropriacoes" ? "sm:max-w-5xl" : "sm:max-w-3xl")}>
          {modal && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[1.285rem] font-medium text-heading">{titulos[modal]}</DialogTitle>
              </DialogHeader>
              {modal === "contrato" && (
                <div>
                  <div className="grid gap-x-[1.5rem] md:grid-cols-3">
                    <Campo rotulo="Tipo Contrato:" htmlFor="c-tipo">
                      <select id="c-tipo" {...cmp("contrato_tipo")} className={selectClass}>
                        <option value="">Selecione</option>
                        {TIPOS_CONTRATO.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </Campo>
                    <Campo rotulo="Data Inicio:" htmlFor="c-ini">
                      <Input id="c-ini" type="date" {...cmp("contrato_inicio")} />
                    </Campo>
                    <Campo rotulo="Data Termino:" htmlFor="c-fim">
                      <Input id="c-fim" type="date" {...cmp("contrato_termino")} />
                    </Campo>
                  </div>
                  <Campo rotulo="Datas Pagamento:" htmlFor="c-datas">
                    <Input id="c-datas" {...cmp("contrato_datas_pagamento")} />
                  </Campo>
                  <Campo rotulo="Informações Complementares:" htmlFor="c-info">
                    <Textarea id="c-info" rows={4} {...cmp("contrato_info")} />
                  </Campo>
                  <p className="mb-[0.75rem] text-[0.857rem] text-muted-foreground">Os dados do contrato são gravados com o botão Salvar da ordem.</p>
                  <Button variant="outline" onClick={() => setModal(null)}>
                    Voltar
                  </Button>
                </div>
              )}
              {modal === "entrega" && (
                <div>
                  <div className="grid gap-x-[1.5rem] md:grid-cols-[1fr_3fr_1fr]">
                    <Campo rotulo="CEP" htmlFor="e-cep">
                      <Input id="e-cep" {...cmp("entrega_cep")} />
                    </Campo>
                    <Campo rotulo="Endereço" htmlFor="e-end">
                      <Input id="e-end" {...cmp("entrega_endereco")} />
                    </Campo>
                    <Campo rotulo="Nº" htmlFor="e-num">
                      <Input id="e-num" {...cmp("entrega_numero")} />
                    </Campo>
                  </div>
                  <div className="grid gap-x-[1.5rem] md:grid-cols-3">
                    <Campo rotulo="Complemento" htmlFor="e-comp">
                      <Input id="e-comp" {...cmp("entrega_complemento")} />
                    </Campo>
                    <Campo rotulo="Responsavel" htmlFor="e-resp">
                      <Input id="e-resp" {...cmp("entrega_responsavel")} />
                    </Campo>
                    <Campo rotulo="Telefone" htmlFor="e-tel">
                      <Input id="e-tel" {...cmp("entrega_telefone")} />
                    </Campo>
                    <Campo rotulo="Contato Mestre" htmlFor="e-mestre">
                      <Input id="e-mestre" {...cmp("entrega_contato_mestre")} />
                    </Campo>
                    <Campo rotulo="Telefone Mestre" htmlFor="e-telm">
                      <Input id="e-telm" {...cmp("entrega_telefone_mestre")} />
                    </Campo>
                    <Campo rotulo="Bairro" htmlFor="e-bairro">
                      <Input id="e-bairro" {...cmp("entrega_bairro")} />
                    </Campo>
                    <Campo rotulo="Cidade" htmlFor="e-cid">
                      <Input id="e-cid" {...cmp("entrega_cidade")} />
                    </Campo>
                    <Campo rotulo="UF" htmlFor="e-uf">
                      <select id="e-uf" {...cmp("entrega_uf")} className={selectClass}>
                        <option value="">Selecione</option>
                        {UFS.map((u) => (
                          <option key={u.valor}>{u.valor}</option>
                        ))}
                      </select>
                    </Campo>
                  </div>
                  <p className="text-[0.857rem] text-muted-foreground">O local de entrega é gravado com o botão Salvar da ordem.</p>
                </div>
              )}
              {modal === "apropriacoes" && <ModalApropriacoes oc={cab.id} total={total} aprops={aprops} ccs={ccs} podeEditar={editavel} />}
              {modal === "pagamentos" && (
                <div className="space-y-[1rem]">
                  <h6 className="text-[1rem] font-medium">Notas:</h6>
                  <TabelaSimples colunas={["Nota", "Serie", "Valor", "Pagamento", "Fornecedor", "Usuario"]} vazia={notasPagas.length === 0}>
                    {notasPagas.map((n) => (
                      <tr key={n.id}>
                        <td className={celula}>{n.numero}</td>
                        <td className={celula}>{n.serie}</td>
                        <td className={celula}>{n2(Number(n.valor))}</td>
                        <td className={celula}>{fmtData(n.pago_em)}</td>
                        <td className={celula}>{n.fornecedor}</td>
                        <td className={celula}>{n.usuario}</td>
                      </tr>
                    ))}
                  </TabelaSimples>
                  <h6 className="text-[1rem] font-medium">Guias Envio:</h6>
                  <TabelaSimples colunas={["Pedido", "Desc. Pedido", "Fornecedor", "valor", "Tipo", "Controle", "Vencimento", "Apropriação", "Guia"]} vazia={guias.length === 0}>
                    {guias.map((n) => (
                      <tr key={n.id}>
                        <td className={celula}>{cab.numero_cliente ?? cab.id}</td>
                        <td className={celula}>{cab.dados.nome}</td>
                        <td className={celula}>{n.fornecedor}</td>
                        <td className={celula}>{n2(Number(n.valor))}</td>
                        <td className={celula}>NF</td>
                        <td className={celula}>{n.numero}</td>
                        <td className={celula}>{n.vencimento}</td>
                        <td className={celula}>{aprops.map((a) => a.cc_codigo).join(", ")}</td>
                        <td className={celula}>{n.guia}</td>
                      </tr>
                    ))}
                  </TabelaSimples>
                </div>
              )}
              {modal === "justificativas" && (
                <TabelaSimples colunas={["Status", "Justificativa", "Responsavel", "Data"]} vazia={justificativas.length === 0}>
                  {justificativas.map((j) => (
                    <tr key={j.id}>
                      <td className={celula}>{j.status}</td>
                      <td className={celula}>{j.justificativa}</td>
                      <td className={celula}>{j.responsavel}</td>
                      <td className={celula}>{dataHora(j.criado_em)}</td>
                    </tr>
                  ))}
                </TabelaSimples>
              )}
              {modal === "arquivos" && <ModalArquivos oc={cab.id} arquivos={arquivos} />}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Cartao>
  );
}

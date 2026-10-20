"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, DollarSign, Download, Edit, FileText, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cartao, Campo } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import { selectClass } from "@/components/cadastros/registro-form";
import { data as fmtData } from "@/lib/format";
import { decidirNota, pagarNota } from "@/lib/notas/actions";
import { alterarNumeroNf, excluirLancamento, excluirPagamentoNf } from "@/lib/vinculo/actions";
import type { NotaLista } from "@/lib/notas/lista";
import { ModalArquivos } from "@/app/(app)/vincular/telas";

// Telas de notas do AstroTools: Aprovação NF, Pagamentos Pendentes, Pagamentos Realizados (Fase Cinza),
// Notas Pendentes Fase Azul e Notas Pagas Fase Azul.

export type Tela = "aprovacao" | "pendentes" | "pagas" | "azul_pendentes" | "azul_pagas";
type Opcao = { valor: string; rotulo: string };

const real = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const n2 = (v: number) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

type Modal =
  | { tipo: "aprovar" | "efetivar" | "forcar" | "excluir_pag" | "editar" | "comprovante"; nota: NotaLista }
  | { tipo: "arquivos"; nota: NotaLista };

function DadosNota({ nota, extra }: { nota: NotaLista; extra?: React.ReactNode }) {
  return (
    <div className="grid gap-x-[1.5rem] md:grid-cols-2">
      <Campo rotulo="Nota Fiscal:" htmlFor="m-nf">
        <Input id="m-nf" readOnly value={nota.numero} />
      </Campo>
      <Campo rotulo="Serie:" htmlFor="m-serie">
        <Input id="m-serie" readOnly value={nota.serie.startsWith("P") ? "" : nota.serie} />
      </Campo>
      <Campo rotulo="valor:" htmlFor="m-valor">
        <Input id="m-valor" readOnly value={n2(nota.valor)} />
      </Campo>
      {extra ?? (
        <Campo rotulo="Vencimento:" htmlFor="m-venc">
          <Input id="m-venc" readOnly value={fmtData(nota.vencimento)} />
        </Campo>
      )}
      <Campo rotulo="Fornecedor:" htmlFor="m-forn" className="md:col-span-2">
        <Input id="m-forn" readOnly value={nota.fornecedor_nome} />
      </Campo>
    </div>
  );
}

export function TelaNotas({
  tela,
  notas,
  obras = [],
  podeAprovar,
  podePagar,
  podeExcluir,
}: {
  tela: Tela;
  notas: NotaLista[];
  obras?: Opcao[];
  podeAprovar: boolean;
  podePagar: boolean;
  podeExcluir: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal | null>(null);
  const [pending, startTransition] = useTransition();
  const [dataPag, setDataPag] = useState(hoje());
  const [tipoExclusao, setTipoExclusao] = useState("");
  const [novo, setNovo] = useState({ numero: "", serie: "" });
  const [filtro, setFiltro] = useState({ obra: "", inicio: "", fim: "", nota: "" });
  const [filtradas, setFiltradas] = useState<NotaLista[] | null>(null);
  const comFiltro = tela === "pagas" || tela === "azul_pagas";
  const fechar = () => setModal(null);

  const rodar = (fn: () => Promise<{ ok: boolean; erro?: string; verbaInsuficiente?: boolean }>, ok: string, nota?: NotaLista) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        if (r.verbaInsuficiente && nota) return void setModal({ tipo: "forcar", nota });
        return void toast.error(r.erro);
      }
      toast.success(ok);
      fechar();
      setFiltradas((l) => l?.filter((x) => x.id !== nota?.id) ?? null);
      router.refresh();
    });

  const filtrar = () =>
    setFiltradas(
      notas.filter(
        (n) =>
          (!filtro.obra || String(n.obra_id) === filtro.obra) &&
          (!filtro.inicio || (n.pago_em ?? n.criado_em.slice(0, 10)) >= filtro.inicio) &&
          (!filtro.fim || (n.pago_em ?? n.criado_em.slice(0, 10)) <= filtro.fim) &&
          (!filtro.nota || n.numero.includes(filtro.nota)),
      ),
    );

  const icone = (titulo: string, Icone: typeof Search, onClick: () => void, cor = "text-primary") => (
    <button type="button" title={titulo} onClick={onClick} className={cor}>
      <Icone className="size-[14px]" />
    </button>
  );

  const acoes = (n: NotaLista) => (
    <span className="flex items-center gap-[0.6rem]">
      {tela === "aprovacao" && podeAprovar && icone("Aprovar NF", Check, () => setModal({ tipo: "aprovar", nota: n }), "text-[#28c76f]")}
      {tela === "pendentes" && podePagar && icone("Efetivar pagamento", DollarSign, () => setModal({ tipo: "efetivar", nota: n }), "text-[#28c76f]")}
      {(tela === "pagas" || tela === "azul_pagas") && icone("Solicitar Comprovante", FileText, () => setModal({ tipo: "comprovante", nota: n }))}
      {tela === "pagas" && podePagar && icone("Alterar número da nota", Edit, () => (setNovo({ numero: n.numero, serie: n.serie }), setModal({ tipo: "editar", nota: n })), "text-[#00cfe8]")}
      {tela === "pagas" && podePagar && icone("Excluir pagamento", Trash2, () => (setTipoExclusao(""), setModal({ tipo: "excluir_pag", nota: n })), "text-[#ea5455]")}
      {tela !== "pagas" && tela !== "azul_pagas" && (
        <>
          {icone("Download", Download, () => setModal({ tipo: "arquivos", nota: n }))}
          {icone("Upload", Upload, () => setModal({ tipo: "arquivos", nota: n }))}
        </>
      )}
      {(tela === "pagas" || tela === "azul_pagas") && icone("Arquivos", Download, () => setModal({ tipo: "arquivos", nota: n }))}
      <Link href={`/ordens-compra/${n.ordem_compra_id}`} title="Vizualizar Pedido" className="text-primary">
        <Search className="size-[14px]" />
      </Link>
      {(tela === "aprovacao" || tela === "azul_pendentes") &&
        podeExcluir &&
        icone(
          "Excluir",
          Trash2,
          () => confirm(`Confirma exclusão da Nota: ${n.numero}`) && rodar(() => excluirLancamento(n.ordem_compra_id, n.id), "Nota excluída.", n),
          "text-[#ea5455]",
        )}
    </span>
  );

  const base: ColunaTabela<NotaLista>[] = [
    { chave: "nota", titulo: "Nota", valor: (n) => n.numero },
    ...(tela === "azul_pendentes" || tela === "azul_pagas" ? [] : [{ chave: "serie", titulo: "Serie", valor: (n: NotaLista) => n.serie }]),
    { chave: "venc", titulo: "Vencimento", valor: (n) => n.vencimento, render: (n) => fmtData(n.vencimento) },
  ];
  const colunas: ColunaTabela<NotaLista>[] =
    tela === "pagas"
      ? [
          ...base,
          { chave: "usuario", titulo: "Usuário", valor: (n) => n.pago_por_nome ?? "" },
          { chave: "obra", titulo: "Obra", valor: (n) => n.cliente_nome ?? n.obra_nome },
          { chave: "pedido", titulo: "Pedido", valor: (n) => n.pedido ?? "" },
          { chave: "forn", titulo: "Fornecedor", valor: (n) => n.fornecedor_nome },
          { chave: "valor", titulo: "Valor Pago", valor: (n) => n.valor, render: (n) => real(n.valor), className: "whitespace-nowrap" },
          { chave: "reg", titulo: "Data Registro", valor: (n) => n.pago_em ?? "", render: (n) => fmtData(n.pago_em) },
          { chave: "acoes", titulo: "Ações", valor: () => "", exportar: false, ordenavel: false, render: acoes },
        ]
      : [
          ...base,
          { chave: "cli", titulo: "Cliente", valor: (n) => n.cliente_nome ?? n.obra_nome },
          { chave: "pedido", titulo: "Pedido", valor: (n) => n.pedido ?? "" },
          { chave: "forn", titulo: "Fornecedor", valor: (n) => n.fornecedor_nome },
          { chave: "valor", titulo: "Valor", valor: (n) => n.valor, render: (n) => real(n.valor), className: "whitespace-nowrap" },
          { chave: "reg", titulo: "Data Registro", valor: (n) => n.criado_em, render: (n) => fmtData(n.criado_em) },
          ...(tela === "azul_pagas" ? [{ chave: "guia", titulo: "Guia Envio", valor: (n: NotaLista) => n.guia_numero ?? "" }] : []),
          { chave: "acoes", titulo: "Ações", valor: () => "", exportar: false, ordenavel: false, render: acoes },
        ];

  const titulosModal: Record<Modal["tipo"], string> = {
    aprovar: "Aprovar NF?",
    efetivar: "Efetivar pagamento?",
    forcar: "Efetivar pagamento com falta de verba alocada?",
    excluir_pag: "Deseja realmente excluir a nota fiscal?",
    editar: "Deseja alterar numero da nota?",
    comprovante: "Solicitar Comprovante",
    arquivos: "Arquivos-NF",
  };

  return (
    <>
      {comFiltro && (
        <Cartao>
          <div className="border-b border-border px-[1.5rem] py-[1.5rem]">
            <h4 className="mb-0 text-[1.285rem] font-medium">{tela === "pagas" ? "Filtro Pagamentos" : "Filtro Notas Pagas Fase Azul"}</h4>
          </div>
          <div className="px-[1.5rem] pt-[1.5rem] pb-[1.5rem]">
            <div className="grid gap-x-[1.5rem] md:grid-cols-[4fr_3fr_3fr_4fr]">
              <Campo rotulo="Obra:" htmlFor="f-obra">
                <select id="f-obra" value={filtro.obra} onChange={(e) => setFiltro({ ...filtro, obra: e.target.value })} className={selectClass}>
                  <option value="">Selecione uma Obra</option>
                  {obras.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Data Inicial:" htmlFor="f-ini">
                <Input id="f-ini" type="date" value={filtro.inicio} onChange={(e) => setFiltro({ ...filtro, inicio: e.target.value })} />
              </Campo>
              <Campo rotulo="Data Final:" htmlFor="f-fim">
                <Input id="f-fim" type="date" value={filtro.fim} onChange={(e) => setFiltro({ ...filtro, fim: e.target.value })} />
              </Campo>
              <Campo rotulo="Nota:" htmlFor="f-nota">
                <Input id="f-nota" type="number" value={filtro.nota} onChange={(e) => setFiltro({ ...filtro, nota: e.target.value })} />
              </Campo>
            </div>
            <Button onClick={filtrar}>Filtrar</Button>
          </div>
        </Cartao>
      )}

      {(!comFiltro || filtradas) && (
        <Cartao>
          <div className="pt-[0.5rem]">
            <TabelaDados colunas={colunas} linhas={comFiltro ? (filtradas ?? []) : notas} chave={(n) => n.id} nomeArquivo={tela} />
          </div>
        </Cartao>
      )}

      <Dialog open={modal !== null} onOpenChange={(o) => !o && fechar()}>
        <DialogContent className="sm:max-w-2xl">
          {modal && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[1.1rem] font-medium text-heading">{titulosModal[modal.tipo]}</DialogTitle>
              </DialogHeader>
              {modal.tipo === "arquivos" && <ModalArquivos ocId={modal.nota.ordem_compra_id} nota={modal.nota} onFechar={fechar} />}
              {modal.tipo === "aprovar" && (
                <div>
                  <DadosNota nota={modal.nota} />
                  <div className="flex gap-[0.5rem]">
                    <Button disabled={pending} onClick={() => rodar(() => decidirNota(modal.nota.id, true, ""), "NF aprovada para pagamento.", modal.nota)}>
                      Efetivar
                    </Button>
                    <Button variant="outline" onClick={fechar}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
              {(modal.tipo === "efetivar" || modal.tipo === "forcar") && (
                <div>
                  <DadosNota nota={modal.nota} />
                  <Campo rotulo="Data do pagamento:" htmlFor="m-data" className="md:w-1/2">
                    <Input id="m-data" type="date" value={dataPag} onChange={(e) => setDataPag(e.target.value)} />
                  </Campo>
                  {modal.tipo === "forcar" && (
                    <p className="mb-[1rem] rounded-[0.357rem] bg-[#ff9f43]/10 p-[0.75rem] text-[0.95rem] text-[#c76b12]">
                      A verba alocada dos centros de custo desta nota não cobre o valor. Confirme para efetivar mesmo assim.
                    </p>
                  )}
                  <div className="flex gap-[0.5rem]">
                    <Button
                      disabled={pending}
                      onClick={() => rodar(() => pagarNota(modal.nota.id, dataPag, modal.tipo === "forcar"), "Pagamento efetivado.", modal.nota)}
                    >
                      Efetivar
                    </Button>
                    <Button variant="outline" onClick={fechar}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
              {modal.tipo === "excluir_pag" && (
                <div>
                  <DadosNota
                    nota={modal.nota}
                    extra={
                      <Campo rotulo="Modelo Exclusão" htmlFor="m-tipo">
                        <select id="m-tipo" value={tipoExclusao} onChange={(e) => setTipoExclusao(e.target.value)} className={selectClass}>
                          <option value="">Selecione</option>
                          <option value="pagamento">Excluir pagamento</option>
                          <option value="pagamento_nota">Excluir pagamento + Nota</option>
                        </select>
                      </Campo>
                    }
                  />
                  <div className="flex gap-[0.5rem]">
                    <Button
                      disabled={pending || !tipoExclusao}
                      onClick={() => rodar(() => excluirPagamentoNf(modal.nota.id, tipoExclusao as "pagamento" | "pagamento_nota"), "Pagamento excluído.", modal.nota)}
                    >
                      Confirmar
                    </Button>
                    <Button variant="outline" onClick={fechar}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
              {modal.tipo === "editar" && (
                <div>
                  <div className="grid gap-x-[1.5rem] md:grid-cols-2">
                    <Campo rotulo="Nota Fiscal:" htmlFor="e-nf">
                      <Input id="e-nf" readOnly value={modal.nota.numero} />
                    </Campo>
                    <Campo rotulo="Novo Numero:" htmlFor="e-novo">
                      <Input id="e-novo" value={novo.numero} onChange={(e) => setNovo({ ...novo, numero: e.target.value })} />
                    </Campo>
                    <Campo rotulo="Serie:" htmlFor="e-serie">
                      <Input id="e-serie" readOnly value={modal.nota.serie} />
                    </Campo>
                    <Campo rotulo="Nova Serie:" htmlFor="e-nserie">
                      <Input id="e-nserie" value={novo.serie} onChange={(e) => setNovo({ ...novo, serie: e.target.value })} />
                    </Campo>
                    <Campo rotulo="valor:" htmlFor="e-valor">
                      <Input id="e-valor" readOnly value={n2(modal.nota.valor)} />
                    </Campo>
                    <Campo rotulo="Fornecedor:" htmlFor="e-forn">
                      <Input id="e-forn" readOnly value={modal.nota.fornecedor_nome} />
                    </Campo>
                  </div>
                  <div className="flex gap-[0.5rem]">
                    <Button disabled={pending} onClick={() => rodar(() => alterarNumeroNf(modal.nota.id, novo.numero, novo.serie), "Número da nota alterado.")}>
                      Confirmar
                    </Button>
                    <Button variant="outline" onClick={fechar}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
              {modal.tipo === "comprovante" && (
                <div>
                  <div className="grid gap-x-[1.5rem] md:grid-cols-2">
                    <Campo rotulo="Nota Fiscal:" htmlFor="c-nf">
                      <Input id="c-nf" readOnly value={modal.nota.numero} />
                    </Campo>
                    <Campo rotulo="Obra:" htmlFor="c-obra">
                      <Input id="c-obra" readOnly value={modal.nota.obra_nome} />
                    </Campo>
                    <Campo rotulo="Valor (R$):" htmlFor="c-valor">
                      <Input id="c-valor" readOnly value={n2(modal.nota.valor)} />
                    </Campo>
                    <Campo rotulo="Pedido:" htmlFor="c-ped">
                      <Input id="c-ped" readOnly value={modal.nota.pedido ?? ""} />
                    </Campo>
                    <Campo rotulo="Fornecedor:" htmlFor="c-forn" className="md:col-span-2">
                      <Input id="c-forn" readOnly value={modal.nota.fornecedor_nome} />
                    </Campo>
                    <Campo rotulo="Destinatários / Responsáveis (preencha o campo com o e-mail do responsável pelo envio do comprovante):" htmlFor="c-dest" className="md:col-span-2">
                      <Input id="c-dest" placeholder="email@exemplo.com" />
                    </Campo>
                  </div>
                  <p className="mb-[0.75rem] text-[0.857rem] text-muted-foreground">O envio de e-mail ainda não está ligado no sistema novo.</p>
                  <div className="flex gap-[0.5rem]">
                    <Button disabled title="Envio de e-mail: próxima etapa">
                      Solicitar
                    </Button>
                    <Button variant="outline" onClick={fechar}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

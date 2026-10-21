"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cartao, Campo } from "@/components/astro/basicos";
import { cabecalho, celula, editavelCls, type CcSaldo } from "@/components/astro/itens";
import { selectClass } from "@/components/cadastros/registro-form";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { dataHora } from "@/lib/format";
import {
  apropriarReembolso,
  efetivarSolicitacaoReembolso,
  excluirApropriacaoReembolso,
  excluirArquivoReembolso,
  linkArquivoReembolso,
  registrarArquivoReembolso,
  salvarReembolsoOriginal,
  type DadosReembolso,
  type Resultado,
} from "@/lib/reembolsos/actions";
import type { AproReembolso, ArquivoReembolso, FornecedorReembolso, ItemReembolsoOriginal, ReembolsoLista } from "@/lib/reembolsos/tipos";

// "Adicionar Ordem de Reembolso" / "Vizualizar Ordem Reembolso" do AstroTools.
// Sem apropriações a ordem é editável; com apropriações trava; com o total apropriado aparece "Efetivar Solicitação";
// depois de enviada ao Financeiro tudo fica bloqueado.

type Opcao = { valor: string; rotulo: string };
type Linha = { chave: string; descricao: string; apropriacao: string; tipo: string; data: string; valor: string; excluir: boolean; existente: boolean };

const LINHAS_EM_BRANCO = 20;
const n2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numero = (s: string) => {
  const t = s.replace(/R\$/g, "").trim();
  if (!t) return 0;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : NaN;
};
const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const dataIso = (br: string) => {
  const m = br.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
};
let seq = 0;
const vazia = (): Linha => ({ chave: `n${++seq}`, descricao: "", apropriacao: "", tipo: "", data: "", valor: "", excluir: false, existente: false });

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

function TabelaSimples({ colunas, children, vazia: semLinhas }: { colunas: string[]; children?: React.ReactNode; vazia: boolean }) {
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
        {semLinhas && (
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

function ModalApropriacoes({ id, total, aprops, ccs, podeEditar }: { id: number; total: number; aprops: AproReembolso[]; ccs: CcSaldo[]; podeEditar: boolean }) {
  const [cc, setCc] = useState("");
  const [valor, setValor] = useState("");
  const { pending, rodar } = useAcao();
  const apropriado = aprops.reduce((s, a) => s + a.valor, 0);
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
      <div className="grid gap-x-[1.5rem] md:grid-cols-[3fr_1fr]">
        <Campo rotulo="Apropriação:" htmlFor="ap-cc">
          <select id="ap-cc" disabled={!podeEditar} value={cc} onChange={(e) => setCc(e.target.value)} className={selectClass}>
            <option value="">Selecione</option>
            {ccs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} - {c.descricao.slice(0, 90)} | Saldo:{n2(c.saldo)}
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
          <Input id="ap-valor" inputMode="decimal" disabled={!podeEditar} value={valor} onChange={(e) => setValor(e.target.value)} />
        </Campo>
        <Button
          className="mb-[1rem]"
          disabled={!podeEditar || pending || !cc}
          onClick={() => {
            const v = numero(valor);
            if (Number.isNaN(v)) return void toast.error("Valor informado inválido");
            if (v <= 0) return void toast.error("Valor informado deve ser maior que 0");
            if (v > total - apropriado + 0.005) return void toast.error(`Valor informado R$ ${n2(v)} maior que saldo R$ ${n2(total - apropriado)}`);
            rodar(() => apropriarReembolso(id, Number(cc), v), "Apropriação incluída.", () => {
              setCc("");
              setValor("");
            });
          }}
        >
          Adicionar
        </Button>
      </div>
      <hr className="my-[1rem] border-border" />
      <TabelaSimples colunas={["Apropriação", "Descrição", "Valor Apontado", "Saldo Aprop.", "Del."]} vazia={aprops.length === 0}>
        {aprops.map((a) => (
          <tr key={a.id}>
            <td className={celula}>{a.cc_codigo}</td>
            <td className={celula}>{a.cc_descricao}</td>
            <td className={celula}>{n2(a.valor)}</td>
            <td className={celula}>{a.saldo_ref == null ? "" : n2(a.saldo_ref)}</td>
            <td className={celula}>
              <Button
                variant="destructive"
                size="sm"
                disabled={!podeEditar || pending}
                onClick={() => confirm("Excluir esta apropriação?") && rodar(() => excluirApropriacaoReembolso(id, a.id), "Apropriação excluída.")}
              >
                Excluir
              </Button>
            </td>
          </tr>
        ))}
      </TabelaSimples>
    </div>
  );
}

function ModalArquivos({ id, arquivos }: { id: number; arquivos: ArquivoReembolso[] }) {
  const ref = useRef<HTMLInputElement>(null);
  const { pending, rodar } = useAcao();
  const [enviando, setEnviando] = useState(false);
  const enviar = async () => {
    const files = [...(ref.current?.files ?? [])];
    if (!files.length) return void toast.error("Escolha um arquivo.");
    setEnviando(true);
    const supabase = createClient();
    for (const file of files) {
      const caminho = `${id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error } = await supabase.storage.from("reembolso-arquivos").upload(caminho, file);
      if (error) {
        toast.error(`Falha ao enviar ${file.name}: ${error.message}`);
        continue;
      }
      await registrarArquivoReembolso(id, caminho, file.name, file.size);
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
                    const r = await linkArquivoReembolso(a.id);
                    if (!r.ok) return void toast.error(r.erro);
                    window.open(r.url, "_blank");
                  }}
                >
                  {a.nome}
                </button>
              </td>
              <td className={celula}>{dataHora(a.enviado_em)}</td>
              <td className={celula}>
                <button type="button" aria-label="Excluir" className="text-[#ea5455]" onClick={() => confirm("Excluir o arquivo?") && rodar(() => excluirArquivoReembolso(id, a.id), "Arquivo excluído.")}>
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

export function TelaReembolso({
  reembolso: r,
  itens,
  aprops = [],
  arquivos = [],
  ccs = [],
  obras,
  filiais,
  fornecedores,
  podeEditar,
}: {
  reembolso: ReembolsoLista | null;
  itens: ItemReembolsoOriginal[];
  aprops?: AproReembolso[];
  arquivos?: ArquivoReembolso[];
  ccs?: CcSaldo[];
  obras: Opcao[];
  filiais: Record<string, Opcao[]>;
  fornecedores: FornecedorReembolso[];
  podeEditar: boolean;
}) {
  const { pending, rodar, router } = useAcao();
  const [modal, setModal] = useState<"apropriacoes" | "arquivos" | null>(null);
  const [dados, setDados] = useState<DadosReembolso>({
    obra_id: r ? String(r.obra_id) : "",
    filial_cliente_id: r?.filial_cliente_id ? String(r.filial_cliente_id) : "",
    fornecedor_id: r ? String(r.fornecedor_id) : "",
    observacao: r?.observacao ?? "",
    cpf_cnpj: r?.cpf_cnpj ?? "",
    banco: r?.banco ?? "",
    agencia: r?.agencia ?? "",
    conta: r?.conta ?? "",
  });
  const enviada = r?.solicitacao_enviada ?? false;
  const comApropriacao = aprops.length > 0;
  const editavel = podeEditar && !enviada && !comApropriacao;
  const [linhas, setLinhas] = useState<Linha[]>(() => [
    ...itens.map((i) => ({
      chave: `i${i.id}`,
      descricao: i.descricao,
      apropriacao: i.apropriacao ?? "",
      tipo: i.tipo ?? "",
      data: dataBr(i.data),
      valor: n2(i.valor),
      excluir: false,
      existente: true,
    })),
    ...(editavel ? Array.from({ length: LINHAS_EM_BRANCO }, vazia) : []),
  ]);
  const total = linhas.filter((l) => !l.excluir).reduce((s, l) => s + (numero(l.valor) || 0), 0);
  const apropriado = aprops.reduce((s, a) => s + a.valor, 0);
  const podeEfetivar = r != null && comApropriacao && Math.abs(apropriado - (r.valor_total ?? 0)) < 0.005;

  const set = (k: keyof DadosReembolso) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setDados({ ...dados, [k]: e.target.value });
  const mudarFornecedor = (id: string) => {
    const f = fornecedores.find((x) => x.valor === id);
    setDados({ ...dados, fornecedor_id: id, ...(f ? { cpf_cnpj: f.cpf_cnpj, banco: f.banco, agencia: f.agencia, conta: f.conta } : {}) });
  };
  const mudar = (chave: string, p: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...p } : l)));

  const salvar = () => {
    const validas = linhas.filter((l) => !l.excluir && l.descricao.trim() && numero(l.valor) > 0);
    for (const l of validas) if (l.data.trim() && !dataIso(l.data)) return void toast.error(`Data inválida no item "${l.descricao}". Use dd/mm/aaaa.`);
    if (linhas.some((l) => !l.excluir && l.descricao.trim() && Number.isNaN(numero(l.valor)))) return void toast.error("Valor inválido em algum item.");
    rodar(
      () =>
        salvarReembolsoOriginal(
          r?.id ?? null,
          dados,
          validas.map((l) => ({ descricao: l.descricao.trim(), apropriacao: l.apropriacao, tipo: l.tipo, data: dataIso(l.data), valor: numero(l.valor) })),
        ),
      "Ordem de reembolso salva.",
      (res) => !r && res.id && router.push(`/ordens-reembolso/${res.id}`),
    );
  };

  const fornecedor = fornecedores.find((f) => f.valor === dados.fornecedor_id);
  const colunasItens = ["Item", "Apropriação", "Tipo", "Data", "Valor", ...(editavel ? ["Del."] : [])];

  return (
    <Cartao>
      {r ? (
        <div className="flex justify-end gap-[0.5rem] border-b border-border px-[1.5rem] py-[1.5rem]">
          <Button className="bg-[#00cfe8] hover:bg-[#00b8cf]" onClick={() => setModal("arquivos")}>
            Arquivos
          </Button>
          <a href={`/imprimir/reembolso/${r.id}`} target="_blank" rel="noreferrer" title="PDF" className="flex size-[38px] items-center justify-center rounded-[0.358rem] bg-[#00cfe8] text-white">
            <FileText className="size-[14px]" />
          </a>
        </div>
      ) : (
        <div className="border-b border-border px-[1.5rem] py-[1.5rem]">
          <h4 className="mb-0 text-[1.285rem] font-medium">Nova Ordem de Reembolso</h4>
        </div>
      )}
      <div className="px-[1.5rem] pt-[1.5rem]">
        <div className="grid gap-x-[2rem] md:grid-cols-3">
          <Campo rotulo="Obra" htmlFor="r-obra">
            <select id="r-obra" disabled={!editavel} value={dados.obra_id} onChange={(e) => setDados({ ...dados, obra_id: e.target.value, filial_cliente_id: "" })} className={selectClass}>
              <option value="">Selecione uma Obra</option>
              {obras.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Filial" htmlFor="r-filial">
            <select id="r-filial" disabled={!editavel} value={dados.filial_cliente_id} onChange={set("filial_cliente_id")} className={selectClass}>
              <option value="">{dados.obra_id ? "Selecione uma Filial" : ""}</option>
              {(filiais[dados.obra_id] ?? []).map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Fornecedor" htmlFor="r-forn">
            <select id="r-forn" disabled={!editavel} value={dados.fornecedor_id} onChange={(e) => mudarFornecedor(e.target.value)} className={selectClass} title={fornecedor?.rotulo}>
              <option value="">Selecione</option>
              {fornecedores.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Observação" htmlFor="r-obs">
          <Textarea id="r-obs" disabled={!editavel} value={dados.observacao} onChange={set("observacao")} rows={2} />
        </Campo>
        <div className="grid gap-x-[2rem] md:grid-cols-4">
          <Campo rotulo="CPF/CNPJ" htmlFor="r-cpf">
            <Input id="r-cpf" disabled={!editavel} value={dados.cpf_cnpj} onChange={set("cpf_cnpj")} />
          </Campo>
          <Campo rotulo="Banco" htmlFor="r-banco">
            <Input id="r-banco" disabled={!editavel} value={dados.banco} onChange={set("banco")} />
          </Campo>
          <Campo rotulo="Agencia" htmlFor="r-ag">
            <Input id="r-ag" disabled={!editavel} value={dados.agencia} onChange={set("agencia")} />
          </Campo>
          <Campo rotulo="Conta" htmlFor="r-conta">
            <Input id="r-conta" disabled={!editavel} value={dados.conta} onChange={set("conta")} />
          </Campo>
        </div>
        <Campo rotulo="Total" htmlFor="r-total" className="w-[9rem]">
          <Input id="r-total" readOnly value={n2(total)} />
        </Campo>
      </div>
      <div className="flex flex-wrap gap-[0.5rem] border-t border-border px-[1.5rem] py-[1rem]">
        <Button disabled={!editavel || pending} onClick={salvar}>
          Salvar
        </Button>
        {r && <Button onClick={() => setModal("apropriacoes")}>Apropriações</Button>}
        {r && (podeEfetivar || enviada) && (
          <Button
            disabled={enviada || !podeEditar || pending}
            onClick={() =>
              confirm("Confirma o envio da Solicitação para o setor Financeiro? Esta opção bloqueia a solicitação para possiveis alterações!") &&
              rodar(() => efetivarSolicitacaoReembolso(r.id), "Solicitação enviada ao Financeiro.")
            }
          >
            Efetivar Solicitação
          </Button>
        )}
        <Button variant="outline" onClick={() => router.push(r?.cliente_id ? `/ordens-reembolso/cliente/${r.cliente_id}` : "/ordens-reembolso")}>
          Voltar
        </Button>
      </div>
      <div className="overflow-x-auto px-[1.5rem] pb-[1.5rem]">
        <TabelaSimples colunas={colunasItens} vazia={linhas.length === 0}>
          {linhas.map((l) => (
            <tr key={l.chave} className={cn(l.excluir && "opacity-50")}>
              {(["descricao", "apropriacao", "tipo", "data", "valor"] as const).map((k) => (
                <td key={k} className={cn(celula, k === "descricao" ? "min-w-[16rem]" : "w-[10%]")}>
                  {editavel ? (
                    <input
                      value={l[k]}
                      onChange={(e) => mudar(l.chave, { [k]: e.target.value })}
                      onBlur={k === "valor" ? () => l.valor && !Number.isNaN(numero(l.valor)) && mudar(l.chave, { valor: n2(numero(l.valor)) }) : undefined}
                      className={editavelCls}
                      aria-label={k}
                    />
                  ) : (
                    l[k]
                  )}
                </td>
              ))}
              {editavel && (
                <td className={celula}>
                  {l.existente || l.descricao || l.valor ? (
                    <Button
                      size="sm"
                      className={l.excluir ? "bg-[#28c76f] hover:bg-[#24b263]" : "bg-[#ea5455] hover:bg-[#e73d3e]"}
                      onClick={() => (l.existente ? mudar(l.chave, { excluir: !l.excluir }) : setLinhas((ls) => ls.map((x) => (x.chave === l.chave ? vazia() : x))))}
                    >
                      {l.excluir ? "Adicionar" : "Excluir"}
                    </Button>
                  ) : (
                    <Button size="sm" className="bg-[#ea5455] hover:bg-[#e73d3e]" onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}>
                      Excluir
                    </Button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </TabelaSimples>
      </div>

      {r && (
        <Dialog open={modal !== null} onOpenChange={(o) => !o && setModal(null)}>
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle className="text-[1.1rem] font-medium text-heading">{modal === "apropriacoes" ? "Apropriações" : "Arquivos"}</DialogTitle>
            </DialogHeader>
            {modal === "apropriacoes" && <ModalApropriacoes id={r.id} total={r.valor_total} aprops={aprops} ccs={ccs} podeEditar={podeEditar && !enviada} />}
            {modal === "arquivos" && <ModalArquivos id={r.id} arquivos={arquivos} />}
          </DialogContent>
        </Dialog>
      )}
    </Cartao>
  );
}

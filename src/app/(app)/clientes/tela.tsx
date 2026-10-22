"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cartao, Campo, Selo } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import { selectClass } from "@/components/cadastros/registro-form";
import { UFS } from "@/lib/cadastros/config";
import { data as fmtData, dataHora } from "@/lib/format";
import { ativarCliente, salvarCliente } from "@/lib/cadastros/original";

// "Cadastro de Clientes" do AstroTools: Novo Cliente / Inativos, tabela completa, Editar e Desativar/Ativar.

export type Cliente = Record<string, string | number | boolean | null> & { id: number; nome: string; ativo: boolean };

const TIPOS_OBRA = ["Residencial Zero", "Residencial Reforma", "Apartamento", "Cobertura", "Corporativo", "Comercial"];
const CAMPOS = [
  "cnpj", "razao_social", "nome", "ie", "telefone", "celular", "responsavel", "email", "cep", "endereco", "complemento", "numero", "bairro", "cidade", "uf",
  "codigo_municipio", "cep_entrega", "endereco_entrega", "complemento_entrega", "contato_mestre", "telefone_mestre", "numero_entrega", "bairro_entrega",
  "cidade_entrega", "uf_entrega", "tipo", "metragem", "arquitetura", "gerenciadora", "inicio", "fim", "vencimento_seguro", "cno", "valida_engenharia_nota",
  "obriga_anexo_oc_nf",
] as const;
type Dados = Record<(typeof CAMPOS)[number], string>;

const paraDados = (c: Cliente | null): Dados =>
  Object.fromEntries(
    CAMPOS.map((k) => {
      const v = c?.[k];
      if (k === "valida_engenharia_nota" || k === "obriga_anexo_oc_nf") return [k, v ? "1" : "0"];
      return [k, v == null ? "" : String(v)];
    }),
  ) as Dados;

const s = (v: unknown) => (v == null ? "" : String(v));

export function TelaClientes({ clientes, inativos, podeEditar }: { clientes: Cliente[]; inativos: boolean; podeEditar: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [edicao, setEdicao] = useState<{ id: number | null; dados: Dados } | null>(null);
  const rodar = (fn: () => Promise<{ ok: boolean; erro?: string }>, ok: string) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.erro);
      toast.success(ok);
      setEdicao(null);
      router.refresh();
    });

  const colunas: ColunaTabela<Cliente>[] = [
    { chave: "nome", titulo: "Nome", valor: (c) => c.nome, className: "font-semibold" },
    { chave: "razao", titulo: "Razao Social", valor: (c) => s(c.razao_social) },
    { chave: "cnpj", titulo: "Cnpj", valor: (c) => s(c.cnpj), className: "whitespace-nowrap" },
    { chave: "tel", titulo: "Telefone:", valor: (c) => s(c.telefone) },
    { chave: "cel", titulo: "Celular:", valor: (c) => s(c.celular) },
    { chave: "resp", titulo: "Responsavel:", valor: (c) => s(c.responsavel) },
    { chave: "end", titulo: "Endereço:", valor: (c) => [c.endereco, c.numero, c.complemento].filter(Boolean).join(", ") },
    { chave: "bairro", titulo: "Bairro:", valor: (c) => `${s(c.bairro)}${c.cidade || c.uf ? ` ,${s(c.cidade)}/${s(c.uf)}` : ""}` },
    { chave: "cep", titulo: "CEP:", valor: (c) => s(c.cep) },
    { chave: "ger", titulo: "Gerenciadora:", valor: (c) => s(c.gerenciadora) },
    { chave: "arq", titulo: "Arquitetura:", valor: (c) => s(c.arquitetura) },
    { chave: "tipo", titulo: "Tipo:", valor: (c) => s(c.tipo) || "Selecione" },
    { chave: "valida", titulo: "Valida Engenharia Nota:", valor: (c) => (c.valida_engenharia_nota ? "Sim" : "Não") },
    { chave: "obriga", titulo: "Obriga anexo vinculo OC x NF:", valor: (c) => (c.obriga_anexo_oc_nf ? "Sim" : "Não") },
    { chave: "atual", titulo: "Atualização:", valor: (c) => s(c.atualizado_em), render: (c) => dataHora(s(c.atualizado_em)) },
    { chave: "ini", titulo: "Inicio:", valor: (c) => s(c.inicio), render: (c) => fmtData(s(c.inicio)) },
    { chave: "fim", titulo: "Fim:", valor: (c) => s(c.fim), render: (c) => fmtData(s(c.fim)) },
    { chave: "status", titulo: "Status:", valor: (c) => (c.ativo ? "Ativo" : "Inativo"), render: (c) => <Selo tom={c.ativo ? "success" : "danger"}>{c.ativo ? "Ativo" : "Inativo"}</Selo> },
    {
      chave: "acoes",
      titulo: "Ações",
      valor: () => "",
      exportar: false,
      ordenavel: false,
      render: (c) =>
        podeEditar && (
          <span className="flex items-center gap-[0.8rem] [&_svg]:size-[16px]">
            <button type="button" title="Editar" className="text-[#00cfe8]" onClick={() => setEdicao({ id: c.id, dados: paraDados(c) })}>
              <Edit />
            </button>
            {c.ativo ? (
              <button
                type="button"
                title="Desativar"
                className="text-[#ea5455]"
                disabled={pending}
                onClick={() => confirm("Por segurança este registro será INATIVADO, deseja mesmo inativá-lo?") && rodar(() => ativarCliente(c.id, false), "Cliente inativado.")}
              >
                <Trash2 />
              </button>
            ) : (
              <button
                type="button"
                title="Ativar"
                className="text-[#28c76f]"
                disabled={pending}
                onClick={() => confirm("Tem certeza que deseja ATIVAR este registro?") && rodar(() => ativarCliente(c.id, true), "Cliente ativado.")}
              >
                <Check />
              </button>
            )}
          </span>
        ),
    },
  ];

  const campo = (k: keyof Dados, rotulo: string, tipo = "text") =>
    edicao && (
      <Campo rotulo={rotulo} htmlFor={`cl-${k}`}>
        <Input id={`cl-${k}`} type={tipo} value={edicao.dados[k]} onChange={(e) => setEdicao((x) => x && { ...x, dados: { ...x.dados, [k]: e.target.value } })} />
      </Campo>
    );
  const selecao = (k: keyof Dados, rotulo: string, opcoes: { valor: string; rotulo: string }[]) =>
    edicao && (
      <Campo rotulo={rotulo} htmlFor={`cl-${k}`}>
        <select id={`cl-${k}`} value={edicao.dados[k]} onChange={(e) => setEdicao((x) => x && { ...x, dados: { ...x.dados, [k]: e.target.value } })} className={selectClass}>
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      </Campo>
    );
  const ufs = [{ valor: "", rotulo: "Selecione" }, ...UFS];
  const simNao = [
    { valor: "0", rotulo: "Não" },
    { valor: "1", rotulo: "Sim" },
  ];

  return (
    <Cartao>
      <div className="flex justify-end gap-[0.5rem] border-b border-border px-[1.5rem] py-[1.5rem]">
        {!inativos && podeEditar && <Button onClick={() => setEdicao({ id: null, dados: paraDados(null) })}>Novo Cliente</Button>}
        <Link href={inativos ? "/clientes" : "/clientes?inativos=1"} className="inline-flex">
          <Button variant="outline">{inativos ? "Ativos" : "Inativos"}</Button>
        </Link>
      </div>
      <div className="pt-[0.5rem]">
        <TabelaDados colunas={colunas} linhas={clientes} chave={(c) => c.id} nomeArquivo="clientes" />
      </div>
      <Dialog open={edicao !== null} onOpenChange={(o) => !o && setEdicao(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-[1.1rem] font-medium text-heading">Cliente</DialogTitle>
          </DialogHeader>
          {edicao && (
            <div>
              <div className="grid gap-x-[1.5rem] md:grid-cols-3">
                {campo("cnpj", "CNPJ")}
                {campo("razao_social", "Razão Social")}
                {campo("nome", "Nome Fantasia")}
                {campo("ie", "IE")}
                {campo("telefone", "Telefone Fixo")}
                {campo("celular", "Celular")}
                {campo("responsavel", "Nome Responsável")}
                {campo("email", "E-Mail", "email")}
              </div>
              <div className="grid gap-x-[1.5rem] md:grid-cols-4">
                {campo("cep", "CEP")}
                {campo("endereco", "Endereço")}
                {campo("complemento", "Complemento")}
                {campo("numero", "Nº")}
                {campo("bairro", "Bairro")}
                {campo("cidade", "Cidade")}
                {selecao("uf", "UF", ufs)}
                {campo("codigo_municipio", "Cod. Municipio")}
              </div>
              <h6 className="mt-[0.5rem] mb-[0.8rem] text-[1rem] font-semibold">Endereço da Obra</h6>
              <div className="grid gap-x-[1.5rem] md:grid-cols-4">
                {campo("cep_entrega", "CEP")}
                {campo("endereco_entrega", "Endereço")}
                {campo("complemento_entrega", "Complemento")}
                {campo("contato_mestre", "Contato Mestre")}
                {campo("telefone_mestre", "Telefone Mestre")}
                {campo("numero_entrega", "Nº")}
                {campo("bairro_entrega", "Bairro")}
                {campo("cidade_entrega", "Cidade")}
                {selecao("uf_entrega", "UF", ufs)}
              </div>
              <div className="grid gap-x-[1.5rem] md:grid-cols-4">
                {selecao("tipo", "Tipo Obra", [{ valor: "", rotulo: "Selecione" }, ...TIPOS_OBRA.map((t) => ({ valor: t, rotulo: t }))])}
                {campo("metragem", "Metragem")}
                {campo("arquitetura", "Arquitetura")}
                {campo("gerenciadora", "Gerenciadora")}
                {campo("inicio", "Data Inicio", "date")}
                {campo("fim", "Data Fim", "date")}
                {campo("vencimento_seguro", "Vencimento Seguro", "date")}
                {campo("cno", "CNO")}
                {selecao("valida_engenharia_nota", "Valida Engenharia Nota", simNao)}
                {selecao("obriga_anexo_oc_nf", "Obriga anexo vinculo OC x NF", simNao)}
              </div>
              <div className="flex gap-[0.5rem]">
                <Button disabled={pending} onClick={() => rodar(() => salvarCliente(edicao.id, edicao.dados), "Cliente salvo.")}>
                  Enviar
                </Button>
                <Button variant="outline" onClick={() => setEdicao(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Cartao>
  );
}

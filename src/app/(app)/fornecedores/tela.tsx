"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Edit, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cartao, Campo, Selo } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import { selectClass } from "@/components/cadastros/registro-form";
import { UFS } from "@/lib/cadastros/config";
import { cn } from "@/lib/utils";
import { ativarFornecedor, salvarFornecedor } from "@/lib/cadastros/original";

// "Fornecedores" do AstroTools: a lista abre vazia e mostra o resultado da "Busca Avançada" (CPF/CNPJ, Nome,
// Classificação, Status); "Novo Fornecedor" / Editar no modal "Adicionar Fornecedor" com Avaliação (estrelas).

export type Fornecedor = Record<string, string | number | boolean | null> & { id: number; nome: string; cpf_cnpj: string; ativo: boolean; bloqueado: boolean };
export type BuscaFornecedor = { cpf: string; nome: string; classificacao: string; status: string };

const CAMPOS = [
  "cpf_cnpj", "nome", "classificacao", "avaliacao", "nome_fantasia", "nome_fantasia_mapa", "inscricao_estadual", "inscricao_municipal", "endereco", "complemento",
  "cep", "numero", "bairro", "cidade", "uf", "contato1_nome", "contato1_fone", "contato1_email", "contato2_nome", "contato2_fone", "contato2_email", "observacao",
  "banco_cnpj_favorecido", "banco_favorecido", "banco", "agencia", "conta",
] as const;
type Dados = Record<(typeof CAMPOS)[number], string>;
const paraDados = (f: Fornecedor | null): Dados => Object.fromEntries(CAMPOS.map((k) => [k, f?.[k] == null ? (k === "avaliacao" ? "0" : "") : String(f[k])])) as Dados;

export function TelaFornecedores({ fornecedores, busca, buscou, podeEditar }: { fornecedores: Fornecedor[]; busca: BuscaFornecedor; buscou: boolean; podeEditar: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [edicao, setEdicao] = useState<{ id: number | null; dados: Dados } | null>(null);
  const [filtro, setFiltro] = useState<BuscaFornecedor | null>(null);
  const rodar = (fn: () => Promise<{ ok: boolean; erro?: string }>, ok: string) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.erro);
      toast.success(ok);
      setEdicao(null);
      router.refresh();
    });

  const colunas: ColunaTabela<Fornecedor>[] = [
    { chave: "id", titulo: "ID", valor: (f) => f.id },
    { chave: "cnpj", titulo: "CNPJ", valor: (f) => f.cpf_cnpj, className: "whitespace-nowrap" },
    { chave: "nome", titulo: "NOME", valor: (f) => f.nome },
    { chave: "fant", titulo: "FANTASIA", valor: (f) => String(f.nome_fantasia ?? "") },
    { chave: "classe", titulo: "CLASSIFICAÇÃO", valor: (f) => String(f.classificacao ?? "") },
    {
      chave: "status",
      titulo: "Status",
      valor: (f) => (f.bloqueado ? "Bloqueado" : f.ativo ? "Ativo" : "Inativo"),
      render: (f) => <Selo tom={f.bloqueado ? "warning" : f.ativo ? "success" : "danger"}>{f.bloqueado ? "Bloqueado" : f.ativo ? "Ativo" : "Inativo"}</Selo>,
    },
    {
      chave: "acoes",
      titulo: "Ações",
      valor: () => "",
      exportar: false,
      ordenavel: false,
      render: (f) =>
        podeEditar && (
          <span className="flex items-center gap-[0.8rem] [&_svg]:size-[16px]">
            <button type="button" title="Editar" className="text-[#00cfe8]" onClick={() => setEdicao({ id: f.id, dados: paraDados(f) })}>
              <Edit />
            </button>
            <button
              type="button"
              title={f.ativo ? "Desativar" : "Ativar"}
              className={f.ativo ? "text-[#ea5455]" : "text-[#28c76f]"}
              disabled={pending}
              onClick={() =>
                confirm(f.ativo ? "Por segurança este registro será INATIVADO, deseja mesmo inativá-lo?" : "Tem certeza que deseja ATIVAR este registro?") &&
                rodar(() => ativarFornecedor(f.id, !f.ativo), f.ativo ? "Fornecedor inativado." : "Fornecedor ativado.")
              }
            >
              {f.ativo ? <Trash2 /> : <Check />}
            </button>
          </span>
        ),
    },
  ];

  const campo = (k: keyof Dados, rotulo: string) =>
    edicao && (
      <Campo rotulo={rotulo} htmlFor={`fo-${k}`}>
        <Input id={`fo-${k}`} value={edicao.dados[k]} onChange={(e) => setEdicao((x) => x && { ...x, dados: { ...x.dados, [k]: e.target.value } })} />
      </Campo>
    );

  const buscar = (b: BuscaFornecedor) => {
    const p = new URLSearchParams({ buscar: "1", ...Object.fromEntries(Object.entries(b).filter(([, v]) => v)) });
    setFiltro(null);
    router.push(`/fornecedores?${p}`);
  };

  return (
    <Cartao>
      <div className="flex justify-end border-b border-border px-[1.5rem] py-[1.5rem]">
        {podeEditar && (
          <Button onClick={() => setEdicao({ id: null, dados: paraDados(null) })}>
            <Plus /> Novo Fornecedor
          </Button>
        )}
      </div>
      <div className="flex justify-end px-[1.5rem] pt-[1rem]">
        <Button variant="outline" onClick={() => setFiltro(busca)}>
          Filtro Avançado
        </Button>
      </div>
      <div className="pt-[0.5rem]">
        <TabelaDados colunas={colunas} linhas={buscou ? fornecedores : []} chave={(f) => f.id} nomeArquivo="fornecedores" />
      </div>

      <Dialog open={filtro !== null} onOpenChange={(o) => !o && setFiltro(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[1.1rem] font-medium text-heading">Busca Avançada</DialogTitle>
          </DialogHeader>
          {filtro && (
            <div>
              <div className="grid gap-x-[1.5rem] md:grid-cols-2">
                <Campo rotulo="CPF/CNPJ" htmlFor="bf-cpf">
                  <Input id="bf-cpf" value={filtro.cpf} onChange={(e) => setFiltro({ ...filtro, cpf: e.target.value })} />
                </Campo>
                <Campo rotulo="Nome" htmlFor="bf-nome">
                  <Input id="bf-nome" value={filtro.nome} onChange={(e) => setFiltro({ ...filtro, nome: e.target.value })} />
                </Campo>
                <Campo rotulo="Classificação" htmlFor="bf-classe">
                  <Input id="bf-classe" value={filtro.classificacao} onChange={(e) => setFiltro({ ...filtro, classificacao: e.target.value })} />
                </Campo>
                <Campo rotulo="Status" htmlFor="bf-status">
                  <select id="bf-status" value={filtro.status} onChange={(e) => setFiltro({ ...filtro, status: e.target.value })} className={selectClass}>
                    <option value="">Selecione</option>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </Campo>
              </div>
              <div className="flex gap-[0.5rem]">
                <Button onClick={() => buscar(filtro)}>Filtro</Button>
                <Button variant="outline" onClick={() => setFiltro(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={edicao !== null} onOpenChange={(o) => !o && setEdicao(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-[1.1rem] font-medium text-heading">{edicao?.id ? "Editar Fornecedor" : "Adicionar Fornecedor"}</DialogTitle>
          </DialogHeader>
          {edicao && (
            <div>
              <div className="grid gap-x-[1.5rem] md:grid-cols-[2fr_4fr_3fr_3fr]">
                {campo("cpf_cnpj", "CPF/CNPJ")}
                {campo("nome", "Nome")}
                {campo("classificacao", "Classificação")}
                <Campo rotulo="Avaliação do Fornecedor:">
                  <span className="flex h-[38px] items-center gap-[0.2rem]">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                        onClick={() => setEdicao((x) => x && { ...x, dados: { ...x.dados, avaliacao: String(n) } })}
                        className={cn(Number(edicao.dados.avaliacao) >= n ? "text-[#ff9f43]" : "text-[#d0d2d6]")}
                      >
                        <Star className="size-[18px]" fill="currentColor" />
                      </button>
                    ))}
                  </span>
                </Campo>
              </div>
              <div className="grid gap-x-[1.5rem] md:grid-cols-4">
                {campo("nome_fantasia", "Nome Fantasia")}
                {campo("nome_fantasia_mapa", "Nome Fantasia Mapa")}
                {campo("inscricao_estadual", "Inscrição Estadual")}
                {campo("inscricao_municipal", "Inscrição Municipal")}
                {campo("endereco", "Endereço")}
                {campo("complemento", "Complemento")}
                {campo("cep", "Cep")}
                {campo("numero", "Numero")}
                {campo("bairro", "Bairro")}
                {campo("cidade", "Cidade")}
                <Campo rotulo="UF" htmlFor="fo-uf">
                  <select id="fo-uf" value={edicao.dados.uf} onChange={(e) => setEdicao((x) => x && { ...x, dados: { ...x.dados, uf: e.target.value } })} className={selectClass}>
                    <option value="">Selecione</option>
                    {UFS.map((u) => (
                      <option key={u.valor} value={u.valor}>
                        {u.rotulo}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
              <div className="grid gap-x-[1.5rem] md:grid-cols-3">
                {campo("contato1_nome", "Contato")}
                {campo("contato1_fone", "Fone")}
                {campo("contato1_email", "E-mail")}
                {campo("contato2_nome", "Contato")}
                {campo("contato2_fone", "Fone")}
                {campo("contato2_email", "E-mail")}
              </div>
              <Campo rotulo="Observação" htmlFor="fo-obs">
                <Textarea id="fo-obs" rows={2} value={edicao.dados.observacao} onChange={(e) => setEdicao((x) => x && { ...x, dados: { ...x.dados, observacao: e.target.value } })} />
              </Campo>
              <div className="grid gap-x-[1.5rem] md:grid-cols-5">
                {campo("banco_cnpj_favorecido", "CNPJ")}
                {campo("banco_favorecido", "Favorecido")}
                {campo("banco", "Banco")}
                {campo("agencia", "Agencia")}
                {campo("conta", "Conta")}
              </div>
              <div className="flex gap-[0.5rem]">
                <Button disabled={pending} onClick={() => rodar(() => salvarFornecedor(edicao.id, edicao.dados), "Fornecedor salvo.")}>
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

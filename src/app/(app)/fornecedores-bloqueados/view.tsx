"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cartao, Campo } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import { selectClass } from "@/components/cadastros/registro-form";
import { data as fmtData } from "@/lib/format";
import { bloquearFornecedor, desbloquearFornecedor } from "@/lib/cadastros/original";

// "Fornecedores Bloqueados" do AstroTools: formulário de bloqueio (só Administrador), tabela e "Detalhes do Bloqueio".

export type Bloqueado = {
  id: number;
  cpf_cnpj: string;
  nome: string;
  nome_fantasia: string | null;
  bloqueio_id: number;
  bloqueio_justificativa: string;
  bloqueado_em: string;
  bloqueado_por_nome: string | null;
};

export function BloqueadosView({ bloqueados, disponiveis, ehAdmin }: { bloqueados: Bloqueado[]; disponiveis: { valor: string; rotulo: string }[]; ehAdmin: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fornecedor, setFornecedor] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [detalhe, setDetalhe] = useState<Bloqueado | null>(null);
  const rodar = (fn: () => Promise<{ ok: boolean; erro?: string }>, ok: string, depois?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.erro);
      toast.success(ok);
      depois?.();
      router.refresh();
    });

  const colunas: ColunaTabela<Bloqueado>[] = [
    { chave: "cnpj", titulo: "CNPJ", valor: (b) => b.cpf_cnpj, className: "whitespace-nowrap" },
    { chave: "nome", titulo: "NOME", valor: (b) => b.nome },
    { chave: "fant", titulo: "FANTASIA", valor: (b) => b.nome_fantasia ?? "" },
    { chave: "data", titulo: "DATA BLOQUEIO", valor: (b) => b.bloqueado_em, render: (b) => fmtData(b.bloqueado_em) },
    {
      chave: "det",
      titulo: "Detalhes",
      valor: () => "",
      exportar: false,
      ordenavel: false,
      render: (b) => (
        <button type="button" title="Vizualizar" className="text-primary" onClick={() => setDetalhe(b)}>
          <Search className="size-[14px]" />
        </button>
      ),
    },
  ];

  return (
    <Cartao>
      <div className="border-b border-border px-[1.5rem] py-[1.5rem]">
        <div className="md:w-1/2">
          <Campo rotulo="Fornecedores Ativos" htmlFor="b-forn">
            <select id="b-forn" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className={selectClass}>
              <option value="">Selecione uma Fornecedor</option>
              {disponiveis.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Justificativa Bloqueio" htmlFor="b-just">
          <Textarea id="b-just" rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
        </Campo>
        {ehAdmin && (
          <Button
            disabled={pending}
            onClick={() =>
              rodar(() => bloquearFornecedor(Number(fornecedor), justificativa), "Fornecedor bloqueado.", () => {
                setFornecedor("");
                setJustificativa("");
              })
            }
          >
            Bloquear
          </Button>
        )}
      </div>
      <div className="pt-[0.5rem]">
        <TabelaDados colunas={colunas} linhas={bloqueados} chave={(b) => b.bloqueio_id} nomeArquivo="fornecedores-bloqueados" />
      </div>
      <Dialog open={detalhe !== null} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[1.1rem] font-medium text-heading">Detalhes do Bloqueio</DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div>
              <div className="grid gap-x-[1.5rem] md:grid-cols-2">
                <Campo rotulo="Usuário" htmlFor="d-usu">
                  <Input id="d-usu" readOnly value={detalhe.bloqueado_por_nome ?? ""} />
                </Campo>
                <Campo rotulo="Data Bloqueio" htmlFor="d-data">
                  <Input id="d-data" type="date" readOnly value={detalhe.bloqueado_em.slice(0, 10)} />
                </Campo>
              </div>
              <Campo rotulo="Justificativa Bloqueio" htmlFor="d-just">
                <Textarea id="d-just" rows={3} readOnly value={detalhe.bloqueio_justificativa} />
              </Campo>
              <div className="flex gap-[0.5rem]">
                {ehAdmin && (
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => confirm(`Desbloquear ${detalhe.nome}?`) && rodar(() => desbloquearFornecedor(detalhe.bloqueio_id), "Fornecedor desbloqueado.", () => setDetalhe(null))}
                  >
                    Desbloquear
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetalhe(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Cartao>
  );
}

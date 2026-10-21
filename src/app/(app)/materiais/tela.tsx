"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cartao, Campo, Selo } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import { selectClass } from "@/components/cadastros/registro-form";
import { ativarMaterial, salvarMaterial, type DadosMaterial } from "./actions";

// "Materiais" do AstroTools (menu de Suprimentos): Id, Nome, Und., Status, Editar e Desativar/Ativar.

export type Material = { id: number; descricao: string; unidade: string; tipo_item: string | null; fornecedor_preferencial_id: number | null; observacao: string | null; ativo: boolean };
type Opcao = { valor: string; rotulo: string };

const VAZIO: DadosMaterial = { nome: "", unid_med: "", tipo_item: "", fornecedor_preferencial_id: "", observacao: "" };

export function TelaMateriais({ materiais, fornecedores, podeEditar }: { materiais: Material[]; fornecedores: Opcao[]; podeEditar: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [edicao, setEdicao] = useState<{ id: number | null; dados: DadosMaterial } | null>(null);
  const rodar = (fn: () => Promise<{ ok: boolean; erro?: string }>, ok: string) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.erro);
      toast.success(ok);
      setEdicao(null);
      router.refresh();
    });

  const colunas: ColunaTabela<Material>[] = [
    { chave: "id", titulo: "Id", valor: (m) => m.id },
    { chave: "nome", titulo: "Nome", valor: (m) => m.descricao },
    { chave: "un", titulo: "Und.", valor: (m) => m.unidade },
    { chave: "status", titulo: "Status", valor: (m) => (m.ativo ? "Ativo" : "Inativo"), render: (m) => <Selo tom={m.ativo ? "success" : "danger"}>{m.ativo ? "Ativo" : "Inativo"}</Selo> },
    {
      chave: "acoes",
      titulo: "Ações",
      valor: () => "",
      exportar: false,
      ordenavel: false,
      render: (m) =>
        podeEditar && (
          <span className="flex items-center gap-[0.8rem] [&_svg]:size-[16px]">
            <button
              type="button"
              title="Editar"
              className="text-[#00cfe8]"
              onClick={() =>
                setEdicao({
                  id: m.id,
                  dados: { nome: m.descricao, unid_med: m.unidade, tipo_item: m.tipo_item ?? "", fornecedor_preferencial_id: m.fornecedor_preferencial_id ? String(m.fornecedor_preferencial_id) : "", observacao: m.observacao ?? "" },
                })
              }
            >
              <Edit />
            </button>
            <button
              type="button"
              title={m.ativo ? "Desativar" : "Ativar"}
              className={m.ativo ? "text-[#ea5455]" : "text-[#28c76f]"}
              disabled={pending}
              onClick={() =>
                confirm(m.ativo ? "Confirma a desativação do material?" : "Confirma a ativação do material?") &&
                rodar(() => ativarMaterial(m.id, !m.ativo), m.ativo ? "Material desativado." : "Material ativado.")
              }
            >
              {m.ativo ? <ToggleRight /> : <ToggleLeft />}
            </button>
          </span>
        ),
    },
  ];

  const set = (k: keyof DadosMaterial) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEdicao((x) => x && { ...x, dados: { ...x.dados, [k]: e.target.value } });

  return (
    <Cartao>
      <div className="flex items-center justify-between border-b border-border px-[1.5rem] py-[1.5rem]">
        <h4 className="mb-0 text-[1.285rem] font-medium">Materiais</h4>
        {podeEditar && <Button onClick={() => setEdicao({ id: null, dados: VAZIO })}>Novo Material</Button>}
      </div>
      <div className="pt-[0.5rem]">
        <TabelaDados colunas={colunas} linhas={materiais} chave={(m) => m.id} nomeArquivo="materiais" />
      </div>
      <Dialog open={edicao !== null} onOpenChange={(o) => !o && setEdicao(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[1.1rem] font-medium text-heading">{edicao?.id ? "Editar Materias" : "Adicionar Materias"}</DialogTitle>
          </DialogHeader>
          {edicao && (
            <div>
              <Campo rotulo="Nome do Material" htmlFor="mt-nome">
                <Input id="mt-nome" value={edicao.dados.nome} onChange={set("nome")} />
              </Campo>
              <div className="grid gap-x-[1.5rem] md:grid-cols-2">
                <Campo rotulo="Unidade de Medida" htmlFor="mt-un">
                  <Input id="mt-un" value={edicao.dados.unid_med} onChange={set("unid_med")} />
                </Campo>
                <Campo rotulo="Tipo Item" htmlFor="mt-tipo">
                  <Input id="mt-tipo" value={edicao.dados.tipo_item} onChange={set("tipo_item")} />
                </Campo>
              </div>
              <Campo rotulo="Fornecedor preferencial" htmlFor="mt-forn">
                <select id="mt-forn" value={edicao.dados.fornecedor_preferencial_id} onChange={set("fornecedor_preferencial_id")} className={selectClass}>
                  <option value="">Selecione uma Unidade</option>
                  {fornecedores.map((f) => (
                    <option key={f.valor} value={f.valor}>
                      {f.rotulo}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Observação" htmlFor="mt-obs">
                <Textarea id="mt-obs" rows={3} value={edicao.dados.observacao} onChange={set("observacao")} />
              </Campo>
              <div className="flex gap-[0.5rem]">
                <Button disabled={pending} onClick={() => rodar(() => salvarMaterial(edicao.id, edicao.dados), "Material salvo.")}>
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

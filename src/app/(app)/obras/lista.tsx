"use client";

import { useState, useTransition } from "react";
import { FileText, Power, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cartao, CartaoEstatistica, Campo, Selo } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { RegistroForm, selectClass, type Opcoes, type Registro } from "@/components/cadastros/registro-form";
import { ENTIDADES, REGIMES } from "@/lib/cadastros/config";
import { alternarAtivo, excluirRegistro } from "@/lib/cadastros/actions";

// "Listagem de Obras" do AstroTools.

const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Selo da coluna Seguro: sem validade = Pendente; validade passada = Vencido; senão Ok. */
function situacaoSeguro(r: Registro): "Pendente" | "Vencido" | "Ok" {
  const v = r.validade_seguro as string | null;
  if (!v) return "Pendente";
  return v < hoje() ? "Vencido" : "Ok";
}

const rotuloRegime = (v: unknown) => REGIMES.find((r) => r.valor === v)?.rotulo ?? String(v ?? "");

export function ListaObras({ registros, opcoes, podeEditar, podeExcluir }: { registros: Registro[]; opcoes: Opcoes; podeEditar: boolean; podeExcluir: boolean }) {
  const [regime, setRegime] = useState("");
  const [status, setStatus] = useState("ativo");
  const [novo, setNovo] = useState(false);
  const [, startTransition] = useTransition();

  const ativas = registros.filter((r) => r.ativo).length;
  const filtradas = registros.filter((r) => (!regime || r.regime === regime) && (!status || (status === "ativo" ? r.ativo : !r.ativo)));

  const executar = (fn: () => Promise<void>, ok: string) =>
    startTransition(async () => {
      try {
        await fn();
        toast.success(ok);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });

  const colunas: ColunaTabela<Registro>[] = [
    { chave: "codigo", titulo: "Cod.", valor: (r) => String(r.codigo ?? "") },
    { chave: "nome", titulo: "Nome", valor: (r) => String(r.nome ?? "") },
    { chave: "regime", titulo: "Regime", valor: (r) => rotuloRegime(r.regime) },
    {
      chave: "status",
      titulo: "Status",
      valor: (r) => (r.ativo ? "Ativo" : "Inativo"),
      render: (r) => <Selo tom={r.ativo ? "success" : "danger"}>{r.ativo ? "Ativo" : "Inativo"}</Selo>,
    },
    {
      chave: "seguro",
      titulo: "Seguro",
      valor: (r) => situacaoSeguro(r),
      render: (r) => {
        const s = situacaoSeguro(r);
        return <Selo tom={s === "Ok" ? "success" : "danger"}>{s}</Selo>;
      },
    },
    {
      chave: "acoes",
      titulo: "Ações",
      ordenavel: false,
      exportar: false,
      valor: () => "",
      render: (r) => (
        <span className="flex items-center gap-3">
          <button type="button" title="Visualizar" onClick={() => window.open(`/obras/${r.id}`, "_blank")} className="text-[#00cfe8]">
            <Search className="size-[14px]" />
          </button>
          {podeEditar && (
            <button
              type="button"
              title={r.ativo ? "Inativar" : "Ativar"}
              className={r.ativo ? "text-[#ff9f43]" : "text-[#28c76f]"}
              onClick={() => {
                const texto = r.ativo ? "Por segurança este registro será INATIVADO, deseja mesmo inativá-lo?" : "Tem certeza que deseja ATIVAR este registro?";
                if (confirm(texto)) executar(() => alternarAtivo("obras", r.id!, !r.ativo), r.ativo ? "Obra inativada." : "Obra ativada.");
              }}
            >
              <Power className="size-[14px]" />
            </button>
          )}
          {podeExcluir && (
            <button
              type="button"
              title="Excluir"
              className="text-[#ea5455]"
              onClick={() => {
                if (confirm("Tem certeza que deseja EXCLUIR a Obra? Esta opção Exclui definitivamente todos os Registros!")) executar(() => excluirRegistro("obras", r.id!), "Obra excluída.");
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
    <>
      <CabecalhoPagina titulo="Listagem de Obras" migalhas={[{ titulo: "Obras" }]} />

      <div className="mb-[2rem] grid gap-[2rem] md:grid-cols-3">
        <CartaoEstatistica valor={registros.length} rotulo="Total de Obras" tom="primary" icone={<FileText />} />
        <CartaoEstatistica valor={registros.length - ativas} rotulo="Obras Inativas" tom="danger" icone={<FileText />} />
        <CartaoEstatistica valor={ativas} rotulo="Obras Ativas" tom="success" icone={<FileText />} />
      </div>

      <Cartao>
        <div className="flex items-center justify-between px-[1.5rem] pt-[1.5rem]">
          <h4 className="mb-0 text-[1.285rem] font-medium">Busca &amp; Filtro</h4>
          {podeEditar && <Button onClick={() => setNovo(true)}>Adicionar</Button>}
        </div>
        <div className="grid gap-x-[2rem] border-b border-border px-[1.5rem] pt-[1.5rem] pb-[0.5rem] md:grid-cols-3">
          <Campo rotulo="Regime" htmlFor="ObraRegime">
            <select id="ObraRegime" value={regime} onChange={(e) => setRegime(e.target.value)} className={selectClass}>
              <option value="">Selecione..</option>
              {REGIMES.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Status" htmlFor="ObraStatus">
            <select id="ObraStatus" value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
              <option value="">Selecione..</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </Campo>
        </div>
        <TabelaDados colunas={colunas} linhas={filtradas} chave={(r) => r.id!} nomeArquivo="obras" />
      </Cartao>

      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nova obra</DialogTitle>
            <DialogDescription>Campos com * são obrigatórios.</DialogDescription>
          </DialogHeader>
          {novo && <RegistroForm entidade={ENTIDADES.obras} registro={null} opcoes={opcoes} onSalvo={() => setNovo(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

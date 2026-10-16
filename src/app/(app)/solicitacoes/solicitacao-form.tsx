"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileStack, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampoArea, CampoSelect, CampoTexto } from "@/components/compras/campos";
import { ItensEditor, linhasParaPayload, validarLinhas } from "@/components/compras/itens-editor";
import { StatusBadge } from "@/components/compras/status-badge";
import { salvarSolicitacao } from "@/lib/compras/actions";
import { numeroSolicitacao, STATUS_SOLICITACAO, type ItemCatalogo, type LinhaItem, type Opcao } from "@/lib/compras/tipos";

export type DadosSolicitacao = { obra_id: string; servico: string; observacao: string };

export function SolicitacaoForm({
  id,
  status,
  inicial,
  itensIniciais,
  obras,
  catalogo,
  editavel,
  podeGerarMapa,
}: {
  id: number | null;
  status?: string;
  inicial: DadosSolicitacao;
  itensIniciais: LinhaItem[];
  obras: Opcao[];
  catalogo: ItemCatalogo[];
  editavel: boolean;
  podeGerarMapa: boolean;
}) {
  const router = useRouter();
  const [dados, setDados] = useState(inicial);
  const [itens, setItens] = useState(itensIniciais);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof DadosSolicitacao) => (v: string) => setDados((d) => ({ ...d, [k]: v }));

  const salvar = () => {
    const erroItens = validarLinhas(itens);
    if (erroItens) return toast.error(erroItens);
    startTransition(async () => {
      const r = await salvarSolicitacao(id, dados, linhasParaPayload(itens, "medio"));
      if (!r.ok) return void toast.error(r.erro);
      toast.success(id ? "Solicitação atualizada." : `Solicitação ${numeroSolicitacao(r.id!)} criada.`);
      if (!id) router.push(`/solicitacoes/${r.id}`);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" render={<Link href="/solicitacoes" />} aria-label="Voltar">
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{id ? numeroSolicitacao(id) : "Nova solicitação"}</h1>
            {status && <StatusBadge mapa={STATUS_SOLICITACAO} valor={status} />}
          </div>
        </div>
        <div className="flex gap-2">
          {podeGerarMapa && id && (
            <Button variant="outline" render={<Link href={`/mapas/novo?solicitacao=${id}`} />}>
              <FileStack /> Gerar mapa de cotação
            </Button>
          )}
          {editavel && (
            <Button onClick={salvar} disabled={pending}>
              <Save /> {pending ? "Salvando…" : "Salvar"}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da solicitação</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <CampoSelect id="obra" rotulo="Obra" obrigatorio valor={dados.obra_id} onChange={set("obra_id")} opcoes={obras} desabilitado={!editavel} />
          <CampoTexto id="servico" rotulo="Serviço" obrigatorio valor={dados.servico} onChange={set("servico")} className="sm:col-span-2" desabilitado={!editavel} />
          <CampoArea id="obs" rotulo="Observação" valor={dados.observacao} onChange={set("observacao")} className="sm:col-span-3" desabilitado={!editavel} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens</CardTitle>
        </CardHeader>
        <CardContent>
          <ItensEditor linhas={itens} onChange={setItens} catalogo={catalogo} preco="medio" titulo somenteLeitura={!editavel} />
        </CardContent>
      </Card>
    </div>
  );
}

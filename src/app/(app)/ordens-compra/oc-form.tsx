"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampoArea, CampoSelect, CampoTexto } from "@/components/compras/campos";
import { ItensEditor, linhasParaPayload, validarLinhas } from "@/components/compras/itens-editor";
import { salvarOc } from "@/lib/compras/actions";
import { moeda } from "@/lib/format";
import { num, numeroOC, type ItemCatalogo, type LinhaItem, type Opcao } from "@/lib/compras/tipos";

export type DadosOc = {
  obra_id: string;
  fornecedor_id: string;
  engenheiro_responsavel: string;
  data_emissao: string;
  data_entrega: string;
  condicao_pagamento: string;
  prazo_entrega: string;
  frete: string;
  observacao: string;
};

export function OcForm({
  id,
  inicial,
  itensIniciais,
  obras,
  fornecedores,
  catalogo,
  editavel,
}: {
  id: number | null;
  inicial: DadosOc;
  itensIniciais: LinhaItem[];
  obras: Opcao[];
  fornecedores: (Opcao & { bloqueado: boolean })[];
  catalogo: ItemCatalogo[];
  editavel: boolean;
}) {
  const router = useRouter();
  const [dados, setDados] = useState(inicial);
  const [itens, setItens] = useState(itensIniciais);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof DadosOc) => (v: string) => setDados((d) => ({ ...d, [k]: v }));
  const fornBloqueado = fornecedores.find((f) => f.valor === dados.fornecedor_id)?.bloqueado;
  const total = itens.reduce((s, l) => s + num(l.quantidade) * num(l.valor_unitario), 0) + num(dados.frete);

  const salvar = () => {
    const erro = validarLinhas(itens);
    if (erro) return toast.error(erro);
    startTransition(async () => {
      const r = await salvarOc(id, dados, linhasParaPayload(itens, "unitario"));
      if (!r.ok) return void toast.error(r.erro);
      toast.success(id ? "OC atualizada (voltou para rascunho)." : `${numeroOC(r.id!)} criada em rascunho.`);
      if (!id) router.push(`/ordens-compra/${r.id}`);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Dados da ordem de compra</CardTitle>
          {editavel && (
            <Button onClick={salvar} disabled={pending} size="sm">
              <Save /> {pending ? "Salvando…" : "Salvar"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <CampoSelect id="obra" rotulo="Obra" obrigatorio valor={dados.obra_id} onChange={set("obra_id")} opcoes={obras} desabilitado={!editavel} />
          <CampoSelect id="fornecedor" rotulo="Fornecedor" obrigatorio valor={dados.fornecedor_id} onChange={set("fornecedor_id")} opcoes={fornecedores} className="sm:col-span-2" desabilitado={!editavel} />
          {fornBloqueado && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive sm:col-span-3">
              Este fornecedor está bloqueado. A OC não poderá ser enviada para aprovação.
            </p>
          )}
          <CampoTexto id="eng" rotulo="Engenheiro responsável" valor={dados.engenheiro_responsavel} onChange={set("engenheiro_responsavel")} desabilitado={!editavel} />
          <CampoTexto id="emissao" rotulo="Data de emissão" tipo="date" valor={dados.data_emissao} onChange={set("data_emissao")} desabilitado={!editavel} />
          <CampoTexto id="entrega" rotulo="Data de entrega" tipo="date" valor={dados.data_entrega} onChange={set("data_entrega")} desabilitado={!editavel} />
          <CampoTexto id="cond" rotulo="Condição de pagamento" valor={dados.condicao_pagamento} onChange={set("condicao_pagamento")} desabilitado={!editavel} />
          <CampoTexto id="prazo" rotulo="Prazo de entrega" valor={dados.prazo_entrega} onChange={set("prazo_entrega")} desabilitado={!editavel} />
          <CampoTexto id="frete" rotulo="Frete (R$)" tipo="number" valor={dados.frete} onChange={set("frete")} desabilitado={!editavel} />
          <CampoArea id="obs" rotulo="Observação" valor={dados.observacao} onChange={set("observacao")} className="sm:col-span-3" desabilitado={!editavel} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Itens</CardTitle>
          <span className="text-sm">
            Total com frete: <span className="font-semibold tabular-nums">{moeda(total)}</span>
          </span>
        </CardHeader>
        <CardContent>
          <ItensEditor linhas={itens} onChange={setItens} catalogo={catalogo} preco="unitario" somenteLeitura={!editavel} />
        </CardContent>
      </Card>
    </div>
  );
}

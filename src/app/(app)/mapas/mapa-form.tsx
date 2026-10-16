"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampoArea, CampoSelect, CampoTexto } from "@/components/compras/campos";
import { ItensEditor, linhasParaPayload, validarLinhas } from "@/components/compras/itens-editor";
import { salvarMapa } from "@/lib/compras/actions";
import { numeroMapa, TIPOS_MAPA, type ItemCatalogo, type LinhaItem, type Opcao } from "@/lib/compras/tipos";

export type DadosMapa = {
  obra_id: string;
  solicitacao_id: string;
  servico: string;
  apropriacao: string;
  tipo: string;
  data_entrega: string;
  prazo_locacao: string;
  data_devolucao: string;
  observacao: string;
};

export function MapaForm({
  id,
  inicial,
  itensIniciais,
  obras,
  catalogo,
  editavel,
}: {
  id: number | null;
  inicial: DadosMapa;
  itensIniciais: LinhaItem[];
  obras: Opcao[];
  catalogo: ItemCatalogo[];
  editavel: boolean;
}) {
  const router = useRouter();
  const [dados, setDados] = useState(inicial);
  const [itens, setItens] = useState(itensIniciais);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof DadosMapa) => (v: string) => setDados((d) => ({ ...d, [k]: v }));

  const salvar = () => {
    const erro = validarLinhas(itens);
    if (erro) return toast.error(erro);
    startTransition(async () => {
      const r = await salvarMapa(id, dados, linhasParaPayload(itens, "medio"));
      if (!r.ok) return void toast.error(r.erro);
      toast.success(id ? "Mapa atualizado." : `Mapa ${numeroMapa(r.id!)} criado. Agora inclua os fornecedores e preços.`);
      if (!id) router.push(`/mapas/${r.id}`);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Dados do mapa</CardTitle>
          {editavel && (
            <Button onClick={salvar} disabled={pending} size="sm">
              <Save /> {pending ? "Salvando…" : id ? "Salvar dados e itens" : "Criar mapa"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <CampoSelect id="obra" rotulo="Obra" obrigatorio valor={dados.obra_id} onChange={set("obra_id")} opcoes={obras} desabilitado={!editavel} />
          <CampoTexto id="servico" rotulo="Serviço" obrigatorio valor={dados.servico} onChange={set("servico")} className="sm:col-span-2" desabilitado={!editavel} />
          <CampoSelect id="tipo" rotulo="Tipo" obrigatorio valor={dados.tipo} onChange={set("tipo")} opcoes={TIPOS_MAPA} desabilitado={!editavel} />
          <CampoTexto id="apropriacao" rotulo="Apropriação" valor={dados.apropriacao} onChange={set("apropriacao")} desabilitado={!editavel} />
          <CampoTexto id="entrega" rotulo="Data de entrega" tipo="date" valor={dados.data_entrega} onChange={set("data_entrega")} desabilitado={!editavel} />
          {dados.tipo === "locacao" && (
            <>
              <CampoTexto id="prazo" rotulo="Prazo de locação" valor={dados.prazo_locacao} onChange={set("prazo_locacao")} desabilitado={!editavel} />
              <CampoTexto id="devolucao" rotulo="Data de devolução" tipo="date" valor={dados.data_devolucao} onChange={set("data_devolucao")} desabilitado={!editavel} />
            </>
          )}
          <CampoArea id="obs" rotulo="Observação" valor={dados.observacao} onChange={set("observacao")} className="sm:col-span-3" desabilitado={!editavel} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens a cotar</CardTitle>
        </CardHeader>
        <CardContent>
          <ItensEditor linhas={itens} onChange={setItens} catalogo={catalogo} preco="medio" titulo somenteLeitura={!editavel} />
        </CardContent>
      </Card>
    </div>
  );
}

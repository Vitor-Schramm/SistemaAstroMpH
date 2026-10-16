"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampoArea, CampoSelect, CampoTexto } from "@/components/compras/campos";
import { moeda } from "@/lib/format";
import { numeroOC } from "@/lib/compras/tipos";
import { FASES } from "@/lib/notas/tipos";
import { salvarNota } from "@/lib/notas/actions";

export type OcSaldo = {
  id: number;
  obra_codigo: string;
  obra_nome: string;
  fornecedor_nome: string;
  valor_total: number;
  saldo: number;
};

export type DadosNota = {
  fase: string;
  ordem_compra_id: string;
  numero: string;
  serie: string;
  emissao: string;
  vencimento: string;
  valor: string;
  observacao: string;
};

export function NotaForm({ id, inicial, ocs, editavel }: { id: number | null; inicial: DadosNota; ocs: OcSaldo[]; editavel: boolean }) {
  const router = useRouter();
  const [dados, setDados] = useState(inicial);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof DadosNota) => (v: string) => setDados((d) => ({ ...d, [k]: v }));
  const oc = ocs.find((o) => String(o.id) === dados.ordem_compra_id);
  // Na edição, o valor atual da nota ainda está descontado do saldo.
  const saldo = oc ? Number(oc.saldo) + (id ? Number(inicial.valor || 0) : 0) : null;

  const salvar = () =>
    startTransition(async () => {
      const r = await salvarNota(id, { ...dados, valor: Number(dados.valor) });
      if (!r.ok) return void toast.error(r.erro);
      toast.success(id ? "Nota corrigida e reenviada à engenharia." : "Nota registrada. Agora anexe o arquivo da NF.");
      if (!id) router.push(`/notas/${r.id}`);
      else router.refresh();
    });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Dados da nota fiscal</CardTitle>
        {editavel && (
          <Button size="sm" onClick={salvar} disabled={pending}>
            <Save /> {pending ? "Salvando…" : id ? "Salvar correção" : "Registrar nota"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-4">
        <CampoSelect id="fase" rotulo="Fase" obrigatorio valor={dados.fase} onChange={set("fase")} opcoes={FASES} className="sm:col-span-2" desabilitado={!editavel} />
        <CampoSelect
          id="oc"
          rotulo="Ordem de compra (aprovada)"
          obrigatorio
          valor={dados.ordem_compra_id}
          onChange={set("ordem_compra_id")}
          opcoes={ocs.map((o) => ({
            valor: String(o.id),
            rotulo: `${numeroOC(o.id)} · ${o.fornecedor_nome} · ${o.obra_codigo} · saldo ${moeda(Number(o.saldo))}`,
          }))}
          className="sm:col-span-2"
          desabilitado={!editavel}
        />
        {oc && (
          <div className="rounded-md bg-muted p-3 text-sm sm:col-span-4">
            <b>{oc.fornecedor_nome}</b> · Obra {oc.obra_codigo} — {oc.obra_nome} · Valor da OC {moeda(Number(oc.valor_total))} · Saldo disponível para
            notas <b>{moeda(saldo ?? 0)}</b>
          </div>
        )}
        <CampoTexto id="numero" rotulo="Número da NF" obrigatorio valor={dados.numero} onChange={set("numero")} desabilitado={!editavel} />
        <CampoTexto id="serie" rotulo="Série" valor={dados.serie} onChange={set("serie")} desabilitado={!editavel} />
        <CampoTexto id="emissao" rotulo="Emissão" tipo="date" valor={dados.emissao} onChange={set("emissao")} desabilitado={!editavel} />
        <CampoTexto id="venc" rotulo="Vencimento" tipo="date" obrigatorio valor={dados.vencimento} onChange={set("vencimento")} desabilitado={!editavel} />
        <CampoTexto id="valor" rotulo="Valor (R$)" tipo="number" obrigatorio valor={dados.valor} onChange={set("valor")} desabilitado={!editavel} />
        <CampoArea id="obs" rotulo="Observação" valor={dados.observacao} onChange={set("observacao")} className="sm:col-span-3" desabilitado={!editavel} />
      </CardContent>
    </Card>
  );
}

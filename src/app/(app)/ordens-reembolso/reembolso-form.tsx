"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CampoArea, CampoSelect, CampoTexto } from "@/components/compras/campos";
import { novaChave } from "@/components/compras/itens-editor";
import { aplicarMascara, moeda } from "@/lib/format";
import { num, type Opcao } from "@/lib/compras/tipos";
import { salvarReembolso } from "@/lib/reembolsos/actions";
import { numeroReembolso, type Favorecido } from "@/lib/reembolsos/tipos";

export type DadosReembolso = {
  obra_id: string;
  filial: string;
  fornecedor_id: string;
  cpf_cnpj: string;
  banco: string;
  agencia: string;
  conta: string;
  observacao: string;
};
export type ItemReembolso = { chave: string; descricao: string; apropriacao: string; tipo: string; data: string; valor: string };

export function ReembolsoForm({
  id,
  inicial,
  itensIniciais,
  obras,
  favorecidos,
  editavel,
}: {
  id: number | null;
  inicial: DadosReembolso;
  itensIniciais: ItemReembolso[];
  obras: Opcao[];
  favorecidos: Favorecido[];
  editavel: boolean;
}) {
  const router = useRouter();
  const [dados, setDados] = useState(inicial);
  const [itens, setItens] = useState(itensIniciais);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof DadosReembolso) => (v: string) => setDados((d) => ({ ...d, [k]: v }));
  const total = itens.reduce((s, i) => s + num(i.valor), 0);

  const escolherFavorecido = (v: string) => {
    const f = favorecidos.find((x) => x.valor === v);
    if (f?.bloqueado) toast.warning("Este fornecedor está bloqueado.");
    setDados((d) => ({
      ...d,
      fornecedor_id: v,
      // Preenche com os dados bancários do cadastro, sem apagar o que já foi digitado.
      cpf_cnpj: f?.cpf_cnpj || d.cpf_cnpj,
      banco: f?.banco || d.banco,
      agencia: f?.agencia || d.agencia,
      conta: f?.conta || d.conta,
    }));
  };

  const atualizar = (chave: string, patch: Partial<ItemReembolso>) => setItens((l) => l.map((i) => (i.chave === chave ? { ...i, ...patch } : i)));

  const salvar = () => {
    if (!itens.length) return toast.error("Inclua ao menos um item.");
    const invalido = itens.findIndex((i) => !i.descricao.trim() || num(i.valor) <= 0);
    if (invalido >= 0) return toast.error(`Item ${invalido + 1}: informe descrição e valor.`);
    startTransition(async () => {
      const r = await salvarReembolso(
        id,
        dados,
        itens.map((i) => ({ descricao: i.descricao.trim(), apropriacao: i.apropriacao, tipo: i.tipo, data: i.data, valor: num(i.valor) })),
      );
      if (!r.ok) return void toast.error(r.erro);
      toast.success(id ? "Reembolso salvo (em rascunho)." : `${numeroReembolso(r.id!)} criado. Envie para aprovação quando estiver pronto.`);
      if (!id) router.push(`/ordens-reembolso/${r.id}`);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Dados do reembolso</CardTitle>
          {editavel && (
            <Button size="sm" onClick={salvar} disabled={pending}>
              <Save /> {pending ? "Salvando…" : "Salvar"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <CampoSelect id="obra" rotulo="Obra" obrigatorio valor={dados.obra_id} onChange={set("obra_id")} opcoes={obras} className="sm:col-span-2" desabilitado={!editavel} />
          <CampoTexto id="filial" rotulo="Filial" valor={dados.filial} onChange={set("filial")} desabilitado={!editavel} />
          <div />
          <CampoSelect
            id="forn"
            rotulo="Fornecedor / favorecido"
            obrigatorio
            valor={dados.fornecedor_id}
            onChange={escolherFavorecido}
            opcoes={favorecidos}
            className="sm:col-span-2"
            desabilitado={!editavel}
          />
          <CampoTexto id="cpf" rotulo="CPF/CNPJ" obrigatorio valor={dados.cpf_cnpj} onChange={(v) => set("cpf_cnpj")(aplicarMascara(v, "cpf_cnpj"))} desabilitado={!editavel} />
          <div />
          <CampoTexto id="banco" rotulo="Banco" obrigatorio valor={dados.banco} onChange={set("banco")} desabilitado={!editavel} />
          <CampoTexto id="agencia" rotulo="Agência" obrigatorio valor={dados.agencia} onChange={set("agencia")} desabilitado={!editavel} />
          <CampoTexto id="conta" rotulo="Conta" obrigatorio valor={dados.conta} onChange={set("conta")} desabilitado={!editavel} />
          <div />
          <CampoArea id="obs" rotulo="Observação" valor={dados.observacao} onChange={set("observacao")} className="sm:col-span-4" desabilitado={!editavel} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Itens</CardTitle>
          {editavel && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setItens((l) => [...l, { chave: novaChave(), descricao: "", apropriacao: "", tipo: "", data: "", valor: "" }])}
            >
              <Plus /> Adicionar item
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead className="min-w-56">Item</TableHead>
                  <TableHead className="w-40">Apropriação</TableHead>
                  <TableHead className="w-36">Tipo</TableHead>
                  <TableHead className="w-40">Data</TableHead>
                  <TableHead className="w-36">Valor</TableHead>
                  {editavel && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-16 text-center text-muted-foreground">
                      Nenhum item. Clique em “Adicionar item”.
                    </TableCell>
                  </TableRow>
                )}
                {itens.map((i, n) => (
                  <TableRow key={i.chave}>
                    <TableCell className="text-muted-foreground">{n + 1}</TableCell>
                    {(["descricao", "apropriacao", "tipo", "data", "valor"] as const).map((campo) => (
                      <TableCell key={campo}>
                        {editavel ? (
                          <Input
                            type={campo === "data" ? "date" : campo === "valor" ? "number" : "text"}
                            step={campo === "valor" ? "0.01" : undefined}
                            min={campo === "valor" ? "0" : undefined}
                            value={i[campo]}
                            onChange={(e) => atualizar(i.chave, { [campo]: e.target.value })}
                            placeholder={campo === "tipo" ? "Ex.: Combustível" : undefined}
                            aria-label={campo}
                          />
                        ) : campo === "valor" ? (
                          moeda(num(i.valor))
                        ) : campo === "data" && i.data ? (
                          i.data.split("-").reverse().join("/")
                        ) : (
                          i[campo]
                        )}
                      </TableCell>
                    ))}
                    {editavel && (
                      <TableCell>
                        <Button size="icon" variant="ghost" aria-label="Remover item" onClick={() => setItens((l) => l.filter((x) => x.chave !== i.chave))}>
                          <Trash2 />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
              {itens.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="text-right font-medium">
                      Total
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">{moeda(total)}</TableCell>
                    {editavel && <TableCell />}
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

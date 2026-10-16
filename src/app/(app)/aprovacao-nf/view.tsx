"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NotasTabela } from "@/components/notas/notas-tabela";
import { DecisaoNota } from "@/components/notas/acoes-nota";
import { dataHora, moeda } from "@/lib/format";
import { decidirReembolso } from "@/lib/reembolsos/actions";
import { numeroReembolso, type ReembolsoResumo } from "@/lib/reembolsos/tipos";
import type { NotaResumo } from "@/lib/notas/tipos";

export function AprovacaoNfView({
  notas,
  reembolsos,
  podeAprovar,
}: {
  notas: NotaResumo[];
  reembolsos: ReembolsoResumo[];
  podeAprovar: boolean;
}) {
  return (
    <div className="space-y-8">
      <NotasTabela
        titulo="Aprovação NF"
        descricao={
          podeAprovar
            ? "Notas das fases Cinza e Azul aguardando a validação da engenharia."
            : "Somente a engenharia (ou admin) aprova notas. Você está vendo em modo leitura."
        }
        notas={notas}
        nomeArquivo="aprovacao-nf"
        abas={[
          { chave: "aguardando", rotulo: "Aguardando engenharia", status: ["aguardando_engenharia"] },
          { chave: "reprovadas", rotulo: "Reprovadas", status: ["reprovada"] },
        ]}
        acoes={(n) => (podeAprovar && n.status === "aguardando_engenharia" ? <DecisaoNota nota={n} compacto /> : null)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reembolsos aguardando a engenharia ({reembolsos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Favorecido</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reembolsos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                      Nenhum reembolso aguardando.
                    </TableCell>
                  </TableRow>
                )}
                {reembolsos.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/ordens-reembolso/${r.id}`} className="hover:underline">
                        {numeroReembolso(r.id)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {r.obra_codigo} — {r.obra_nome}
                    </TableCell>
                    <TableCell>{r.fornecedor_nome}</TableCell>
                    <TableCell>
                      {r.criado_por_nome}
                      <div className="text-xs text-muted-foreground">{dataHora(r.criado_em)}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{moeda(Number(r.valor_total))}</TableCell>
                    <TableCell className="text-right">
                      {podeAprovar && (
                        <DecisaoNota
                          nota={{ id: r.id, numero: numeroReembolso(r.id), valor: Number(r.valor_total), fornecedor_nome: r.fornecedor_nome }}
                          decidir={decidirReembolso}
                          rotulo="reembolso"
                          compacto
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

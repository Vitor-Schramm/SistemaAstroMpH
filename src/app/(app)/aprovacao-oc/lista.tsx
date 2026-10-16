"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { selectClass } from "@/components/cadastros/registro-form";
import { Aprovacao } from "@/components/compras/aprovacao-icone";
import { DecisaoOc } from "@/components/compras/decisao-oc";
import { data as fmtData, moeda } from "@/lib/format";
import { numeroOC } from "@/lib/compras/tipos";

type Papel = "engenharia" | "financeiro";

export type LinhaAprovacao = {
  id: number;
  data_emissao: string;
  obra_id: number;
  obra_codigo: string;
  obra_nome: string;
  cliente_nome: string | null;
  fornecedor_id: number;
  fornecedor_nome: string;
  engenheiro_responsavel: string | null;
  valor_total: number;
  aprovado_engenharia: boolean | null;
  aprovado_financeiro: boolean | null;
  fornecedor_bloqueado: boolean;
};

const pendentesDe = (l: LinhaAprovacao): Papel[] =>
  [l.aprovado_engenharia == null && "engenharia", l.aprovado_financeiro == null && "financeiro"].filter(Boolean) as Papel[];

export function ListaAprovacao({ linhas, meusPapeis, admin }: { linhas: LinhaAprovacao[]; meusPapeis: Papel[]; admin: boolean }) {
  const [obra, setObra] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [perfil, setPerfil] = useState<string>(admin ? "" : (meusPapeis[0] ?? ""));

  const obras = useMemo(() => [...new Map(linhas.map((l) => [l.obra_id, `${l.obra_codigo} — ${l.obra_nome}`])).entries()], [linhas]);
  const fornecedores = useMemo(() => [...new Map(linhas.map((l) => [l.fornecedor_id, l.fornecedor_nome])).entries()], [linhas]);

  const filtradas = linhas.filter((l) => {
    if (obra && String(l.obra_id) !== obra) return false;
    if (fornecedor && String(l.fornecedor_id) !== fornecedor) return false;
    if (de && l.data_emissao < de) return false;
    if (ate && l.data_emissao > ate) return false;
    if (perfil && !pendentesDe(l).includes(perfil as Papel)) return false;
    return true;
  });

  const total = filtradas.reduce((s, l) => s + Number(l.valor_total), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Aprovação de OC</h1>
        <p className="text-sm text-muted-foreground">
          {filtradas.length} OC(s) aguardando · {moeda(total)}
          {meusPapeis.length === 0 && " · Seu perfil não aprova OCs (somente leitura)."}
        </p>
      </div>

      <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-5">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="f-obra">Obra</Label>
          <select id="f-obra" value={obra} onChange={(e) => setObra(e.target.value)} className={selectClass}>
            <option value="">Todas</option>
            {obras.map(([id, r]) => (
              <option key={id} value={id}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="f-forn">Fornecedor</Label>
          <select id="f-forn" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className={selectClass}>
            <option value="">Todos</option>
            {fornecedores.map(([id, r]) => (
              <option key={id} value={id}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="f-perfil">Pendente para</Label>
          <select id="f-perfil" value={perfil} onChange={(e) => setPerfil(e.target.value)} className={selectClass}>
            <option value="">Qualquer perfil</option>
            <option value="engenharia">Engenharia</option>
            <option value="financeiro">Financeiro</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="f-de">Emissão de</Label>
          <Input id="f-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="f-ate">até</Label>
          <Input id="f-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>OC</TableHead>
              <TableHead>Emissão</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Eng.</TableHead>
              <TableHead className="text-center">Fin.</TableHead>
              <TableHead className="w-56" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Nenhuma OC aguardando aprovação com esses filtros.
                </TableCell>
              </TableRow>
            )}
            {filtradas.map((l) => {
              const pend = pendentesDe(l);
              const papeis = admin ? meusPapeis : meusPapeis.filter((p) => pend.includes(p));
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/ordens-compra/${l.id}`} className="hover:underline">
                      {numeroOC(l.id)}
                    </Link>
                  </TableCell>
                  <TableCell>{fmtData(l.data_emissao)}</TableCell>
                  <TableCell>
                    {l.obra_codigo} — {l.obra_nome}
                    {l.engenheiro_responsavel && <div className="text-xs text-muted-foreground">Eng.: {l.engenheiro_responsavel}</div>}
                  </TableCell>
                  <TableCell>
                    {l.fornecedor_nome}
                    {l.fornecedor_bloqueado && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-destructive">
                        <TriangleAlert className="size-3" /> bloqueado
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{moeda(Number(l.valor_total))}</TableCell>
                  <TableCell className="text-center">
                    <Aprovacao valor={l.aprovado_engenharia} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Aprovacao valor={l.aprovado_financeiro} />
                  </TableCell>
                  <TableCell>
                    <DecisaoOc ocId={l.id} papeis={papeis} pendentes={pend} compacto />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

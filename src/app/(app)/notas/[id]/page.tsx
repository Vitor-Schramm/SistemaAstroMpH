import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/compras/status-badge";
import { DecisaoNota, EstornarNota, PagarNota } from "@/components/notas/acoes-nota";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, podeAprovarNf, podeLancarNf, podePagar } from "@/lib/auth";
import { data as fmtData, dataHora, moeda } from "@/lib/format";
import { numeroOC } from "@/lib/compras/tipos";
import { numeroGuia, SELECT_NOTAS, STATUS_NF, type NotaResumo } from "@/lib/notas/tipos";
import { NotaForm, type OcSaldo } from "../nota-form";
import { Anexos, type Anexo } from "./anexos";
import { CancelarNota } from "./cancelar";

export default async function NotaPage({ params }: PageProps<"/notas/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const supabase = await createClient();
  const [perfil, { data: nota }, { data: anexos }] = await Promise.all([
    getPerfil(),
    supabase.from("notas_resumo").select(SELECT_NOTAS).eq("id", id).maybeSingle(),
    supabase.from("nf_anexos").select("id, nome, tamanho, criado_em").eq("nota_fiscal_id", id).order("id"),
  ]);
  if (!nota) notFound();
  const n = nota as NotaResumo;

  const ativo = perfil.ativo;
  const editavel = ativo && podeLancarNf(perfil.papel) && ["aguardando_engenharia", "reprovada"].includes(n.status);
  const [{ data: verba }, { data: ocsData }] = await Promise.all([
    supabase.from("obras_verba").select("disponivel").eq("obra_id", n.obra_id).maybeSingle(),
    supabase
      .from("ocs_saldo")
      .select("id, obra_codigo, obra_nome, fornecedor_nome, valor_total, saldo")
      .or(`saldo.gt.0,id.eq.${n.ordem_compra_id}`)
      .order("id", { ascending: false })
      .limit(2000),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" render={<Link href={n.fase === "azul" ? "/notas-azul" : "/notas-cinza"} />} aria-label="Voltar">
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              NF {n.numero}/{n.serie}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge mapa={STATUS_NF} valor={n.status} />
              <span>Fase {n.fase === "azul" ? "Azul" : "Cinza"}</span>
              <Link href={`/ordens-compra/${n.ordem_compra_id}`} className="hover:underline">
                {numeroOC(n.ordem_compra_id)}
              </Link>
              {n.guia_id && <span>{numeroGuia(n.guia_id)}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ativo && podeAprovarNf(perfil.papel) && n.status === "aguardando_engenharia" && <DecisaoNota nota={n} />}
          {ativo && podePagar(perfil.papel) && n.fase === "cinza" && n.status === "pendente_pagamento" && <PagarNota nota={n} />}
          {ativo && podePagar(perfil.papel) && n.fase === "cinza" && n.status === "paga" && <EstornarNota nota={n} />}
          {ativo && podeLancarNf(perfil.papel) && ["aguardando_engenharia", "reprovada", "pendente_pagamento", "aguardando_guia"].includes(n.status) && (
            <CancelarNota id={n.id} numero={n.numero} />
          )}
        </div>
      </div>

      {n.status === "reprovada" && n.justificativa && (
        <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <TriangleAlert className="size-4 shrink-0 text-destructive" />
          <div>
            <b>Reprovada pela engenharia</b> ({n.aprovado_por_nome}, {dataHora(n.aprovado_em)}): {n.justificativa}
            <div className="text-muted-foreground">Corrija os dados ou anexos abaixo e salve para reenviar.</div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground">Fornecedor:</span> {n.fornecedor_nome} ({n.fornecedor_cnpj})
          </div>
          <div>
            <span className="text-muted-foreground">Obra:</span> {n.obra_codigo} — {n.obra_nome}
          </div>
          <div>
            <span className="text-muted-foreground">Cliente:</span> {n.cliente_nome ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Valor:</span> <b>{moeda(Number(n.valor))}</b>
          </div>
          <div>
            <span className="text-muted-foreground">Vencimento:</span> {fmtData(n.vencimento)}
          </div>
          {n.fase === "cinza" && verba && (
            <div>
              <span className="text-muted-foreground">Verba disponível da obra:</span>{" "}
              <b className={Number(verba.disponivel) < 0 ? "text-destructive" : undefined}>{moeda(Number(verba.disponivel))}</b>
            </div>
          )}
          {n.aprovado_em && n.status !== "reprovada" && (
            <div>
              <span className="text-muted-foreground">Aprovada (engenharia):</span> {n.aprovado_por_nome}, {dataHora(n.aprovado_em)}
            </div>
          )}
          {n.pago_em && (
            <div>
              <span className="text-muted-foreground">Paga em:</span> {fmtData(n.pago_em)} {n.pago_por_nome && `por ${n.pago_por_nome}`}
              {n.pagamento_forcado && <span className="ml-1 text-amber-700">(forçado)</span>}
            </div>
          )}
        </CardContent>
      </Card>

      <Anexos
        notaId={n.id}
        anexos={(anexos ?? []) as Anexo[]}
        podeEnviar={ativo && (podeLancarNf(perfil.papel) || podeAprovarNf(perfil.papel)) && n.status !== "cancelada"}
        podeRemover={ativo && podeLancarNf(perfil.papel) && ["aguardando_engenharia", "reprovada"].includes(n.status)}
      />

      <NotaForm
        key={`n-${n.status}-${n.valor}-${n.numero}`}
        id={n.id}
        inicial={{
          fase: n.fase,
          ordem_compra_id: String(n.ordem_compra_id),
          numero: n.numero,
          serie: n.serie,
          emissao: n.emissao ?? "",
          vencimento: n.vencimento,
          valor: String(n.valor),
          observacao: n.observacao ?? "",
        }}
        ocs={(ocsData ?? []) as OcSaldo[]}
        editavel={editavel}
      />
    </div>
  );
}

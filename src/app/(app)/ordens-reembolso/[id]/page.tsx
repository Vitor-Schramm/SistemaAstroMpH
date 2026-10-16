import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/compras/status-badge";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, podeAprovarNf, podeLancarNf, podePagar } from "@/lib/auth";
import { opcoesObras } from "@/lib/compras/dados";
import { dataHora, data as fmtData } from "@/lib/format";
import { opcoesFavorecidos } from "@/lib/reembolsos/dados";
import { numeroReembolso, STATUS_REEMBOLSO, type ReembolsoResumo } from "@/lib/reembolsos/tipos";
import { ReembolsoForm, type ItemReembolso } from "../reembolso-form";
import { AcoesReembolso } from "../acoes";

type Item = { id: number; ordem: number; descricao: string; apropriacao: string | null; tipo: string | null; data: string | null; valor: number };

export default async function ReembolsoPage({ params }: PageProps<"/ordens-reembolso/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const supabase = await createClient();
  const [perfil, obras, favorecidos, { data: r }, { data: itens }] = await Promise.all([
    getPerfil(),
    opcoesObras(),
    opcoesFavorecidos(),
    supabase.from("reembolsos_resumo").select("*").eq("id", id).maybeSingle(),
    supabase.from("reembolso_itens").select("*").eq("reembolso_id", id).order("ordem"),
  ]);
  if (!r) notFound();
  const re = r as ReembolsoResumo;

  const podeEditar = perfil.ativo && (podeLancarNf(perfil.papel) || re.criado_por === perfil.id);
  const editavel = podeEditar && (re.status === "rascunho" || re.status === "reprovada");
  const linhas: ItemReembolso[] = ((itens ?? []) as Item[]).map((i) => ({
    chave: `i${i.id}`,
    descricao: i.descricao,
    apropriacao: i.apropriacao ?? "",
    tipo: i.tipo ?? "",
    data: i.data ?? "",
    valor: String(i.valor),
  }));
  const obraAtual = String(re.obra_id);
  const fornAtual = String(re.fornecedor_id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" render={<Link href="/ordens-reembolso" />} aria-label="Voltar">
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{numeroReembolso(id)}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge mapa={STATUS_REEMBOLSO} valor={re.status} />
              {re.criado_por_nome && <span>Criado por {re.criado_por_nome}</span>}
              {re.aprovado_em && re.status !== "reprovada" && <span>· Aprovado por {re.aprovado_por_nome} em {dataHora(re.aprovado_em)}</span>}
              {re.pago_em && (
                <span>
                  · Pago em {fmtData(re.pago_em)}
                  {re.pagamento_forcado && " (forçado)"}
                </span>
              )}
            </div>
          </div>
        </div>
        <AcoesReembolso r={re} podeAprovar={perfil.ativo && podeAprovarNf(perfil.papel)} podePagar={perfil.ativo && podePagar(perfil.papel)} podeEditar={podeEditar} />
      </div>

      {re.status === "reprovada" && re.justificativa && (
        <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <TriangleAlert className="size-4 shrink-0 text-destructive" />
          <div>
            <b>Reprovado pela engenharia</b> ({re.aprovado_por_nome}, {dataHora(re.aprovado_em)}): {re.justificativa}
          </div>
        </div>
      )}

      <ReembolsoForm
        key={`r-${re.atualizado_em}`}
        id={id}
        inicial={{
          obra_id: obraAtual,
          filial: re.filial ?? "",
          fornecedor_id: fornAtual,
          cpf_cnpj: re.cpf_cnpj,
          banco: re.banco,
          agencia: re.agencia,
          conta: re.conta,
          observacao: re.observacao ?? "",
        }}
        itensIniciais={linhas}
        obras={obras.some((o) => o.valor === obraAtual) ? obras : [...obras, { valor: obraAtual, rotulo: `${re.obra_codigo} — ${re.obra_nome}` }]}
        favorecidos={
          favorecidos.some((f) => f.valor === fornAtual)
            ? favorecidos
            : [...favorecidos, { valor: fornAtual, rotulo: re.fornecedor_nome, bloqueado: false, cpf_cnpj: re.cpf_cnpj, banco: re.banco, agencia: re.agencia, conta: re.conta }]
        }
        editavel={editavel}
      />
    </div>
  );
}

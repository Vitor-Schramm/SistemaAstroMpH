import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, podeEditarCadastros, podePagar } from "@/lib/auth";
import { compararCodigo, type CentroCusto, type PagamentoCliente, type Percentual, type Planilha, type Responsavel } from "@/lib/obras/tipos";
import { ControleFinanceiro, type ObraCabecalho } from "./controle-financeiro";

export async function generateMetadata({ params }: PageProps<"/obras/[id]">): Promise<Metadata> {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return { title: "Não encontrada" };
  const supabase = await createClient();
  const { data } = await supabase.from("obras").select("codigo, nome").eq("id", id).maybeSingle();
  return { title: data ? `${data.codigo} — ${data.nome}` : "Não encontrada" };
}

export default async function ObraPage({ params }: PageProps<"/obras/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const supabase = await createClient();
  const [perfil, { data: obra }, planilhasR, { data: ccs }, { data: pagamentos }, { data: percentuais }, { data: responsaveis }, { data: filiais }, { data: perfis }, { data: clientes }] =
    await Promise.all([
      getPerfil(),
      supabase.from("obras").select("*, cliente:clientes!cliente_id(nome)").eq("id", id).maybeSingle(),
      supabase.from("planilhas_resumo").select("*").eq("obra_id", id).order("seq"),
      supabase.from("centros_custo_saldos").select("*").eq("obra_id", id),
      supabase.from("pagamentos_cliente").select("*").eq("obra_id", id).order("data", { ascending: false }),
      supabase.from("planilha_percentuais").select("*, planilha:planilhas!inner(obra_id)").eq("planilha.obra_id", id),
      supabase.from("obra_responsaveis").select("*, perfil:perfis(nome, email)").eq("obra_id", id),
      supabase.from("obra_filiais").select("cliente_id, cliente:clientes(nome)").eq("obra_id", id),
      supabase.from("perfis").select("id, nome, papel").eq("ativo", true).order("nome"),
      supabase.from("clientes").select("id, nome").eq("ativo", true).order("nome"),
    ]);
  if (!obra) notFound();

  const voltar = (
    <Button variant="ghost" size="icon" render={<Link href="/obras" />} aria-label="Voltar">
      <ArrowLeft />
    </Button>
  );

  if (planilhasR.error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {voltar}
          <h1 className="text-2xl font-semibold tracking-tight">
            {obra.codigo} — {obra.nome}
          </h1>
        </div>
        <div className="flex gap-2 rounded-md border border-amber-400/60 bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
          <TriangleAlert className="size-4 shrink-0 text-amber-600" />
          <div>
            O controle financeiro ainda não está instalado no banco. Rode o arquivo <b>supabase/migrations/0005_controle_financeiro.sql</b> no SQL Editor do Supabase e
            recarregue a página.
          </div>
        </div>
      </div>
    );
  }

  const cabecalho: ObraCabecalho = {
    id: obra.id,
    codigo: obra.codigo,
    nome: obra.nome,
    cliente: (obra.cliente as { nome: string } | null)?.nome ?? null,
    regime: obra.regime,
    status: obra.status,
    diretor: obra.diretor ?? null,
    coordenador: obra.coordenador ?? null,
    engenheiro: obra.engenheiro ?? null,
    arquitetura: obra.arquitetura ?? null,
    gerenciadora: obra.gerenciadora ?? null,
    orcamentista: obra.orcamentista ?? null,
    suprimento: obra.suprimento ?? null,
    inicio: obra.inicio ?? null,
    termino: obra.termino ?? null,
    possui_seguro: Boolean(obra.possui_seguro),
    validade_seguro: obra.validade_seguro ?? null,
    ultimo_envio_relatorio: obra.ultimo_envio_relatorio ?? null,
  };

  return (
    <ControleFinanceiro
      voltar={voltar}
      obra={cabecalho}
      planilhas={(planilhasR.data ?? []) as Planilha[]}
      ccs={((ccs ?? []) as CentroCusto[]).sort((a, b) => compararCodigo(a.codigo, b.codigo))}
      pagamentos={(pagamentos ?? []) as PagamentoCliente[]}
      percentuais={(percentuais ?? []) as Percentual[]}
      responsaveis={(responsaveis ?? []) as unknown as Responsavel[]}
      filiais={((filiais ?? []) as unknown as { cliente_id: number; cliente: { nome: string } | null }[]).map((f) => ({ id: f.cliente_id, nome: f.cliente?.nome ?? "" }))}
      perfis={(perfis ?? []).map((p) => ({ valor: p.id as string, rotulo: p.nome as string }))}
      clientes={(clientes ?? []).filter((c) => c.id !== obra.cliente_id).map((c) => ({ valor: String(c.id), rotulo: c.nome as string }))}
      podeEstrutura={perfil.ativo && podeEditarCadastros(perfil.papel)}
      podeFinanceiro={perfil.ativo && podePagar(perfil.papel)}
      ehAdmin={perfil.ativo && perfil.papel === "admin"}
    />
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, podeEditarCadastros, podePagar } from "@/lib/auth";
import { compararCodigo, type CentroCusto, type PagamentoCliente, type Percentual, type Planilha, type Responsavel } from "@/lib/obras/tipos";
import { ControleFinanceiro, type ObraDados } from "./controle-financeiro";
import type { ArquivoObra } from "./dialogos";

export const metadata: Metadata = { title: "Controle Financeiro" };

export default async function ObraPage({ params }: PageProps<"/obras/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const supabase = await createClient();
  const [perfil, { data: obra }, planilhasR, { data: ccs }, { data: pagamentos }, { data: percentuais }, { data: responsaveis }, { data: filiais }, { data: perfis }, { data: clientes }, arquivosR] =
    await Promise.all([
      getPerfil(),
      supabase.from("obras").select("*").eq("id", id).maybeSingle(),
      supabase.from("planilhas_resumo").select("*").eq("obra_id", id).order("seq"),
      supabase.from("centros_custo_saldos").select("*").eq("obra_id", id),
      supabase.from("pagamentos_cliente").select("*").eq("obra_id", id).order("data"),
      supabase.from("planilha_percentuais").select("*, planilha:planilhas!inner(obra_id)").eq("planilha.obra_id", id),
      supabase.from("obra_responsaveis").select("*, perfil:perfis(nome, email)").eq("obra_id", id),
      supabase.from("obra_filiais").select("cliente_id, cliente:clientes(nome)").eq("obra_id", id),
      supabase.from("perfis").select("id, nome, email").eq("ativo", true).order("nome"),
      supabase.from("clientes").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("obra_arquivos").select("id, tipo, nome, enviado_em").eq("obra_id", id).order("enviado_em"),
    ]);
  if (!obra) notFound();

  if (planilhasR.error) {
    return (
      <>
        <CabecalhoPagina titulo="Controle Financeiro" migalhas={[{ titulo: "Obras", href: "/obras" }, { titulo: "Controle Financeiro" }]} />
        <div className="flex gap-2 rounded-[0.428rem] border border-amber-400/60 bg-amber-50 p-4 text-[1rem] dark:bg-amber-950/30">
          <TriangleAlert className="size-4 shrink-0 text-amber-600" />
          <div>
            O controle financeiro ainda não está instalado no banco. Rode os arquivos <b>0005_controle_financeiro.sql</b> e <b>0006_obra_campos_original.sql</b> (pasta
            supabase/migrations) no SQL Editor do Supabase e recarregue a página.
          </div>
        </div>
      </>
    );
  }

  return (
    <ControleFinanceiro
      obra={obra as ObraDados}
      planilhas={(planilhasR.data ?? []) as Planilha[]}
      ccs={((ccs ?? []) as CentroCusto[]).sort((a, b) => compararCodigo(a.codigo, b.codigo))}
      pagamentos={(pagamentos ?? []) as PagamentoCliente[]}
      percentuais={(percentuais ?? []) as Percentual[]}
      responsaveis={(responsaveis ?? []) as unknown as Responsavel[]}
      filiais={((filiais ?? []) as unknown as { cliente_id: number; cliente: { nome: string } | null }[]).map((f) => ({ id: f.cliente_id, nome: f.cliente?.nome ?? "" }))}
      perfis={(perfis ?? []).map((p) => ({ valor: p.id as string, rotulo: `${p.nome} - ${p.email}` }))}
      clientes={(clientes ?? []).filter((c) => c.id !== obra.cliente_id).map((c) => ({ valor: String(c.id), rotulo: c.nome as string }))}
      podeEstrutura={perfil.ativo && podeEditarCadastros(perfil.papel)}
      podeFinanceiro={perfil.ativo && podePagar(perfil.papel)}
      ehAdmin={perfil.ativo && perfil.papel === "admin"}
      arquivos={arquivosR.error ? null : ((arquivosR.data ?? []) as ArquivoObra[])}
    />
  );
}

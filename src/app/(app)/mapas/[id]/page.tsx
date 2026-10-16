import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/compras/status-badge";
import { createClient } from "@/lib/supabase/server";
import { catalogoItens, opcoesFornecedores, opcoesObras } from "@/lib/compras/dados";
import { getPerfil, podeComprar } from "@/lib/auth";
import { moeda } from "@/lib/format";
import { numeroMapa, numeroOC, numeroSolicitacao, STATUS_MAPA, STATUS_OC, type LinhaItem } from "@/lib/compras/tipos";
import { MapaForm } from "../mapa-form";
import { CotacaoEditor, type ItemMapa, type Participante } from "../cotacao-editor";
import { AcoesMapa } from "./acoes";

export async function generateMetadata({ params }: PageProps<"/mapas/[id]">): Promise<Metadata> {
  const id = Number((await params).id);
  return { title: Number.isInteger(id) ? numeroMapa(id) : "Não encontrado" };
}

export default async function MapaPage({ params }: PageProps<"/mapas/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const supabase = await createClient();
  const [perfil, obras, catalogo, fornecedores, { data: m }, { data: ocs }] = await Promise.all([
    getPerfil(),
    opcoesObras(),
    catalogoItens(),
    opcoesFornecedores(),
    supabase
      .from("mapas")
      .select("*, itens:mapa_itens(*, precos:mapa_precos(*)), participantes:mapa_fornecedores(*, fornecedor:fornecedores(nome))")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("ordens_compra_resumo").select("id, status, fornecedor_nome, valor_total").eq("mapa_id", id).order("id"),
  ]);
  if (!m) notFound();

  const editavel = m.status === "aberto" && perfil.ativo && podeComprar(perfil.papel);
  const itensOrdenados = [...(m.itens ?? [])].sort((a, b) => a.ordem - b.ordem);

  const linhas: LinhaItem[] = itensOrdenados.map((i) => ({ ...i, chave: `i${i.id}` }));
  const itensMapa: ItemMapa[] = itensOrdenados.map((i) => ({
    id: i.id,
    descricao: i.descricao,
    codigo: i.codigo,
    quantidade: Number(i.quantidade),
    unidade: i.unidade,
    fornecedor_vencedor_id: i.fornecedor_vencedor_id,
  }));
  const bloqueados = new Set(fornecedores.filter((f) => f.bloqueado).map((f) => Number(f.valor)));
  const participantes: Participante[] = (m.participantes ?? []).map((p: Record<string, unknown> & { fornecedor: { nome: string } }) => ({
    fornecedor_id: Number(p.fornecedor_id),
    nome: p.fornecedor?.nome ?? `#${p.fornecedor_id}`,
    bloqueado: bloqueados.has(Number(p.fornecedor_id)),
    condicao_pagamento: String(p.condicao_pagamento ?? ""),
    prazo_entrega: String(p.prazo_entrega ?? ""),
    frete: p.frete ? String(p.frete) : "",
    observacao: String(p.observacao ?? ""),
  }));
  const precos: Record<string, string> = {};
  for (const i of itensOrdenados) for (const p of i.precos ?? []) precos[`${i.id}:${p.fornecedor_id}`] = String(p.valor_unitario);

  const obraAtual = String(m.obra_id);
  const opcoesObra = obras.some((o) => o.valor === obraAtual) ? obras : [...obras, { valor: obraAtual, rotulo: `Obra #${obraAtual}` }];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" render={<Link href="/mapas" />} aria-label="Voltar">
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{numeroMapa(id)}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge mapa={STATUS_MAPA} valor={m.status} />
              {m.solicitacao_id && (
                <Link href={`/solicitacoes/${m.solicitacao_id}`} className="hover:underline">
                  Solicitação {numeroSolicitacao(m.solicitacao_id)}
                </Link>
              )}
            </div>
          </div>
        </div>
        {editavel && <AcoesMapa id={id} />}
      </div>

      {ocs && ocs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ordens de compra geradas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {ocs.map((oc) => (
              <Link key={oc.id} href={`/ordens-compra/${oc.id}`} className="rounded-md border p-3 text-sm hover:bg-muted/50">
                <div className="font-mono text-xs">{numeroOC(oc.id)}</div>
                <div className="font-medium">{oc.fornecedor_nome}</div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums">{moeda(Number(oc.valor_total))}</span>
                  <StatusBadge mapa={STATUS_OC} valor={oc.status} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <MapaForm
        key={`f-${m.atualizado_em}`}
        id={id}
        inicial={{
          obra_id: obraAtual,
          solicitacao_id: m.solicitacao_id ? String(m.solicitacao_id) : "",
          servico: m.servico,
          apropriacao: m.apropriacao ?? "",
          tipo: m.tipo,
          data_entrega: m.data_entrega ?? "",
          prazo_locacao: m.prazo_locacao ?? "",
          data_devolucao: m.data_devolucao ?? "",
          observacao: m.observacao ?? "",
        }}
        itensIniciais={linhas}
        obras={opcoesObra}
        catalogo={catalogo}
        editavel={editavel}
      />

      <CotacaoEditor
        key={`c-${m.atualizado_em}-${itensMapa.length}`}
        mapaId={id}
        itens={itensMapa}
        participantesIniciais={participantes}
        precosIniciais={precos}
        fornecedores={fornecedores}
        editavel={editavel}
      />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/compras/status-badge";
import { Aprovacao } from "@/components/compras/aprovacao-icone";
import { DecisaoOc } from "@/components/compras/decisao-oc";
import { createClient } from "@/lib/supabase/server";
import { catalogoItens, opcoesFornecedores, opcoesObras } from "@/lib/compras/dados";
import { getPerfil, papeisAprovador, podeComprar } from "@/lib/auth";
import { dataHora } from "@/lib/format";
import { numeroMapa, numeroOC, STATUS_OC, type LinhaItem } from "@/lib/compras/tipos";
import { OcForm } from "../oc-form";
import { AcoesOc } from "./acoes";

type AprovacaoRow = { papel: "engenharia" | "financeiro"; aprovado: boolean; justificativa: string | null; decidido_em: string; usuario: { nome: string } | null };

export async function generateMetadata({ params }: PageProps<"/ordens-compra/[id]">): Promise<Metadata> {
  const id = Number((await params).id);
  return { title: Number.isInteger(id) ? numeroOC(id) : "Não encontrado" };
}

export default async function OcPage({ params }: PageProps<"/ordens-compra/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const supabase = await createClient();
  const [perfil, obras, fornecedores, catalogo, { data: oc }] = await Promise.all([
    getPerfil(),
    opcoesObras(),
    opcoesFornecedores(),
    catalogoItens(),
    supabase
      .from("ordens_compra")
      .select("*, itens:oc_itens(*), aprovacoes:oc_aprovacoes(papel, aprovado, justificativa, decidido_em, usuario:perfis(nome))")
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!oc) notFound();

  const compras = perfil.ativo && podeComprar(perfil.papel);
  const editavel = compras && (oc.status === "rascunho" || oc.status === "reprovada");
  const aprovacoes = (oc.aprovacoes ?? []) as AprovacaoRow[];
  const decisao = (p: "engenharia" | "financeiro") => aprovacoes.find((a) => a.papel === p);
  const pendentes = (["engenharia", "financeiro"] as const).filter((p) => !decisao(p));
  const meusPapeis = perfil.ativo ? papeisAprovador(perfil.papel) : [];
  // Não-admin só decide se o próprio papel ainda não decidiu.
  const papeisDisponiveis = perfil.papel === "admin" ? meusPapeis : meusPapeis.filter((p) => pendentes.includes(p));

  const itens: LinhaItem[] = [...(oc.itens ?? [])].sort((a, b) => a.ordem - b.ordem).map((i) => ({ ...i, chave: `i${i.id}` }));

  const garantir = <T extends { valor: string }>(lista: T[], valor: string, extra: T) => (lista.some((o) => o.valor === valor) ? lista : [...lista, extra]);
  const obraAtual = String(oc.obra_id);
  const fornAtual = String(oc.fornecedor_id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" render={<Link href="/ordens-compra" />} aria-label="Voltar">
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{numeroOC(id)}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge mapa={STATUS_OC} valor={oc.status} />
              {oc.mapa_id && (
                <Link href={`/mapas/${oc.mapa_id}`} className="hover:underline">
                  Mapa {numeroMapa(oc.mapa_id)}
                </Link>
              )}
            </div>
          </div>
        </div>
        <AcoesOc id={id} status={oc.status} podeComprar={compras} />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Aprovações</CardTitle>
          {oc.status === "aguardando_aprovacao" && <DecisaoOc ocId={id} papeis={papeisDisponiveis} pendentes={pendentes} />}
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {(["engenharia", "financeiro"] as const).map((p) => {
            const d = decisao(p);
            return (
              <div key={p} className="flex gap-3 rounded-md border p-3 text-sm">
                <Aprovacao valor={d ? d.aprovado : null} />
                <div>
                  <div className="font-medium capitalize">{p}</div>
                  {d ? (
                    <>
                      <div className="text-muted-foreground">
                        {d.aprovado ? "Aprovado" : "Reprovado"} por {d.usuario?.nome ?? "—"} em {dataHora(d.decidido_em)}
                      </div>
                      {d.justificativa && <div className="mt-1 whitespace-pre-wrap">{d.justificativa}</div>}
                    </>
                  ) : (
                    <div className="text-muted-foreground">{oc.status === "aguardando_aprovacao" ? "Aguardando decisão" : "—"}</div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <OcForm
        key={`oc-${oc.atualizado_em}`}
        id={id}
        inicial={{
          obra_id: obraAtual,
          fornecedor_id: fornAtual,
          engenheiro_responsavel: oc.engenheiro_responsavel ?? "",
          data_emissao: oc.data_emissao ?? "",
          data_entrega: oc.data_entrega ?? "",
          condicao_pagamento: oc.condicao_pagamento ?? "",
          prazo_entrega: oc.prazo_entrega ?? "",
          frete: oc.frete ? String(oc.frete) : "",
          observacao: oc.observacao ?? "",
        }}
        itensIniciais={itens}
        obras={garantir(obras, obraAtual, { valor: obraAtual, rotulo: `Obra #${obraAtual}` })}
        fornecedores={garantir(fornecedores, fornAtual, { valor: fornAtual, rotulo: `Fornecedor #${fornAtual}`, bloqueado: false })}
        catalogo={catalogo}
        editavel={editavel}
      />
    </div>
  );
}
